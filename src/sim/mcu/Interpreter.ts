import type {
  BlockStmt,
  Expr,
  FuncDecl,
  Program,
  Stmt,
  StructDecl,
  TypeRef,
} from './ast';
import { parseSketch, type ParseError } from './parser';
import {
  ArduinoArray,
  coerce,
  formatNumber,
  ObjectValue,
  StructValue,
  toBool,
  toNum,
  toStr,
  type Ref,
  type Value,
  type Wait,
} from './values';

export type { Wait };

/** After this many accumulated cycles the VM hands control back. */
const QUANTUM = 512;

/** A crude but stable cost model — enough to pace a sketch against real time. */
const COST = { stmt: 3, call: 12, loop: 6, arith: 1 };

export const CPU_HZ = 16_000_000;

type Completion =
  | { type: 'normal' }
  | { type: 'break' }
  | { type: 'continue' }
  | { type: 'return'; value: Value };

const NORMAL: Completion = { type: 'normal' };

export type NativeFn = (
  args: Value[],
  interp: Interpreter,
) => Value | Generator<Wait, Value, void>;

class Scope {
  vars = new Map<string, { value: Value; type: TypeRef }>();
  constructor(readonly parent: Scope | null) {}

  lookup(name: string): { value: Value; type: TypeRef } | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let s: Scope | null = this;
    while (s) {
      const v = s.vars.get(name);
      if (v) return v;
      s = s.parent;
    }
    return undefined;
  }

  declare(name: string, value: Value, type: TypeRef) {
    this.vars.set(name, { value, type });
  }
}

export class RuntimeError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
}

/**
 * Tree-walking VM for the parsed sketch.
 *
 * Execution is a generator so `delay()` can suspend mid-expression and resume
 * on the next simulation tick without a worker or a callback rewrite. The
 * driver pumps it with a cycle budget derived from how much simulated time has
 * elapsed, which keeps sketch time locked to circuit time.
 */
export class Interpreter {
  private program: Program = { body: [], includes: [] };
  private functions = new Map<string, FuncDecl>();
  private structs = new Map<string, StructDecl>();
  private globals = new Scope(null);
  private staticStore = new Map<string, { value: Value; type: TypeRef }>();

  /** Native Arduino API, installed by the runtime module. */
  natives = new Map<string, NativeFn>();
  /** Constructors for library classes: Servo, LiquidCrystal, … */
  classFactories = new Map<string, (args: Value[], interp: Interpreter) => ObjectValue>();
  /** Constants: HIGH, LOW, INPUT, A0, … */
  constants = new Map<string, Value>();

  parseErrors: ParseError[] = [];
  runtimeError: { message: string; line: number } | null = null;

  private pending = 0;
  /**
   * Unspent (or overspent) cycles carried between `run` calls. A `delay()`
   * yields far more cycles than one timestep's budget, so the surplus has to be
   * carried as debt — dropping it made every delay finish in a single step and
   * the sketch ran about twenty times faster than the circuit.
   */
  private credit = 0;
  private task: Generator<Wait, void, void> | null = null;
  private setupDone = false;
  private callDepth = 0;

  /** Line currently executing — surfaced to the debugger. */
  currentLine = 0;
  /** Lines the user marked as breakpoints. */
  breakpoints = new Set<number>();
  /** Set when execution is parked on a breakpoint. */
  paused: { line: number; scope: Record<string, unknown> } | null = null;
  /** Set by `step()`: park again on the next statement, wherever it is. */
  private stepping = false;

  // ── loading ────────────────────────────────────────────────────────────────

  load(source: string): ParseError[] {
    const { program, errors } = parseSketch(source);
    this.program = program;
    this.parseErrors = errors;
    this.functions.clear();
    this.structs.clear();
    for (const item of program.body) {
      if (item.kind === 'Func' && item.body) this.functions.set(item.name, item);
      if (item.kind === 'Struct') this.structs.set(item.name, item);
    }
    if (!errors.length) {
      if (!this.functions.has('setup')) {
        errors.push({ line: 1, message: "expected a 'void setup()' function" });
      }
      if (!this.functions.has('loop')) {
        errors.push({ line: 1, message: "expected a 'void loop()' function" });
      }
    }
    return errors;
  }

