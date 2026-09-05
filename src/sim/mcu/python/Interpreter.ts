import { parsePython, type PyParseError } from './parser';
import type {
  PyExceptHandler,
  PyExpr,
  PyFuncDef,
  PyLambda,
  PyModule as PyModuleAst,
  PyParam,
  PyStmt,
} from './ast';
import {
  asSequence,
  normaliseIndex,
  PyClass,
  PyDict,
  PyFunction,
  PyInstance,
  PyList,
  PyModule,
  PyNative,
  PySet,
  PyTuple,
  pyEquals,
  pyNum,
  pyRepr,
  pyStr,
  truthy,
  typeName,
  type PyValue,
  type PyWait,
} from './values';

/** Cycles accumulated before the VM hands control back. */
const QUANTUM = 512;
const COST = { stmt: 4, call: 14, loop: 8, arith: 1 };

/** The micro:bit's nRF52 runs at 64 MHz, but MicroPython is interpreted, so
 *  the effective statement rate is far lower. This is tuned so a `sleep`-driven
 *  program keeps step with wall-clock the way the real board does. */
export const PY_CPU_HZ = 4_000_000;

export class PyRuntimeError extends Error {
  constructor(
    message: string,
    readonly line: number,
    readonly value: PyValue = null,
  ) {
    super(message);
  }
}

/** A Python-level `raise`, carrying the exception object. */
class PyThrow {
  constructor(
    readonly value: PyValue,
    readonly line: number,
    readonly name: string,
    readonly message: string,
  ) {}
}

type Completion =
  | { type: 'normal' }
  | { type: 'break' }
  | { type: 'continue' }
  | { type: 'return'; value: PyValue };

const NORMAL: Completion = { type: 'normal' };

class Scope {
  vars = new Map<string, PyValue>();
  /** Names declared `global` in this scope. */
  globals = new Set<string>();
  constructor(
    readonly parent: Scope | null,
    readonly isFunction = false,
  ) {}

  lookup(name: string): { scope: Scope; value: PyValue } | undefined {
    if (this.vars.has(name)) return { scope: this, value: this.vars.get(name)! };
    return this.parent?.lookup(name);
  }
}

export type PyModuleLoader = (name: string) => PyModule | undefined;

/**
 * Tree-walking MicroPython VM.
 *
 * Execution is a generator, like the C++ side, so `sleep()` and the blocking
 * display calls suspend mid-expression and resume on the next simulation tick.
 * A program's `while True:` loop is therefore not a hang — it is just the
 * board running.
 */
export class PyInterpreter {
  private module: PyModuleAst = { body: [], imports: [] };
  private globalScope = new Scope(null);

  /** Modules the runtime exposes to `import`. */
  moduleLoader: PyModuleLoader = () => undefined;
  /** Names always in scope: print, len, range… */
  builtins = new Map<string, PyValue>();

  parseErrors: PyParseError[] = [];
  runtimeError: { message: string; line: number } | null = null;

  private pending = 0;
  private credit = 0;
  private task: Generator<PyWait, void, void> | null = null;
  private callDepth = 0;
  private started = false;

  currentLine = 0;
  breakpoints = new Set<number>();
  paused: { line: number; scope: Record<string, unknown> } | null = null;
  /** Set by `step()`: park again on the next statement, wherever it is. */
  private stepping = false;
  /** True once the program has run off the end of the module. */
  finished = false;

  // ── loading ────────────────────────────────────────────────────────────────

  load(source: string): PyParseError[] {
    const { module, errors } = parsePython(source);
    this.module = module;
    this.parseErrors = errors;
    return errors;
  }

  reset() {
    this.globalScope = new Scope(null);
    this.task = null;
    this.started = false;
    this.finished = false;
    this.pending = 0;
    this.credit = 0;
    this.runtimeError = null;
    this.paused = null;
    this.currentLine = 0;
    this.callDepth = 0;
  }

  get imports() {
    return this.module.imports;
  }

  // ── driving ────────────────────────────────────────────────────────────────

  /** Advance the program by `cycles` of simulated time. */
  run(cycles: number) {
    if (this.runtimeError || this.paused || this.finished) return;
    this.credit += cycles;
    if (this.credit > PY_CPU_HZ) this.credit = PY_CPU_HZ;
    let guard = 0;

    while (this.credit > 0) {
      if (++guard > 20000) return;
      if (!this.task) {
        if (this.started) {
          this.finished = true;
          return;
        }
        this.started = true;
        this.task = this.mainTask();
      }
      try {
        const r = this.task.next();
        if (r.done) {
          this.task = null;
          this.finished = true;
          return;
        }
        this.credit -= Math.max(1, r.value.cycles);
      } catch (e) {
        this.captureError(e);
        this.task = null;
        return;
      }
      if (this.paused) return;
    }
  }

  resume() {
    this.paused = null;
    this.stepping = false;
  }

  /** Run exactly one more statement, then park again. */
  step() {
    if (!this.paused) return;
    this.paused = null;
    this.stepping = true;
  }

