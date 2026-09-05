import { pyLex, type PyToken } from './lexer';
import type {
  PyExceptHandler,
  PyExpr,
  PyKeywordArg,
  PyModule,
  PyParam,
  PyStmt,
} from './ast';

export interface PyParseError {
  line: number;
  message: string;
}

/**
 * Recursive-descent parser for the MicroPython subset that micro:bit programs
 * use. Like the C++ one it is deliberately permissive: a construct it cannot
 * model yields a diagnostic and a skipped line rather than an exception that
 * takes the whole program down.
 */
export class PyParser {
  private t: PyToken[] = [];
  private p = 0;
  errors: PyParseError[] = [];

  parse(source: string): PyModule {
    const lexed = pyLex(source);
    this.t = lexed.tokens;
    this.p = 0;
    this.errors = lexed.errors.map((e) => ({ line: e.line, message: e.message }));

    const body: PyStmt[] = [];
    const imports: string[] = [];

    while (!this.atEnd()) {
      if (this.skipNewlines()) continue;
      const before = this.p;
      try {
        const s = this.statement();
        if (s) {
          body.push(s);
          if (s.kind === 'Import') imports.push(...s.names.map((n) => n.name));
          if (s.kind === 'ImportFrom') imports.push(s.module);
        }
      } catch (e) {
        this.errors.push({
          line: this.peek().line,
          message: e instanceof Error ? e.message : String(e),
        });
        this.skipLine();
      }
      if (this.p === before) this.p++;
    }

    return { body, imports };
  }

  // ── token helpers ──────────────────────────────────────────────────────────

  private peek(o = 0): PyToken {
    return this.t[Math.min(this.p + o, this.t.length - 1)];
  }
  private atEnd() {
    return this.peek().kind === 'eof';
  }
  private next(): PyToken {
    return this.t[this.p++];
  }
  private is(value: string, o = 0) {
    const t = this.peek(o);
    return (t.kind === 'op' || t.kind === 'keyword' || t.kind === 'name') && t.value === value;
  }
  private isKind(kind: PyToken['kind'], o = 0) {
    return this.peek(o).kind === kind;
  }
  private eat(value: string) {
    if (this.is(value)) {
      this.p++;
      return true;
    }
    return false;
  }
  private expect(value: string): PyToken {
    if (this.is(value)) return this.next();
    throw new Error(`Expected '${value}' but found '${this.describe(this.peek())}'`);
  }
  private expectKind(kind: PyToken['kind']): PyToken {
    if (this.peek().kind === kind) return this.next();
    throw new Error(`Expected ${kind} but found '${this.describe(this.peek())}'`);
  }
  private describe(t: PyToken) {
    if (t.kind === 'eof') return 'end of file';
    if (t.kind === 'newline') return 'end of line';
    if (t.kind === 'indent') return 'an indent';
    if (t.kind === 'dedent') return 'a dedent';
    return t.value;
  }
  private skipNewlines() {
    let any = false;
    while (this.isKind('newline')) {
      this.p++;
      any = true;
    }
    return any;
  }
  private skipLine() {
    let depth = 0;
    while (!this.atEnd()) {
      const k = this.peek().kind;
      if (k === 'indent') depth++;
      if (k === 'dedent') {
        this.p++;
        if (--depth < 0) return;
        continue;
      }
      if (k === 'newline' && depth === 0) {
        this.p++;
        return;
      }
      this.p++;
    }
  }

  // ── suites ─────────────────────────────────────────────────────────────────

  private suite(): PyStmt[] {
    this.expect(':');
    // Single-line body: `if x: do()`
    if (!this.isKind('newline')) {
      const stmts: PyStmt[] = [];
      do {
        const s = this.simpleStatement();
        if (s) stmts.push(s);
      } while (this.eat(';') && !this.isKind('newline'));
      if (this.isKind('newline')) this.p++;
      return stmts;
    }

    this.expectKind('newline');
    this.skipNewlines();
    if (!this.isKind('indent')) {
      throw new Error('Expected an indented block');
    }
    this.p++;

    const body: PyStmt[] = [];
    while (!this.isKind('dedent') && !this.atEnd()) {
      if (this.skipNewlines()) continue;
      const before = this.p;
      try {
        const s = this.statement();
        if (s) body.push(s);
      } catch (e) {
        this.errors.push({
          line: this.peek().line,
          message: e instanceof Error ? e.message : String(e),
        });
        this.skipLine();
      }
      if (this.p === before) this.p++;
    }
    if (this.isKind('dedent')) this.p++;
    return body;
  }