  reset() {
    this.globals = new Scope(null);
    this.staticStore.clear();
    this.task = null;
    this.setupDone = false;
    this.pending = 0;
    this.credit = 0;
    this.runtimeError = null;
    this.paused = null;
    this.currentLine = 0;
  }

  get includes() {
    return this.program.includes;
  }

  // ── driving ────────────────────────────────────────────────────────────────

  /** Advance the sketch by `cycles` CPU cycles of simulated time. */
  run(cycles: number) {
    if (this.runtimeError || this.paused) return;
    this.credit += cycles;
    // Cap the backlog so a sketch that was paused (or a slow frame) does not
    // then sprint to catch up.
    if (this.credit > CPU_HZ) this.credit = CPU_HZ;
    let guard = 0;

    while (this.credit > 0) {
      if (++guard > 20000) return; // never wedge a frame
      if (!this.task) this.task = this.mainTask();
      try {
        const r = this.task.next();
        if (r.done) {
          this.task = null;
          continue;
        }
        this.credit -= Math.max(1, r.value.cycles);
      } catch (e) {
        if (e instanceof RuntimeError) {
          this.runtimeError = { message: e.message, line: e.line };
        } else {
          this.runtimeError = {
            message: e instanceof Error ? e.message : String(e),
            line: this.currentLine,
          };
        }
        this.task = null;
        return;
      }
      if (this.paused) return;
    }
  }

  /** Resume after a breakpoint. */
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

  private *mainTask(): Generator<Wait, void, void> {
    if (!this.setupDone) {
      yield* this.initGlobals();
      const setup = this.functions.get('setup');
      if (setup) yield* this.callUser(setup, []);
      this.setupDone = true;
    }
    const loop = this.functions.get('loop');
    if (!loop) {
      yield { cycles: CPU_HZ };
      return;
    }
    for (;;) {
      yield* this.callUser(loop, []);
      yield* this.tick(COST.loop);
    }
  }

  private *initGlobals(): Generator<Wait, void, void> {
    for (const item of this.program.body) {
      if (item.kind === 'Enum') {
        for (const m of item.members) this.constants.set(m.name, m.value);
      }
    }
    for (const item of this.program.body) {
      if (item.kind !== 'VarDecl') continue;
      yield* this.execVarDecl(item, this.globals);
    }
  }

  // ── statements ─────────────────────────────────────────────────────────────

  private *tick(n: number): Generator<Wait, void, void> {
    this.pending += n;
    if (this.pending >= QUANTUM) {
      const c = this.pending;
      this.pending = 0;
      yield { cycles: c };
    }
  }

  /** Suspend for a precise number of cycles (delay, tone duration…). */
  *sleepCycles(cycles: number): Generator<Wait, void, void> {
    const total = cycles + this.pending;
    this.pending = 0;
    let left = total;
    // Split long sleeps into roughly one simulation timestep each, so the
    // circuit is re-solved while the sketch waits and an output change lands in
    // the step it actually belongs to.
    while (left > 0) {
      const chunk = Math.min(left, CPU_HZ / 1000);
      left -= chunk;
      yield { cycles: chunk };
    }
  }

  private *execBlock(block: BlockStmt, parent: Scope): Generator<Wait, Completion, void> {
    const scope = new Scope(parent);
    for (const s of block.body) {
      const c = yield* this.exec(s, scope);
      if (c.type !== 'normal') return c;
    }
    return NORMAL;
  }