  private captureError(e: unknown) {
    if (e instanceof PyThrow) {
      this.runtimeError = { message: `${e.name}: ${e.message}`, line: e.line };
      return;
    }
    if (e instanceof PyRuntimeError) {
      this.runtimeError = { message: e.message, line: e.line };
      return;
    }
    this.runtimeError = {
      message: e instanceof Error ? e.message : String(e),
      line: this.currentLine,
    };
  }

  private *mainTask(): Generator<PyWait, void, void> {
    for (const s of this.module.body) {
      const c = yield* this.exec(s, this.globalScope);
      if (c.type !== 'normal') break;
    }
  }

  // ── timing ─────────────────────────────────────────────────────────────────

  private *tick(n: number): Generator<PyWait, void, void> {
    this.pending += n;
    if (this.pending >= QUANTUM) {
      const c = this.pending;
      this.pending = 0;
      yield { cycles: c };
    }
  }

  /** Suspend for a precise number of cycles — how `sleep()` is implemented. */
  *sleepCycles(cycles: number): Generator<PyWait, void, void> {
    let left = cycles + this.pending;
    this.pending = 0;
    while (left > 0) {
      const chunk = Math.min(left, PY_CPU_HZ / 1000);
      left -= chunk;
      yield { cycles: chunk };
    }
  }

  // ── statements ─────────────────────────────────────────────────────────────

  private *execBlock(body: PyStmt[], scope: Scope): Generator<PyWait, Completion, void> {
    for (const s of body) {
      const c = yield* this.exec(s, scope);
      if (c.type !== 'normal') return c;
    }
    return NORMAL;
  }

  private *exec(s: PyStmt, scope: Scope): Generator<PyWait, Completion, void> {
    this.currentLine = s.line;
    if ((this.breakpoints.has(s.line) || this.stepping) && !this.paused) {
      this.stepping = false;
      this.paused = { line: s.line, scope: this.snapshotScope(scope) };
      yield { cycles: 1 };
    }
    yield* this.tick(COST.stmt);

    switch (s.kind) {
      case 'Pass':
        return NORMAL;

      case 'ExprStmt':
        yield* this.evaluate(s.value, scope);
        return NORMAL;

      case 'Assign': {
        const value = yield* this.evaluate(s.value, scope);
        for (const target of s.targets) yield* this.assign(target, value, scope);
        return NORMAL;
      }

      case 'AugAssign': {
        const cur = yield* this.evaluate(s.target, scope);
        const rhs = yield* this.evaluate(s.value, scope);
        yield* this.assign(s.target, this.binary(s.op, cur, rhs, s.line), scope);
        return NORMAL;
      }

      case 'If':
        if (truthy(yield* this.evaluate(s.test, scope))) {
          return yield* this.execBlock(s.body, scope);
        }
        return yield* this.execBlock(s.orelse, scope);

      case 'While': {
        let guard = 0;
        let broke = false;
        while (truthy(yield* this.evaluate(s.test, scope))) {
          const c = yield* this.execBlock(s.body, scope);
          if (c.type === 'break') {
            broke = true;
            break;
          }
          if (c.type === 'return') return c;
          yield* this.tick(COST.loop);
          if (++guard > 5e7) throw new PyRuntimeError('Loop ran too long', s.line);
        }
        if (!broke) return yield* this.execBlock(s.orelse, scope);
        return NORMAL;
      }

      case 'For': {
        const iterable = yield* this.evaluate(s.iter, scope);
        const items = this.iterate(iterable, s.line);
        let broke = false;
        for (const item of items) {
          yield* this.assign(s.target, item, scope);
          const c = yield* this.execBlock(s.body, scope);
          if (c.type === 'break') {
            broke = true;
            break;
          }
          if (c.type === 'return') return c;
          yield* this.tick(COST.loop);
        }
        if (!broke) return yield* this.execBlock(s.orelse, scope);
        return NORMAL;
      }

      case 'FuncDef': {
        const fn = new PyFunction(s, scope, s.name);
        this.setVar(scope, s.name, fn);
        return NORMAL;
      }

      case 'ClassDef': {
        const bases: PyClass[] = [];
        for (const b of s.bases) {
          const v = yield* this.evaluate(b, scope);
          if (v instanceof PyClass) bases.push(v);
        }
        const classScope = new Scope(scope);
        yield* this.execBlock(s.body, classScope);
        const cls = new PyClass(s.name, classScope.vars, bases);
        this.setVar(scope, s.name, cls);
        return NORMAL;
      }

      case 'Return':
        return {
          type: 'return',
          value: s.value ? yield* this.evaluate(s.value, scope) : null,
        };

      case 'Break':
        return { type: 'break' };
      case 'Continue':
        return { type: 'continue' };

      case 'Global':
        for (const n of s.names) scope.globals.add(n);
        return NORMAL;

      case 'Delete':
        for (const t of s.targets) {
          if (t.kind === 'Name') scope.lookup(t.id)?.scope.vars.delete(t.id);
          if (t.kind === 'Subscript') {
            const obj = yield* this.evaluate(t.obj, scope);
            const key = yield* this.evaluate(t.index, scope);
            if (obj instanceof PyDict) obj.delete(key);
            if (obj instanceof PyList) obj.items.splice(normaliseIndex(pyNum(key), obj.items.length), 1);
          }
        }
        return NORMAL;

      case 'Import': {
        for (const n of s.names) {
          const mod = this.moduleLoader(n.name);
          if (!mod) throw new PyRuntimeError(`No module named '${n.name}'`, s.line);
          this.setVar(scope, n.asname ?? n.name.split('.')[0], mod);
        }
        return NORMAL;
      }

      case 'ImportFrom': {
        const mod = this.moduleLoader(s.module);
        if (!mod) throw new PyRuntimeError(`No module named '${s.module}'`, s.line);
        for (const n of s.names) {
          if (n.name === '*') {
            mod.attrs.forEach((v, k) => {
              if (!k.startsWith('_')) this.setVar(scope, k, v);
            });
            continue;
          }
          const v = mod.attrs.get(n.name);
          if (v === undefined) {
            throw new PyRuntimeError(`cannot import name '${n.name}' from '${s.module}'`, s.line);
          }
          this.setVar(scope, n.asname ?? n.name, v);
        }
        return NORMAL;
      }

      case 'Raise': {
        const exc = s.exc ? yield* this.evaluate(s.exc, scope) : null;
        throw this.makeThrow(exc, s.line);
      }

      case 'Assert': {
        if (!truthy(yield* this.evaluate(s.test, scope))) {
          const msg = s.msg ? pyStr(yield* this.evaluate(s.msg, scope)) : '';
          throw new PyThrow(null, s.line, 'AssertionError', msg);
        }
        return NORMAL;
      }

      case 'Try': {
        let completion: Completion = NORMAL;
        try {
          completion = yield* this.execBlock(s.body, scope);
          if (completion.type === 'normal') {
            completion = yield* this.execBlock(s.orelse, scope);
          }
        } catch (e) {
          const handled = yield* this.handleExcept(e, s.handlers, scope);
          if (handled === null) {
            if (s.finalbody.length) yield* this.execBlock(s.finalbody, scope);
            throw e;
          }
          completion = handled;
        }
        if (s.finalbody.length) {
          const f = yield* this.execBlock(s.finalbody, scope);
          if (f.type !== 'normal') return f;
        }
        return completion;
      }

      case 'With': {
        for (const item of s.items) {
          const ctx = yield* this.evaluate(item.context, scope);
          if (item.optional) yield* this.assign(item.optional, ctx, scope);
        }
        return yield* this.execBlock(s.body, scope);
      }
    }
    return NORMAL;
  }