  // ── statements ─────────────────────────────────────────────────────────────

  private statement(): PyStmt | null {
    const line = this.peek().line;

    // Decorators are accepted and ignored — they change nothing we model.
    while (this.is('@')) {
      this.skipLine();
      this.skipNewlines();
    }

    if (this.is('if')) return this.ifStatement();
    if (this.is('while')) {
      this.next();
      const test = this.expression();
      const body = this.suite();
      const orelse = this.elseSuite();
      return { kind: 'While', test, body, orelse, line };
    }
    if (this.is('for')) {
      this.next();
      const target = this.targetList();
      this.expect('in');
      const iter = this.expression();
      const body = this.suite();
      const orelse = this.elseSuite();
      return { kind: 'For', target, iter, body, orelse, line };
    }
    if (this.is('def')) {
      this.next();
      const name = this.expectKind('name').value;
      const params = this.paramList();
      // return annotation
      if (this.eat('->')) this.ternary();
      const body = this.suite();
      return { kind: 'FuncDef', name, params, body, line };
    }
    if (this.is('class')) {
      this.next();
      const name = this.expectKind('name').value;
      const bases: PyExpr[] = [];
      if (this.eat('(')) {
        while (!this.is(')') && !this.atEnd()) {
          bases.push(this.ternary());
          if (!this.eat(',')) break;
        }
        this.expect(')');
      }
      const body = this.suite();
      return { kind: 'ClassDef', name, bases, body, line };
    }
    if (this.is('try')) return this.tryStatement();
    if (this.is('with')) {
      this.next();
      const items: { context: PyExpr; optional: PyExpr | null }[] = [];
      do {
        const context = this.ternary();
        const optional = this.eat('as') ? this.target() : null;
        items.push({ context, optional });
      } while (this.eat(','));
      const body = this.suite();
      return { kind: 'With', items, body, line };
    }

    const s = this.simpleStatement();
    // A simple statement line may hold several, separated by ';'.
    if (this.eat(';')) {
      while (!this.isKind('newline') && !this.atEnd()) {
        this.simpleStatement();
        if (!this.eat(';')) break;
      }
    }
    if (this.isKind('newline')) this.p++;
    return s;
  }

  private ifStatement(): PyStmt {
    const line = this.peek().line;
    this.next(); // if | elif
    const test = this.expression();
    const body = this.suite();
    let orelse: PyStmt[] = [];
    this.skipNewlines();
    if (this.is('elif')) {
      orelse = [this.ifStatement()];
    } else if (this.is('else')) {
      this.next();
      orelse = this.suite();
    }
    return { kind: 'If', test, body, orelse, line };
  }

  private elseSuite(): PyStmt[] {
    this.skipNewlines();
    if (!this.is('else')) return [];
    this.next();
    return this.suite();
  }

  private tryStatement(): PyStmt {
    const line = this.peek().line;
    this.next();
    const body = this.suite();
    const handlers: PyExceptHandler[] = [];
    let orelse: PyStmt[] = [];
    let finalbody: PyStmt[] = [];

    for (;;) {
      this.skipNewlines();
      if (this.is('except')) {
        this.next();
        let type: PyExpr | null = null;
        let name: string | null = null;
        if (!this.is(':')) {
          type = this.ternary();
          if (this.eat('as')) name = this.expectKind('name').value;
        }
        handlers.push({ type, name, body: this.suite() });
        continue;
      }
      if (this.is('else')) {
        this.next();
        orelse = this.suite();
        continue;
      }
      if (this.is('finally')) {
        this.next();
        finalbody = this.suite();
        continue;
      }
      break;
    }
    return { kind: 'Try', body, handlers, orelse, finalbody, line };
  }