  private *exec(s: Stmt, scope: Scope): Generator<Wait, Completion, void> {
    this.currentLine = s.line;
    if ((this.breakpoints.has(s.line) || this.stepping) && !this.paused) {
      this.stepping = false;
      this.paused = { line: s.line, scope: this.snapshotScope(scope) };
      yield { cycles: 1 };
    }
    yield* this.tick(COST.stmt);

    switch (s.kind) {
      case 'Block':
        return yield* this.execBlock(s, scope);

      case 'Empty':
        return NORMAL;

      case 'ExprStmt':
        yield* this.eval(s.expression, scope);
        return NORMAL;

      case 'VarDecl':
        yield* this.execVarDecl(s, scope);
        return NORMAL;

      case 'If': {
        if (toBool(yield* this.eval(s.test, scope))) return yield* this.exec(s.then, scope);
        if (s.else) return yield* this.exec(s.else, scope);
        return NORMAL;
      }

      case 'While': {
        let guard = 0;
        while (toBool(yield* this.eval(s.test, scope))) {
          const c = yield* this.exec(s.body, scope);
          if (c.type === 'break') break;
          if (c.type === 'return') return c;
          yield* this.tick(COST.loop);
          if (++guard > 1e7) throw new RuntimeError('Loop ran too long', s.line);
        }
        return NORMAL;
      }

      case 'DoWhile': {
        let guard = 0;
        do {
          const c = yield* this.exec(s.body, scope);
          if (c.type === 'break') break;
          if (c.type === 'return') return c;
          yield* this.tick(COST.loop);
          if (++guard > 1e7) throw new RuntimeError('Loop ran too long', s.line);
        } while (toBool(yield* this.eval(s.test, scope)));
        return NORMAL;
      }

      case 'For': {
        const inner = new Scope(scope);
        if (s.init) yield* this.exec(s.init, inner);
        let guard = 0;
        for (;;) {
          if (s.test && !toBool(yield* this.eval(s.test, inner))) break;
          const c = yield* this.exec(s.body, inner);
          if (c.type === 'break') break;
          if (c.type === 'return') return c;
          if (s.update) yield* this.eval(s.update, inner);
          yield* this.tick(COST.loop);
          if (++guard > 1e7) throw new RuntimeError('Loop ran too long', s.line);
        }
        return NORMAL;
      }

      case 'Switch': {
        const disc = toNum(yield* this.eval(s.disc, scope));
        const inner = new Scope(scope);
        let matched = -1;
        for (let i = 0; i < s.cases.length; i++) {
          const cse = s.cases[i];
          if (cse.test === null) continue;
          if (toNum(yield* this.eval(cse.test, inner)) === disc) {
            matched = i;
            break;
          }
        }
        if (matched < 0) matched = s.cases.findIndex((c) => c.test === null);
        if (matched < 0) return NORMAL;
        // Fall through subsequent cases, as C does.
        for (let i = matched; i < s.cases.length; i++) {
          for (const st of s.cases[i].body) {
            const c = yield* this.exec(st, inner);
            if (c.type === 'break') return NORMAL;
            if (c.type === 'return') return c;
            if (c.type === 'continue') return c;
          }
        }
        return NORMAL;
      }

      case 'Break':
        return { type: 'break' };
      case 'Continue':
        return { type: 'continue' };
      case 'Return':
        return {
          type: 'return',
          value: s.argument ? yield* this.eval(s.argument, scope) : null,
        };
    }
    return NORMAL;
  }

  private *execVarDecl(s: Stmt & { kind: 'VarDecl' }, scope: Scope): Generator<Wait, void, void> {
    for (const d of s.decls) {
      const key = `${s.line}:${d.name}`;
      if (s.isStatic) {
        const held = this.staticStore.get(key);
        if (held) {
          scope.vars.set(d.name, held);
          continue;
        }
      }

      let value: Value;
      if (d.type.dims.length) {
        value = yield* this.makeArray(d, scope);
      } else if (d.init) {
        value = yield* this.eval(d.init, scope);
        value = coerce(value, d.type.name, d.type.unsigned);
      } else if (this.classFactories.has(d.type.name)) {
        value = this.classFactories.get(d.type.name)!([], this);
      } else if (this.structs.has(d.type.name)) {
        value = this.makeStruct(d.type.name);
      } else {
        value = d.type.name === 'String' ? '' : 0;
      }

      const slot = { value, type: d.type };
      scope.vars.set(d.name, slot);
      if (s.isStatic) this.staticStore.set(key, slot);
    }
  }