  private *handleExcept(
    e: unknown,
    handlers: PyExceptHandler[],
    scope: Scope,
  ): Generator<PyWait, Completion | null, void> {
    // Only Python-level raises are catchable; an internal fault is not.
    const thrown =
      e instanceof PyThrow
        ? e
        : e instanceof PyRuntimeError
          ? new PyThrow(null, e.line, 'RuntimeError', e.message)
          : null;
    if (!thrown) return null;

    for (const h of handlers) {
      if (h.type) {
        const t = yield* this.evaluate(h.type, scope);
        const wanted = t instanceof PyClass ? t.name : typeName(t);
        // Accept the matching class name, or the catch-all base.
        if (wanted !== thrown.name && wanted !== 'Exception' && wanted !== 'BaseException') {
          continue;
        }
      }
      if (h.name) {
        this.setVar(scope, h.name, thrown.value ?? thrown.message);
      }
      return yield* this.execBlock(h.body, scope);
    }
    return null;
  }

  private makeThrow(exc: PyValue, line: number): PyThrow {
    if (exc instanceof PyInstance) {
      const msg = exc.attrs.get('args');
      return new PyThrow(
        exc,
        line,
        exc.cls?.name ?? exc.typeName,
        msg ? pyStr(msg) : '',
      );
    }
    if (exc instanceof PyClass) return new PyThrow(null, line, exc.name, '');
    return new PyThrow(exc, line, 'Exception', pyStr(exc));
  }

  // ── binding ────────────────────────────────────────────────────────────────

  private setVar(scope: Scope, name: string, value: PyValue) {
    if (scope.globals.has(name)) {
      this.globalScope.vars.set(name, value);
      return;
    }
    scope.vars.set(name, value);
  }