  private simpleStatement(): PyStmt | null {
    const line = this.peek().line;

    if (this.is('pass')) {
      this.next();
      return { kind: 'Pass', line };
    }
    if (this.is('break')) {
      this.next();
      return { kind: 'Break', line };
    }
    if (this.is('continue')) {
      this.next();
      return { kind: 'Continue', line };
    }
    if (this.is('return')) {
      this.next();
      const value = this.isKind('newline') || this.is(';') ? null : this.expression();
      return { kind: 'Return', value, line };
    }
    if (this.is('raise')) {
      this.next();
      const exc = this.isKind('newline') || this.is(';') ? null : this.ternary();
      return { kind: 'Raise', exc, line };
    }
    if (this.is('assert')) {
      this.next();
      const test = this.ternary();
      const msg = this.eat(',') ? this.ternary() : null;
      return { kind: 'Assert', test, msg, line };
    }
    if (this.is('global') || this.is('nonlocal')) {
      this.next();
      const names: string[] = [];
      do {
        names.push(this.expectKind('name').value);
      } while (this.eat(','));
      return { kind: 'Global', names, line };
    }
    if (this.is('del')) {
      this.next();
      const targets: PyExpr[] = [];
      do {
        targets.push(this.ternary());
      } while (this.eat(','));
      return { kind: 'Delete', targets, line };
    }
    if (this.is('import')) {
      this.next();
      const names: { name: string; asname: string | null }[] = [];
      do {
        const name = this.dottedName();
        const asname = this.eat('as') ? this.expectKind('name').value : null;
        names.push({ name, asname });
      } while (this.eat(','));
      return { kind: 'Import', names, line };
    }
    if (this.is('from')) {
      this.next();
      // Named `moduleName`, not `module`: the bundler reserves that identifier.
      const moduleName = this.dottedName();
      this.expect('import');
      const names: { name: string; asname: string | null }[] = [];
      if (this.eat('*')) {
        names.push({ name: '*', asname: null });
      } else {
        const paren = this.eat('(');
        do {
          if (this.is(')')) break;
          const name = this.expectKind('name').value;
          const asname = this.eat('as') ? this.expectKind('name').value : null;
          names.push({ name, asname });
        } while (this.eat(','));
        if (paren) this.expect(')');
      }
      return { kind: 'ImportFrom', module: moduleName, names, line };
    }

    // expression / assignment
    const first = this.expression();

    const AUG = ['+=', '-=', '*=', '/=', '//=', '%=', '**=', '&=', '|=', '^=', '<<=', '>>='];
    const opTok = this.peek();
    if (opTok.kind === 'op' && AUG.includes(opTok.value)) {
      this.next();
      const value = this.expression();
      return { kind: 'AugAssign', target: first, op: opTok.value.slice(0, -1), value, line };
    }

    if (this.is(':')) {
      // annotated assignment: x: int = 3
      this.next();
      this.ternary();
      if (this.eat('=')) {
        const value = this.expression();
        return { kind: 'Assign', targets: [first], value, line };
      }
      return { kind: 'ExprStmt', value: first, line };
    }

    if (this.is('=')) {
      const targets: PyExpr[] = [first];
      let value: PyExpr = first;
      while (this.eat('=')) {
        value = this.expression();
        targets.push(value);
      }
      // The last expression is the value; everything before it is a target.
      targets.pop();
      return { kind: 'Assign', targets, value, line };
    }

    return { kind: 'ExprStmt', value: first, line };
  }

  private dottedName(): string {
    let name = this.expectKind('name').value;
    while (this.is('.')) {
      this.next();
      name += `.${this.expectKind('name').value}`;
    }
    return name;
  }