  private *makeArray(
    d: { name: string; type: TypeRef; init: Expr | null },
    scope: Scope,
  ): Generator<Wait, Value, void> {
    const dim = d.type.dims[0];
    let size = dim ? toNum(yield* this.eval(dim, scope)) : 0;
    let items: Value[] = [];

    if (d.init) {
      if (d.init.kind === 'InitList') {
        for (const it of d.init.items) items.push(yield* this.eval(it, scope));
      } else {
        const v = yield* this.eval(d.init, scope);
        if (typeof v === 'string') {
          items = [...v].map((ch) => ch.charCodeAt(0));
          items.push(0);
        } else if (v instanceof ArduinoArray) {
          items = [...v.items];
        }
      }
    }
    if (!size) size = items.length;
    while (items.length < size) items.push(d.type.name === 'String' ? '' : 0);
    return new ArduinoArray(
      items.map((v) => coerce(v, d.type.name, d.type.unsigned)),
      d.type.name,
    );
  }

  private makeStruct(name: string): StructValue {
    const def = this.structs.get(name);
    const fields = new Map<string, Value>();
    for (const f of def?.fields ?? []) {
      fields.set(f.name, f.type.name === 'String' ? '' : 0);
    }
    return new StructValue(name, fields);
  }

  // ── expressions ────────────────────────────────────────────────────────────

  *eval(e: Expr, scope: Scope): Generator<Wait, Value, void> {
    switch (e.kind) {
      case 'Num':
        return e.value;
      case 'Str':
        return e.value;

      case 'Ident': {
        const slot = scope.lookup(e.name);
        if (slot) return slot.value;
        if (this.constants.has(e.name)) return this.constants.get(e.name)!;
        // A bare function name used as a value (rare): return 0.
        if (this.functions.has(e.name) || this.natives.has(e.name)) return 0;
        throw new RuntimeError(`'${e.name}' was not declared in this scope`, e.line);
      }

      case 'InitList': {
        const items: Value[] = [];
        for (const it of e.items) items.push(yield* this.eval(it, scope));
        return new ArduinoArray(items, 'int');
      }

      case 'Index': {
        const obj = yield* this.eval(e.object, scope);
        const idx = toNum(yield* this.eval(e.index, scope));
        if (obj instanceof ArduinoArray) {
          if (idx < 0 || idx >= obj.items.length) {
            throw new RuntimeError(
              `Array index ${idx} is out of bounds (size ${obj.items.length})`,
              e.line,
            );
          }
          return obj.items[idx];
        }
        if (typeof obj === 'string') return obj.charCodeAt(idx) || 0;
        return 0;
      }

      case 'Member': {
        const obj = yield* this.eval(e.object, scope);
        if (obj instanceof StructValue) return obj.fields.get(e.property) ?? 0;
        if (obj instanceof ObjectValue) return 0;
        return 0;
      }

      case 'Cast': {
        const v = yield* this.eval(e.argument, scope);
        return coerce(v, e.type.name, e.type.unsigned);
      }

      case 'Sizeof': {
        if (e.argument) {
          const v = yield* this.eval(e.argument, scope);
          if (v instanceof ArduinoArray) return v.items.length * sizeOfType(v.elemType);
          if (typeof v === 'string') return v.length + 1;
          return 2;
        }
        const base = sizeOfType(e.type?.name ?? 'int');
        let count = 1;
        for (const d of e.type?.dims ?? []) {
          if (d) count *= toNum(yield* this.eval(d, scope));
        }
        return base * count;
      }

      case 'Unary': {
        if (e.op === '&' || e.op === '*') return yield* this.eval(e.argument, scope);
        const v = yield* this.eval(e.argument, scope);
        switch (e.op) {
          case '-': return -toNum(v);
          case '+': return toNum(v);
          case '!': return toBool(v) ? 0 : 1;
          case '~': return ~Math.trunc(toNum(v));
        }
        return 0;
      }

      case 'Update': {
        const ref = yield* this.reference(e.argument, scope);
        const old = toNum(ref.get());
        const next = e.op === '++' ? old + 1 : old - 1;
        ref.set(next);
        return e.prefix ? next : old;
      }

      case 'Logical': {
        const l = yield* this.eval(e.left, scope);
        if (e.op === '&&') {
          if (!toBool(l)) return 0;
          return toBool(yield* this.eval(e.right, scope)) ? 1 : 0;
        }
        if (toBool(l)) return 1;
        return toBool(yield* this.eval(e.right, scope)) ? 1 : 0;
      }

      case 'Cond':
        return toBool(yield* this.eval(e.test, scope))
          ? yield* this.eval(e.then, scope)
          : yield* this.eval(e.else, scope);

      case 'Binary': {
        const l = yield* this.eval(e.left, scope);
        const r = yield* this.eval(e.right, scope);
        yield* this.tick(COST.arith);
        return binary(e.op, l, r, e.line, isRealExpr(e.left, scope) || isRealExpr(e.right, scope));
      }

      case 'Assign': {
        const ref = yield* this.reference(e.target, scope);
        let v = yield* this.eval(e.value, scope);
        if (e.op !== '=') {
          v = binary(
            e.op.slice(0, -1),
            ref.get(),
            v,
            e.line,
            isRealExpr(e.target, scope) || isRealExpr(e.value, scope),
          );
        }
        ref.set(v);
        return v;
      }

      case 'Call':
        return yield* this.evalCall(e, scope);
    }
    return 0;
  }