  private *assign(target: PyExpr, value: PyValue, scope: Scope): Generator<PyWait, void, void> {
    if (target.kind === 'Name') {
      this.setVar(scope, target.id, value);
      return;
    }
    if (target.kind === 'Tuple' || target.kind === 'List') {
      const items = asSequence(value);
      if (!items) throw new PyRuntimeError('cannot unpack non-sequence', target.line);
      // A starred target absorbs the remainder.
      const starIndex = target.items.findIndex((t) => t.kind === 'Starred');
      if (starIndex < 0) {
        if (items.length !== target.items.length) {
          throw new PyRuntimeError(
            `expected ${target.items.length} values to unpack, got ${items.length}`,
            target.line,
          );
        }
        for (let i = 0; i < target.items.length; i++) {
          yield* this.assign(target.items[i], items[i], scope);
        }
        return;
      }
      const after = target.items.length - starIndex - 1;
      for (let i = 0; i < starIndex; i++) yield* this.assign(target.items[i], items[i], scope);
      const star = target.items[starIndex] as Extract<PyExpr, { kind: 'Starred' }>;
      yield* this.assign(star.value, new PyList(items.slice(starIndex, items.length - after)), scope);
      for (let i = 0; i < after; i++) {
        yield* this.assign(target.items[starIndex + 1 + i], items[items.length - after + i], scope);
      }
      return;
    }
    if (target.kind === 'Subscript') {
      const obj = yield* this.evaluate(target.obj, scope);
      const key = yield* this.evaluate(target.index, scope);
      if (obj instanceof PyList) {
        const i = normaliseIndex(pyNum(key), obj.items.length);
        if (i < 0 || i >= obj.items.length) {
          throw new PyThrow(null, target.line, 'IndexError', 'list assignment index out of range');
        }
        obj.items[i] = value;
        return;
      }
      if (obj instanceof PyDict) {
        obj.set(key, value);
        return;
      }
      if (obj instanceof PyInstance) {
        const setter = obj.attrs.get('__setitem__');
        if (setter) {
          yield* this.call(setter, [key, value], {}, target.line);
          return;
        }
      }
      throw new PyRuntimeError(`'${typeName(obj)}' does not support item assignment`, target.line);
    }
    if (target.kind === 'Attr') {
      const obj = yield* this.evaluate(target.obj, scope);
      if (obj instanceof PyInstance) {
        obj.attrs.set(target.attr, value);
        return;
      }
      if (obj instanceof PyClass) {
        obj.attrs.set(target.attr, value);
        return;
      }
      throw new PyRuntimeError(`cannot set attribute on '${typeName(obj)}'`, target.line);
    }
    throw new PyRuntimeError('cannot assign to that expression', target.line);
  }

  // ── expressions ────────────────────────────────────────────────────────────

  *evaluate(e: PyExpr, scope: Scope): Generator<PyWait, PyValue, void> {
    switch (e.kind) {
      case 'Num':
        return e.value;
      case 'Str':
        return e.value;
      case 'Const':
        return e.value;

      case 'FStr': {
        let out = '';
        for (const part of e.parts) {
          out += typeof part === 'string' ? part : pyStr(yield* this.evaluate(part, scope));
        }
        return out;
      }

      case 'Name': {
        const found = scope.lookup(e.id);
        if (found) return found.value;
        const builtin = this.builtins.get(e.id);
        if (builtin !== undefined) return builtin;
        throw new PyThrow(null, e.line, 'NameError', `name '${e.id}' is not defined`);
      }

      case 'Tuple': {
        const items: PyValue[] = [];
        for (const it of e.items) items.push(yield* this.evaluate(it, scope));
        return new PyTuple(items);
      }

      case 'List': {
        const items: PyValue[] = [];
        for (const it of e.items) items.push(yield* this.evaluate(it, scope));
        return new PyList(items);
      }

      case 'Set': {
        const items: PyValue[] = [];
        for (const it of e.items) {
          const v = yield* this.evaluate(it, scope);
          if (!items.some((x) => pyEquals(x, v))) items.push(v);
        }
        return new PySet(items);
      }

      case 'Dict': {
        const d = new PyDict();
        for (let i = 0; i < e.keys.length; i++) {
          d.set(yield* this.evaluate(e.keys[i], scope), yield* this.evaluate(e.values[i], scope));
        }
        return d;
      }

      case 'Starred':
        return yield* this.evaluate(e.value, scope);

      case 'Unary': {
        const v = yield* this.evaluate(e.operand, scope);
        if (e.op === 'not') return !truthy(v);
        if (e.op === '-') return -pyNum(v);
        if (e.op === '+') return pyNum(v);
        if (e.op === '~') return ~Math.trunc(pyNum(v));
        return null;
      }

      case 'Binary': {
        const l = yield* this.evaluate(e.left, scope);
        const r = yield* this.evaluate(e.right, scope);
        yield* this.tick(COST.arith);
        return this.binary(e.op, l, r, e.line);
      }

      case 'BoolOp': {
        let last: PyValue = null;
        for (const v of e.values) {
          last = yield* this.evaluate(v, scope);
          const t = truthy(last);
          if (e.op === 'and' && !t) return last;
          if (e.op === 'or' && t) return last;
        }
        return last;
      }

      case 'Compare': {
        let left = yield* this.evaluate(e.left, scope);
        for (let i = 0; i < e.ops.length; i++) {
          const right = yield* this.evaluate(e.comparators[i], scope);
          if (!this.compare(e.ops[i], left, right, e.line)) return false;
          left = right;
        }
        return true;
      }

      case 'IfExp':
        return truthy(yield* this.evaluate(e.test, scope))
          ? yield* this.evaluate(e.body, scope)
          : yield* this.evaluate(e.orelse, scope);

      case 'Lambda':
        return new PyFunction(e as PyLambda, scope, '<lambda>');

      case 'Attr': {
        const obj = yield* this.evaluate(e.obj, scope);
        return this.getAttr(obj, e.attr, e.line);
      }

      case 'Subscript': {
        const obj = yield* this.evaluate(e.obj, scope);
        if (e.index.kind === 'SliceExpr') {
          const lower = e.index.lower ? pyNum(yield* this.evaluate(e.index.lower, scope)) : null;
          const upper = e.index.upper ? pyNum(yield* this.evaluate(e.index.upper, scope)) : null;
          const step = e.index.step ? pyNum(yield* this.evaluate(e.index.step, scope)) : 1;
          return this.slice(obj, lower, upper, step, e.line);
        }
        const key = yield* this.evaluate(e.index, scope);
        return this.subscript(obj, key, e.line);
      }

      case 'Comprehension': {
        const iterable = yield* this.evaluate(e.iter, scope);
        const inner = new Scope(scope);
        const out: PyValue[] = [];
        const pairs: [PyValue, PyValue][] = [];
        for (const item of this.iterate(iterable, e.line)) {
          yield* this.assign(e.target, item, inner);
          if (e.condition && !truthy(yield* this.evaluate(e.condition, inner))) continue;
          if (e.form === 'dict') {
            pairs.push([
              yield* this.evaluate(e.element, inner),
              yield* this.evaluate(e.value!, inner),
            ]);
          } else {
            out.push(yield* this.evaluate(e.element, inner));
          }
          yield* this.tick(COST.loop);
        }
        if (e.form === 'dict') return PyDict.from(pairs);
        if (e.form === 'set') {
          const uniq: PyValue[] = [];
          for (const v of out) if (!uniq.some((x) => pyEquals(x, v))) uniq.push(v);
          return new PySet(uniq);
        }
        return new PyList(out);
      }

      case 'Call': {
        yield* this.tick(COST.call);
        const args: PyValue[] = [];
        for (const a of e.args) {
          const v = yield* this.evaluate(a, scope);
          if (a.kind === 'Starred') {
            const seq = asSequence(v);
            if (seq) args.push(...seq);
            else args.push(v);
          } else {
            args.push(v);
          }
        }
        const kwargs: Record<string, PyValue> = {};
        for (const k of e.keywords) {
          if (k.name) kwargs[k.name] = yield* this.evaluate(k.value, scope);
        }
        const callee = yield* this.evaluate(e.func, scope);
        return yield* this.call(callee, args, kwargs, e.line);
      }
    }
    return null;
  }