  private paramList(): PyParam[] {
    this.expect('(');
    const params: PyParam[] = [];
    while (!this.is(')') && !this.atEnd()) {
      if (this.eat('*')) {
        if (this.isKind('name')) {
          params.push({ name: this.next().value, def: null, star: true });
        }
        if (!this.eat(',')) break;
        continue;
      }
      if (this.eat('**')) {
        if (this.isKind('name')) this.next();
        if (!this.eat(',')) break;
        continue;
      }
      const name = this.expectKind('name').value;
      if (this.eat(':')) this.ternary(); // annotation
      const def = this.eat('=') ? this.ternary() : null;
      params.push({ name, def });
      if (!this.eat(',')) break;
    }
    this.expect(')');
    return params;
  }

  // ── targets ────────────────────────────────────────────────────────────────

  private target(): PyExpr {
    return this.postfix(this.atom());
  }

  private targetList(): PyExpr {
    const line = this.peek().line;
    const first = this.target();
    if (!this.is(',')) return first;
    const items = [first];
    while (this.eat(',')) {
      if (this.is('in')) break;
      items.push(this.target());
    }
    return { kind: 'Tuple', items, line };
  }

  // ── expressions ────────────────────────────────────────────────────────────

  /** Top level: allows a bare tuple, as in `a, b = 1, 2`. */
  private expression(): PyExpr {
    const line = this.peek().line;
    const first = this.ternary();
    if (!this.is(',')) return first;
    const items = [first];
    while (this.eat(',')) {
      if (this.isKind('newline') || this.is(')') || this.is(']') || this.is('}') || this.is('=')) break;
      items.push(this.ternary());
    }
    return { kind: 'Tuple', items, line };
  }

  private ternary(): PyExpr {
    if (this.is('lambda')) {
      const line = this.peek().line;
      this.next();
      const params: PyParam[] = [];
      while (!this.is(':') && !this.atEnd()) {
        const name = this.expectKind('name').value;
        const def = this.eat('=') ? this.ternary() : null;
        params.push({ name, def });
        if (!this.eat(',')) break;
      }
      this.expect(':');
      return { kind: 'Lambda', params, body: this.ternary(), line };
    }

    const body = this.orExpr();
    if (this.is('if')) {
      const line = body.line;
      this.next();
      const test = this.orExpr();
      this.expect('else');
      const orelse = this.ternary();
      return { kind: 'IfExp', test, body, orelse, line };
    }
    return body;
  }

  private orExpr(): PyExpr {
    let left = this.andExpr();
    if (!this.is('or')) return left;
    const values = [left];
    while (this.eat('or')) values.push(this.andExpr());
    left = { kind: 'BoolOp', op: 'or', values, line: left.line };
    return left;
  }

  private andExpr(): PyExpr {
    const left = this.notExpr();
    if (!this.is('and')) return left;
    const values = [left];
    while (this.eat('and')) values.push(this.notExpr());
    return { kind: 'BoolOp', op: 'and', values, line: left.line };
  }

  private notExpr(): PyExpr {
    if (this.is('not')) {
      const line = this.peek().line;
      this.next();
      return { kind: 'Unary', op: 'not', operand: this.notExpr(), line };
    }
    return this.comparison();
  }

  private comparison(): PyExpr {
    const left = this.bitOr();
    const ops: string[] = [];
    const comparators: PyExpr[] = [];
    for (;;) {
      let op: string | null = null;
      if (this.is('not') && this.is('in', 1)) {
        this.next();
        this.next();
        op = 'not in';
      } else if (this.is('is')) {
        this.next();
        op = this.eat('not') ? 'is not' : 'is';
      } else if (this.is('in')) {
        this.next();
        op = 'in';
      } else {
        const t = this.peek();
        if (t.kind === 'op' && ['<', '>', '<=', '>=', '==', '!='].includes(t.value)) {
          this.next();
          op = t.value;
        }
      }
      if (!op) break;
      ops.push(op);
      comparators.push(this.bitOr());
    }
    if (!ops.length) return left;
    return { kind: 'Compare', left, ops, comparators, line: left.line };
  }

  private binaryLevel(ops: string[], next: () => PyExpr): PyExpr {
    let left = next();
    for (;;) {
      const t = this.peek();
      if (t.kind !== 'op' || !ops.includes(t.value)) break;
      this.next();
      const right = next();
      left = { kind: 'Binary', op: t.value, left, right, line: left.line };
    }
    return left;
  }