  private *evalCall(
    e: Expr & { kind: 'Call' },
    scope: Scope,
  ): Generator<Wait, Value, void> {
    yield* this.tick(COST.call);

    // Method call: obj.method(args)
    if (e.callee.kind === 'Member') {
      const obj = yield* this.eval(e.callee.object, scope);
      const args: Value[] = [];
      for (const a of e.args) args.push(yield* this.eval(a, scope));

      if (obj instanceof ObjectValue) {
        const fn = obj.methods[e.callee.property];
        if (!fn) {
          throw new RuntimeError(
            `'${obj.className}' has no method '${e.callee.property}'`,
            e.line,
          );
        }
        const out = fn(args);
        return isGen(out) ? yield* out : out;
      }
      // String methods
      if (typeof obj === 'string' || typeof obj === 'number') {
        return stringMethod(obj, e.callee.property, args, e.line);
      }
      if (obj instanceof ArduinoArray) {
        if (e.callee.property === 'length') return obj.length;
      }
      return 0;
    }

    if (e.callee.kind !== 'Ident') return 0;
    const name = e.callee.name;

    // Library constructor used as an initialiser: Servo s(9);
    if (name.startsWith('__construct_')) {
      const cls = name.slice('__construct_'.length);
      const args: Value[] = [];
      for (const a of e.args) args.push(yield* this.eval(a, scope));
      const factory = this.classFactories.get(cls);
      if (factory) return factory(args, this);
      if (this.structs.has(cls)) return this.makeStruct(cls);
      if (cls === 'String') return toStr(args[0] ?? '');
      return 0;
    }

    const user = this.functions.get(name);
    if (user) {
      const args: Value[] = [];
      const refs: (Ref | null)[] = [];
      for (let i = 0; i < e.args.length; i++) {
        const p = user.params[i];
        if (p?.byRef && isLValue(e.args[i])) {
          const r = yield* this.reference(e.args[i], scope);
          refs.push(r);
          args.push(r.get());
        } else {
          refs.push(null);
          args.push(yield* this.eval(e.args[i], scope));
        }
      }
      const result = yield* this.callUser(user, args, refs);
      return result;
    }

    const native = this.natives.get(name);
    if (native) {
      const args: Value[] = [];
      for (const a of e.args) args.push(yield* this.eval(a, scope));
      const out = native(args, this);
      return isGen(out) ? yield* out : out;
    }

    throw new RuntimeError(`'${name}' was not declared in this scope`, e.line);
  }

  private *callUser(
    fn: FuncDecl,
    args: Value[],
    refs?: (Ref | null)[],
  ): Generator<Wait, Value, void> {
    if (++this.callDepth > 200) {
      this.callDepth = 0;
      throw new RuntimeError('Too much recursion', fn.line);
    }
    const scope = new Scope(this.globals);
    fn.params.forEach((p, i) => {
      scope.declare(p.name, coerce(args[i] ?? 0, p.type.name, p.type.unsigned), p.type);
    });

    let out: Value = 0;
    try {
      const c = fn.body ? yield* this.execBlock(fn.body, scope) : NORMAL;
      if (c.type === 'return') out = c.value;
    } finally {
      this.callDepth--;
      // Copy back reference parameters.
      refs?.forEach((r, i) => {
        if (!r) return;
        const p = fn.params[i];
        const slot = scope.vars.get(p.name);
        if (slot) r.set(slot.value);
      });
    }
    return coerce(out, fn.returnType.name, fn.returnType.unsigned);
  }