  // ── calling ────────────────────────────────────────────────────────────────

  *call(
    callee: PyValue,
    args: PyValue[],
    kwargs: Record<string, PyValue>,
    line: number,
  ): Generator<PyWait, PyValue, void> {
    if (callee instanceof PyNative) {
      const out = callee.fn(args, kwargs);
      return isGen(out) ? yield* out : out;
    }

    if (callee instanceof PyFunction) {
      if (++this.callDepth > 120) {
        this.callDepth = 0;
        throw new PyThrow(null, line, 'RecursionError', 'maximum recursion depth exceeded');
      }
      try {
        const scope = new Scope(
          callee.closure instanceof Scope ? callee.closure : this.globalScope,
          true,
        );
        const params: PyParam[] = callee.def.params;
        const actual = callee.self !== null ? [callee.self, ...args] : args;

        for (let i = 0; i < params.length; i++) {
          const p = params[i];
          if (p.star) {
            scope.vars.set(p.name, new PyTuple(actual.slice(i)));
            break;
          }
          if (i < actual.length) scope.vars.set(p.name, actual[i]);
          else if (p.name in kwargs) scope.vars.set(p.name, kwargs[p.name]);
          else if (p.def) scope.vars.set(p.name, yield* this.evaluate(p.def, scope));
          else {
            throw new PyThrow(
              null,
              line,
              'TypeError',
              `${callee.name}() missing argument '${p.name}'`,
            );
          }
        }
        for (const [k, v] of Object.entries(kwargs)) {
          if (!scope.vars.has(k)) scope.vars.set(k, v);
        }

        if ('body' in callee.def && Array.isArray((callee.def as PyFuncDef).body)) {
          const c = yield* this.execBlock((callee.def as PyFuncDef).body, scope);
          return c.type === 'return' ? c.value : null;
        }
        // lambda
        return yield* this.evaluate((callee.def as PyLambda).body, scope);
      } finally {
        this.callDepth--;
      }
    }

    if (callee instanceof PyClass) {
      const instance = new PyInstance(callee, new Map(), callee.name);
      const init = callee.lookup('__init__');
      if (init instanceof PyFunction) {
        const bound = new PyFunction(init.def, init.closure, init.name, instance);
        yield* this.call(bound, args, kwargs, line);
      } else if (args.length) {
        // Exception-style classes keep their first argument as the message.
        instance.attrs.set('args', args[0]);
      }
      return instance;
    }

    if (callee instanceof PyInstance) {
      // A native object can expose a call target, which is how `Image(...)`
      // works while `Image.HEART` is still an attribute on the same value.
      const call = callee.attrs.get('__call__');
      if (call) return yield* this.call(call, args, kwargs, line);
    }

    throw new PyThrow(null, line, 'TypeError', `'${typeName(callee)}' object is not callable`);
  }