  private bitOr = (): PyExpr => this.binaryLevel(['|'], this.bitXor);
  private bitXor = (): PyExpr => this.binaryLevel(['^'], this.bitAnd);
  private bitAnd = (): PyExpr => this.binaryLevel(['&'], this.shift);
  private shift = (): PyExpr => this.binaryLevel(['<<', '>>'], this.arith);
  private arith = (): PyExpr => this.binaryLevel(['+', '-'], this.term);
  private term = (): PyExpr => this.binaryLevel(['*', '/', '//', '%'], this.factor);

  private factor = (): PyExpr => {
    const t = this.peek();
    if (t.kind === 'op' && ['-', '+', '~'].includes(t.value)) {
      this.next();
      return { kind: 'Unary', op: t.value, operand: this.factor(), line: t.line };
    }
    return this.power();
  };

  private power(): PyExpr {
    const base = this.postfix(this.atom());
    if (this.is('**')) {
      this.next();
      return { kind: 'Binary', op: '**', left: base, right: this.factor(), line: base.line };
    }
    return base;
  }

  private postfix(expr: PyExpr): PyExpr {
    for (;;) {
      if (this.is('(')) {
        this.next();
        const args: PyExpr[] = [];
        const keywords: PyKeywordArg[] = [];
        while (!this.is(')') && !this.atEnd()) {
          if (this.eat('*')) {
            args.push({ kind: 'Starred', value: this.ternary(), line: expr.line });
          } else if (this.isKind('name') && this.is('=', 1)) {
            const name = this.next().value;
            this.next();
            keywords.push({ name, value: this.ternary() });
          } else {
            args.push(this.ternary());
          }
          if (!this.eat(',')) break;
        }
        this.expect(')');
        expr = { kind: 'Call', func: expr, args, keywords, line: expr.line };
        continue;
      }
      if (this.is('[')) {
        this.next();
        const index = this.sliceOrIndex();
        this.expect(']');
        expr = { kind: 'Subscript', obj: expr, index, line: expr.line };
        continue;
      }
      if (this.is('.')) {
        this.next();
        const attr = this.expectKind('name').value;
        expr = { kind: 'Attr', obj: expr, attr, line: expr.line };
        continue;
      }
      break;
    }
    return expr;
  }

  private sliceOrIndex(): PyExpr {
    const line = this.peek().line;
    let lower: PyExpr | null = null;
    if (!this.is(':')) lower = this.ternary();
    if (!this.is(':')) return lower ?? { kind: 'Const', value: null, line };
    this.next();
    let upper: PyExpr | null = null;
    if (!this.is(':') && !this.is(']')) upper = this.ternary();
    let step: PyExpr | null = null;
    if (this.eat(':') && !this.is(']')) step = this.ternary();
    return { kind: 'SliceExpr', lower, upper, step, line };
  }