  // ── lvalues ────────────────────────────────────────────────────────────────

  private *reference(e: Expr, scope: Scope): Generator<Wait, Ref, void> {
    if (e.kind === 'Ident') {
      const slot = scope.lookup(e.name);
      if (!slot) throw new RuntimeError(`'${e.name}' was not declared in this scope`, e.line);
      return {
        get: () => slot.value,
        set: (v) => {
          slot.value = coerce(v, slot.type.name, slot.type.unsigned);
        },
      };
    }
    if (e.kind === 'Index') {
      const obj = yield* this.eval(e.object, scope);
      const idx = toNum(yield* this.eval(e.index, scope));
      if (obj instanceof ArduinoArray) {
        if (idx < 0 || idx >= obj.items.length) {
          throw new RuntimeError(
            `Array index ${idx} is out of bounds (size ${obj.items.length})`,
            e.line,
          );
        }
        return {
          get: () => obj.items[idx],
          set: (v) => {
            obj.items[idx] = coerce(v, obj.elemType, false);
          },
        };
      }
      return { get: () => 0, set: () => {} };
    }
    if (e.kind === 'Member') {
      const obj = yield* this.eval(e.object, scope);
      if (obj instanceof StructValue) {
        return {
          get: () => obj.fields.get(e.property) ?? 0,
          set: (v) => obj.fields.set(e.property, v),
        };
      }
      return { get: () => 0, set: () => {} };
    }
    if (e.kind === 'Unary' && (e.op === '*' || e.op === '&')) {
      return yield* this.reference(e.argument, scope);
    }
    // Not assignable: evaluate for effect and discard writes.
    const v = yield* this.eval(e, scope);
    return { get: () => v, set: () => {} };
  }

  private snapshotScope(scope: Scope): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    let s: Scope | null = scope;
    while (s) {
      s.vars.forEach((slot, name) => {
        if (name in out) return;
        out[name] =
          slot.value instanceof ArduinoArray
            ? slot.value.items.map((x) => (typeof x === 'number' ? x : toStr(x)))
            : slot.value instanceof StructValue || slot.value instanceof ObjectValue
              ? `<${slot.type.name}>`
              : slot.value;
      });
      s = s.parent;
    }
    return out;
  }

  /** Read a global by name — used by the debugger's variable inspector. */
  peekGlobal(name: string): Value | undefined {
    return this.globals.lookup(name)?.value;
  }
}

/** Type names that make an expression floating point in C. */
const REAL_TYPES = new Set(['float', 'double']);

/** Library functions that return a double, so their results divide as reals. */
const REAL_FUNCTIONS = new Set([
  'sqrt', 'pow', 'sin', 'cos', 'tan', 'log', 'log10', 'exp', 'atan2', 'asin',
  'acos', 'atan', 'fabs', 'floor', 'ceil', 'fmod', 'radians', 'degrees',
]);

/**
 * Whether an expression has a floating-point type.
 *
 * Only division needs this, but it needs it badly: `analogRead(A0) * (5.0 /
 * 1023.0)` is the single most common line in an Arduino sketch, and truncating
 * that inner division to zero silently ruins every reading built on it.
 */
function isRealExpr(e: Expr, scope: Scope): boolean {
  switch (e.kind) {
    case 'Num':
      return !e.isInt;
    case 'Ident':
      return REAL_TYPES.has(scope.lookup(e.name)?.type.name ?? '');
    case 'Cast':
      return REAL_TYPES.has(e.type.name);
    case 'Unary':
      return isRealExpr(e.argument, scope);
    case 'Binary':
      return isRealExpr(e.left, scope) || isRealExpr(e.right, scope);
    case 'Assign':
      return isRealExpr(e.target, scope) || isRealExpr(e.value, scope);
    case 'Cond':
      return isRealExpr(e.then, scope) || isRealExpr(e.else, scope);
    case 'Index':
      return isRealExpr(e.object, scope);
    case 'Call':
      return e.callee.kind === 'Ident' && REAL_FUNCTIONS.has(e.callee.name);
    default:
      return false;
  }
}