  // ── attributes ─────────────────────────────────────────────────────────────

  getAttr(obj: PyValue, name: string, line: number): PyValue {
    if (obj instanceof PyModule) {
      const v = obj.attrs.get(name);
      if (v === undefined) {
        throw new PyThrow(null, line, 'AttributeError', `module '${obj.name}' has no attribute '${name}'`);
      }
      return v;
    }

    if (obj instanceof PyInstance) {
      if (obj.attrs.has(name)) {
        const v = obj.attrs.get(name)!;
        // A function stored on an instance is already bound (native objects).
        return v;
      }
      const fromClass = obj.cls?.lookup(name);
      if (fromClass instanceof PyFunction) {
        return new PyFunction(fromClass.def, fromClass.closure, fromClass.name, obj);
      }
      if (fromClass !== undefined) return fromClass;
      throw new PyThrow(
        null,
        line,
        'AttributeError',
        `'${obj.cls?.name ?? obj.typeName}' object has no attribute '${name}'`,
      );
    }

    if (obj instanceof PyClass) {
      const v = obj.lookup(name);
      if (v === undefined) {
        throw new PyThrow(null, line, 'AttributeError', `type object '${obj.name}' has no attribute '${name}'`);
      }
      return v;
    }

    const builtin = this.primitiveMethod(obj, name);
    if (builtin) return builtin;

    throw new PyThrow(
      null,
      line,
      'AttributeError',
      `'${typeName(obj)}' object has no attribute '${name}'`,
    );
  }

  /** Methods on str, list, dict, set and tuple. */
  private primitiveMethod(obj: PyValue, name: string): PyValue | null {
    const wrap = (fn: (args: PyValue[]) => PyValue) => new PyNative(name, (args) => fn(args));

    if (typeof obj === 'string') {
      const s = obj;
      switch (name) {
        case 'upper': return wrap(() => s.toUpperCase());
        case 'lower': return wrap(() => s.toLowerCase());
        case 'strip': return wrap((a) => (a[0] ? trimChars(s, pyStr(a[0]), 'both') : s.trim()));
        case 'lstrip': return wrap((a) => (a[0] ? trimChars(s, pyStr(a[0]), 'start') : s.replace(/^\s+/, '')));
        case 'rstrip': return wrap((a) => (a[0] ? trimChars(s, pyStr(a[0]), 'end') : s.replace(/\s+$/, '')));
        case 'split':
          return wrap((a) =>
            new PyList((a[0] === undefined ? s.trim().split(/\s+/) : s.split(pyStr(a[0]))).filter((x) => x !== '' || a[0] !== undefined)),
          );
        case 'join':
          return wrap((a) => (asSequence(a[0]) ?? []).map(pyStr).join(s));
        case 'replace': return wrap((a) => s.split(pyStr(a[0])).join(pyStr(a[1])));
        case 'startswith': return wrap((a) => s.startsWith(pyStr(a[0])));
        case 'endswith': return wrap((a) => s.endsWith(pyStr(a[0])));
        case 'find': return wrap((a) => s.indexOf(pyStr(a[0])));
        case 'index': return wrap((a) => s.indexOf(pyStr(a[0])));
        case 'count': return wrap((a) => s.split(pyStr(a[0])).length - 1);
        case 'format':
          return wrap((a) => {
            let i = 0;
            return s.replace(/\{[^}]*\}/g, () => pyStr(a[i++]));
          });
        case 'isdigit': return wrap(() => /^[0-9]+$/.test(s));
        case 'isalpha': return wrap(() => /^[A-Za-z]+$/.test(s));
        case 'isspace': return wrap(() => /^\s+$/.test(s));
      }
      return null;
    }

    if (obj instanceof PyList) {
      const l = obj;
      switch (name) {
        case 'append': return wrap((a) => (l.items.push(a[0]), null));
        case 'extend': return wrap((a) => (l.items.push(...(asSequence(a[0]) ?? [])), null));
        case 'insert': return wrap((a) => (l.items.splice(pyNum(a[0]), 0, a[1]), null));
        case 'pop':
          return wrap((a) => {
            const i = a[0] === undefined ? l.items.length - 1 : normaliseIndex(pyNum(a[0]), l.items.length);
            return l.items.splice(i, 1)[0] ?? null;
          });
        case 'remove':
          return wrap((a) => {
            const i = l.items.findIndex((x) => pyEquals(x, a[0]));
            if (i >= 0) l.items.splice(i, 1);
            return null;
          });
        case 'clear': return wrap(() => ((l.items.length = 0), null));
        case 'index': return wrap((a) => l.items.findIndex((x) => pyEquals(x, a[0])));
        case 'count': return wrap((a) => l.items.filter((x) => pyEquals(x, a[0])).length);
        case 'reverse': return wrap(() => (l.items.reverse(), null));
        case 'sort': return wrap(() => (l.items.sort(compareValues), null));
        case 'copy': return wrap(() => new PyList([...l.items]));
      }
      return null;
    }