  private atom(): PyExpr {
    const t = this.peek();
    const line = t.line;

    if (t.kind === 'number') {
      this.next();
      return { kind: 'Num', value: t.num ?? 0, line };
    }
    if (t.kind === 'string') {
      this.next();
      // Adjacent literals concatenate; f-strings are parsed for their holes.
      let value = t.value;
      let isF = (t.prefix ?? '').includes('f');
      while (this.isKind('string')) {
        const nxt = this.next();
        value += nxt.value;
        if ((nxt.prefix ?? '').includes('f')) isF = true;
      }
      return isF ? this.buildFString(value, line) : { kind: 'Str', value, line };
    }
    if (t.kind === 'keyword' && (t.value === 'True' || t.value === 'False')) {
      this.next();
      return { kind: 'Const', value: t.value === 'True', line };
    }
    if (t.kind === 'keyword' && t.value === 'None') {
      this.next();
      return { kind: 'Const', value: null, line };
    }
    if (t.kind === 'name') {
      this.next();
      return { kind: 'Name', id: t.value, line };
    }

    if (this.is('(')) {
      this.next();
      if (this.is(')')) {
        this.next();
        return { kind: 'Tuple', items: [], line };
      }
      const first = this.ternary();
      if (this.is('for')) {
        const comp = this.comprehensionTail(first, null, 'generator', line);
        this.expect(')');
        return comp;
      }
      if (this.is(',')) {
        const items = [first];
        while (this.eat(',')) {
          if (this.is(')')) break;
          items.push(this.ternary());
        }
        this.expect(')');
        return { kind: 'Tuple', items, line };
      }
      this.expect(')');
      return first;
    }

    if (this.is('[')) {
      this.next();
      if (this.is(']')) {
        this.next();
        return { kind: 'List', items: [], line };
      }
      const first = this.ternary();
      if (this.is('for')) {
        const comp = this.comprehensionTail(first, null, 'list', line);
        this.expect(']');
        return comp;
      }
      const items = [first];
      while (this.eat(',')) {
        if (this.is(']')) break;
        items.push(this.ternary());
      }
      this.expect(']');
      return { kind: 'List', items, line };
    }

    if (this.is('{')) {
      this.next();
      if (this.is('}')) {
        this.next();
        return { kind: 'Dict', keys: [], values: [], line };
      }
      const firstKey = this.ternary();
      if (this.eat(':')) {
        const firstValue = this.ternary();
        if (this.is('for')) {
          const comp = this.comprehensionTail(firstKey, firstValue, 'dict', line);
          this.expect('}');
          return comp;
        }
        const keys = [firstKey];
        const values = [firstValue];
        while (this.eat(',')) {
          if (this.is('}')) break;
          keys.push(this.ternary());
          this.expect(':');
          values.push(this.ternary());
        }
        this.expect('}');
        return { kind: 'Dict', keys, values, line };
      }
      if (this.is('for')) {
        const comp = this.comprehensionTail(firstKey, null, 'set', line);
        this.expect('}');
        return comp;
      }
      const items = [firstKey];
      while (this.eat(',')) {
        if (this.is('}')) break;
        items.push(this.ternary());
      }
      this.expect('}');
      return { kind: 'Set', items, line };
    }

    throw new Error(`Unexpected '${this.describe(t)}'`);
  }

  private comprehensionTail(
    element: PyExpr,
    value: PyExpr | null,
    form: 'list' | 'set' | 'dict' | 'generator',
    line: number,
  ): PyExpr {
    this.expect('for');
    const target = this.targetList();
    this.expect('in');
    const iter = this.orExpr();
    const condition = this.eat('if') ? this.orExpr() : null;
    return { kind: 'Comprehension', form, element, value, target, iter, condition, line };
  }

  /** Split an f-string body into literal chunks and embedded expressions. */
  private buildFString(raw: string, line: number): PyExpr {
    const parts: (string | PyExpr)[] = [];
    let buf = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '{' && raw[i + 1] === '{') {
        buf += '{';
        i++;
        continue;
      }
      if (ch === '}' && raw[i + 1] === '}') {
        buf += '}';
        i++;
        continue;
      }
      if (ch !== '{') {
        buf += ch;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      while (j < raw.length && depth > 0) {
        if (raw[j] === '{') depth++;
        if (raw[j] === '}') depth--;
        if (depth > 0) j++;
      }
      // Drop any !r / :format spec — we render with str().
      const inner = raw.slice(i + 1, j).split('!')[0].split(':')[0].trim();
      if (buf) {
        parts.push(buf);
        buf = '';
      }
      if (inner) {
        const sub = new PyParser();
        const mod = sub.parse(inner);
        const first = mod.body[0];
        if (first && first.kind === 'ExprStmt') parts.push(first.value);
        else parts.push(inner);
      }
      i = j;
    }
    if (buf) parts.push(buf);
    return { kind: 'FStr', parts, line };
  }
}

export function parsePython(source: string): { module: PyModule; errors: PyParseError[] } {
  const p = new PyParser();
  const mod = p.parse(source);
  return { module: mod, errors: p.errors };
}