// ── operators ────────────────────────────────────────────────────────────────

function binary(op: string, l: Value, r: Value, line: number, real = false): Value {
  if (op === '+' && (typeof l === 'string' || typeof r === 'string')) {
    return toStr(l) + toStr(r);
  }
  const a = toNum(l);
  const b = toNum(r);
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (b === 0) throw new RuntimeError('Division by zero', line);
      // C decides this from the operand *types*, not their values: `7 / 2` is 3
      // but `7 / 2.0` is 3.5, even though 2.0 holds a whole number. Values alone
      // cannot tell those apart, so the caller resolves the types and says.
      return real || !Number.isInteger(a) || !Number.isInteger(b)
        ? a / b
        : Math.trunc(a / b);
    case '%':
      if (b === 0) throw new RuntimeError('Modulo by zero', line);
      return Math.trunc(a) % Math.trunc(b);
    case '<': return a < b ? 1 : 0;
    case '>': return a > b ? 1 : 0;
    case '<=': return a <= b ? 1 : 0;
    case '>=': return a >= b ? 1 : 0;
    case '==':
      if (typeof l === 'string' || typeof r === 'string') return toStr(l) === toStr(r) ? 1 : 0;
      return a === b ? 1 : 0;
    case '!=':
      if (typeof l === 'string' || typeof r === 'string') return toStr(l) !== toStr(r) ? 1 : 0;
      return a !== b ? 1 : 0;
    case '&': return Math.trunc(a) & Math.trunc(b);
    case '|': return Math.trunc(a) | Math.trunc(b);
    case '^': return Math.trunc(a) ^ Math.trunc(b);
    case '<<': return Math.trunc(a) << Math.trunc(b);
    case '>>': return Math.trunc(a) >> Math.trunc(b);
    case ',': return r;
  }
  return 0;
}

function stringMethod(obj: Value, method: string, args: Value[], line: number): Value {
  const s = toStr(obj);
  const n = (i: number) => toNum(args[i]);
  switch (method) {
    case 'length': return s.length;
    case 'charAt': return s.charCodeAt(n(0)) || 0;
    case 'indexOf': return s.indexOf(toStr(args[0]), args[1] !== undefined ? n(1) : 0);
    case 'lastIndexOf': return s.lastIndexOf(toStr(args[0]));
    case 'substring': return args[1] !== undefined ? s.substring(n(0), n(1)) : s.substring(n(0));
    case 'toUpperCase': return s.toUpperCase();
    case 'toLowerCase': return s.toLowerCase();
    case 'trim': return s.trim();
    case 'equals': return s === toStr(args[0]) ? 1 : 0;
    case 'equalsIgnoreCase': return s.toLowerCase() === toStr(args[0]).toLowerCase() ? 1 : 0;
    case 'startsWith': return s.startsWith(toStr(args[0])) ? 1 : 0;
    case 'endsWith': return s.endsWith(toStr(args[0])) ? 1 : 0;
    case 'toInt': return parseInt(s, 10) || 0;
    case 'toFloat': return parseFloat(s) || 0;
    case 'concat': return s + toStr(args[0]);
    case 'replace': return s.split(toStr(args[0])).join(toStr(args[1]));
    case 'c_str': return s;
    case 'compareTo': return s < toStr(args[0]) ? -1 : s > toStr(args[0]) ? 1 : 0;
    case 'isEmpty': return s.length === 0 ? 1 : 0;
  }
  throw new RuntimeError(`'String' has no method '${method}'`, line);
}

function sizeOfType(name: string): number {
  switch (name) {
    case 'bool': case 'char': case 'byte': return 1;
    case 'long': case 'float': case 'double': return 4;
    case 'longlong': return 8;
    default: return 2;
  }
}

const isLValue = (e: Expr) =>
  e.kind === 'Ident' || e.kind === 'Index' || e.kind === 'Member';

function isGen(v: unknown): v is Generator<Wait, Value, void> {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { next?: unknown }).next === 'function' &&
    typeof (v as { throw?: unknown }).throw === 'function'
  );
}

export { formatNumber };