    if (obj instanceof PyDict) {
      const d = obj;
      switch (name) {
        case 'get': return wrap((a) => d.get(a[0]) ?? (a[1] ?? null));
        case 'keys': return wrap(() => new PyList(d.keys()));
        case 'values': return wrap(() => new PyList(d.values()));
        case 'items': return wrap(() => new PyList(d.entries().map(([k, v]) => new PyTuple([k, v]))));
        case 'pop':
          return wrap((a) => {
            const v = d.get(a[0]) ?? (a[1] ?? null);
            d.delete(a[0]);
            return v;
          });
        case 'update':
          return wrap((a) => {
            if (a[0] instanceof PyDict) for (const [k, v] of a[0].entries()) d.set(k, v);
            return null;
          });
        case 'clear': return wrap(() => (d.map.clear(), null));
        case 'setdefault':
          return wrap((a) => {
            if (!d.has(a[0])) d.set(a[0], a[1] ?? null);
            return d.get(a[0])!;
          });
      }
      return null;
    }

    if (obj instanceof PySet) {
      const st = obj;
      switch (name) {
        case 'add':
          return wrap((a) => {
            if (!st.items.some((x) => pyEquals(x, a[0]))) st.items.push(a[0]);
            return null;
          });
        case 'discard':
        case 'remove':
          return wrap((a) => {
            const i = st.items.findIndex((x) => pyEquals(x, a[0]));
            if (i >= 0) st.items.splice(i, 1);
            return null;
          });
        case 'clear': return wrap(() => ((st.items.length = 0), null));
      }
      return null;
    }

    if (obj instanceof PyTuple) {
      switch (name) {
        case 'count': return wrap((a) => obj.items.filter((x) => pyEquals(x, a[0])).length);
        case 'index': return wrap((a) => obj.items.findIndex((x) => pyEquals(x, a[0])));
      }
    }

    return null;
  }

  // ── operators ──────────────────────────────────────────────────────────────

  binary(op: string, l: PyValue, r: PyValue, line: number): PyValue {
    if (op === '+') {
      if (typeof l === 'string' || typeof r === 'string') {
        if (typeof l === 'string' && typeof r === 'string') return l + r;
        throw new PyThrow(
          null,
          line,
          'TypeError',
          `can only concatenate str to str, not ${typeName(typeof l === 'string' ? r : l)}`,
        );
      }
      if (l instanceof PyList && r instanceof PyList) return new PyList([...l.items, ...r.items]);
      if (l instanceof PyTuple && r instanceof PyTuple) return new PyTuple([...l.items, ...r.items]);
    }
    if (op === '*') {
      if (typeof l === 'string' && typeof r === 'number') return l.repeat(Math.max(0, Math.trunc(r)));
      if (typeof r === 'string' && typeof l === 'number') return r.repeat(Math.max(0, Math.trunc(l)));
      if (l instanceof PyList && typeof r === 'number') {
        const out: PyValue[] = [];
        for (let i = 0; i < Math.max(0, Math.trunc(r)); i++) out.push(...l.items);
        return new PyList(out);
      }
    }
    if (op === '%' && typeof l === 'string') {
      // Old-style formatting: '%d %s' % (a, b)
      const args = r instanceof PyTuple ? r.items : [r];
      let i = 0;
      return l.replace(/%[-0-9.]*[dsfixX%]/g, (m) => {
        if (m.endsWith('%')) return '%';
        const v = args[i++];
        if (m.endsWith('d') || m.endsWith('i')) return String(Math.trunc(pyNum(v)));
        if (m.endsWith('f')) {
          const prec = /\.(\d+)/.exec(m);
          return pyNum(v).toFixed(prec ? Number(prec[1]) : 6);
        }
        if (m.endsWith('x')) return (Math.trunc(pyNum(v)) >>> 0).toString(16);
        if (m.endsWith('X')) return (Math.trunc(pyNum(v)) >>> 0).toString(16).toUpperCase();
        return pyStr(v);
      });
    }

    const a = pyNum(l);
    const b = pyNum(r);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/':
        if (b === 0) throw new PyThrow(null, line, 'ZeroDivisionError', 'division by zero');
        return a / b;
      case '//':
        if (b === 0) throw new PyThrow(null, line, 'ZeroDivisionError', 'integer division or modulo by zero');
        return Math.floor(a / b);
      case '%':
        if (b === 0) throw new PyThrow(null, line, 'ZeroDivisionError', 'integer division or modulo by zero');
        // Python's modulo takes the sign of the divisor.
        return ((a % b) + b) % b;
      case '**': return Math.pow(a, b);
      case '&': return Math.trunc(a) & Math.trunc(b);
      case '|': return Math.trunc(a) | Math.trunc(b);
      case '^': return Math.trunc(a) ^ Math.trunc(b);
      case '<<': return Math.trunc(a) << Math.trunc(b);
      case '>>': return Math.trunc(a) >> Math.trunc(b);
    }
    throw new PyRuntimeError(`unsupported operator '${op}'`, line);
  }

  private compare(op: string, l: PyValue, r: PyValue, line: number): boolean {
    switch (op) {
      case '==': return pyEquals(l, r);
      case '!=': return !pyEquals(l, r);
      case 'is': return l === r || (l === null && r === null);
      case 'is not': return !(l === r || (l === null && r === null));
      case 'in': return this.contains(r, l, line);
      case 'not in': return !this.contains(r, l, line);
    }
    if (typeof l === 'string' && typeof r === 'string') {
      switch (op) {
        case '<': return l < r;
        case '<=': return l <= r;
        case '>': return l > r;
        case '>=': return l >= r;
      }
    }
    const a = pyNum(l);
    const b = pyNum(r);
    switch (op) {
      case '<': return a < b;
      case '<=': return a <= b;
      case '>': return a > b;
      case '>=': return a >= b;
    }
    return false;
  }

  private contains(container: PyValue, item: PyValue, line: number): boolean {
    if (typeof container === 'string') return container.includes(pyStr(item));
    if (container instanceof PyDict) return container.has(item);
    const seq = asSequence(container);
    if (seq) return seq.some((x) => pyEquals(x, item));
    throw new PyRuntimeError(`argument of type '${typeName(container)}' is not iterable`, line);
  }

  // ── sequences ──────────────────────────────────────────────────────────────

  iterate(v: PyValue, line: number): PyValue[] {
    const seq = asSequence(v);
    if (seq) return [...seq];
    if (v instanceof PyInstance) {
      const items = v.attrs.get('__items__');
      const s = asSequence(items ?? null);
      if (s) return [...s];
    }
    throw new PyThrow(null, line, 'TypeError', `'${typeName(v)}' object is not iterable`);
  }

  subscript(obj: PyValue, key: PyValue, line: number): PyValue {
    if (obj instanceof PyInstance) {
      // Native sequence-like objects publish their contents here.
      const items = obj.attrs.get('__items__');
      const seq = asSequence(items ?? null);
      if (seq) {
        const i = normaliseIndex(Math.trunc(pyNum(key)), seq.length);
        if (i < 0 || i >= seq.length) {
          throw new PyThrow(null, line, 'IndexError', 'index out of range');
        }
        return seq[i];
      }
    }
    if (obj instanceof PyDict) {
      if (!obj.has(key)) throw new PyThrow(null, line, 'KeyError', pyRepr(key));
      return obj.get(key)!;
    }
    const seq = asSequence(obj);
    if (!seq) throw new PyThrow(null, line, 'TypeError', `'${typeName(obj)}' object is not subscriptable`);
    const i = normaliseIndex(Math.trunc(pyNum(key)), seq.length);
    if (i < 0 || i >= seq.length) {
      throw new PyThrow(null, line, 'IndexError', `${typeName(obj)} index out of range`);
    }
    return typeof obj === 'string' ? obj[i] : seq[i];
  }

  slice(obj: PyValue, lower: number | null, upper: number | null, step: number, line: number): PyValue {
    const seq = asSequence(obj);
    if (!seq) throw new PyThrow(null, line, 'TypeError', `'${typeName(obj)}' object is not subscriptable`);
    const len = seq.length;
    const st = step || 1;
    let lo = lower === null ? (st > 0 ? 0 : len - 1) : normaliseIndex(Math.trunc(lower), len);
    let hi = upper === null ? (st > 0 ? len : -1) : normaliseIndex(Math.trunc(upper), len);
    lo = st > 0 ? Math.max(0, Math.min(lo, len)) : Math.max(-1, Math.min(lo, len - 1));
    hi = st > 0 ? Math.max(0, Math.min(hi, len)) : Math.max(-1, Math.min(hi, len - 1));

    const out: PyValue[] = [];
    if (st > 0) for (let i = lo; i < hi; i += st) out.push(seq[i]);
    else for (let i = lo; i > hi; i += st) out.push(seq[i]);

    if (typeof obj === 'string') return out.join('');
    if (obj instanceof PyTuple) return new PyTuple(out);
    return new PyList(out);
  }

  // ── debugging ──────────────────────────────────────────────────────────────

  private snapshotScope(scope: Scope): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    let s: Scope | null = scope;
    while (s) {
      s.vars.forEach((v, k) => {
        if (k in out) return;
        if (v instanceof PyFunction || v instanceof PyNative || v instanceof PyModule) return;
        out[k] = typeof v === 'object' && v !== null ? pyStr(v) : v;
      });
      s = s.parent;
    }
    return out;
  }

  /** Read a module-level name — used by tests and the debugger. */
  peekGlobal(name: string): PyValue | undefined {
    return this.globalScope.vars.get(name);
  }

  get globals() {
    return this.globalScope;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isGen(v: unknown): v is Generator<PyWait, PyValue, void> {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { next?: unknown }).next === 'function' &&
    typeof (v as { throw?: unknown }).throw === 'function'
  );
}

function compareValues(a: PyValue, b: PyValue): number {
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  const x = pyNum(a);
  const y = pyNum(b);
  return x - y;
}

function trimChars(s: string, chars: string, side: 'start' | 'end' | 'both') {
  const set = new Set([...chars]);
  let a = 0;
  let b = s.length;
  if (side !== 'end') while (a < b && set.has(s[a])) a++;
  if (side !== 'start') while (b > a && set.has(s[b - 1])) b--;
  return s.slice(a, b);
}

export { PyThrow };
