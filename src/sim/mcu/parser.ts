import { lex, type Token } from './lexer';
import type {
  BlockStmt,
  Declarator,
  EnumDecl,
  Expr,
  FuncDecl,
  Param,
  Program,
  Stmt,
  StructDecl,
  SwitchCase,
  TopLevel,
  TypeRef,
  VarDeclStmt,
} from './ast';

export interface ParseError {
  line: number;
  message: string;
}

const TYPE_WORDS = new Set([
  'void', 'int', 'long', 'short', 'char', 'float', 'double', 'bool', 'boolean',
  'byte', 'word', 'signed', 'unsigned',
]);

/** Types the Arduino core and our bundled libraries introduce. */
const KNOWN_TYPES = new Set([
  'String', 'Servo', 'LiquidCrystal', 'LiquidCrystal_I2C', 'Adafruit_NeoPixel',
  'SoftwareSerial', 'Stepper', 'size_t', 'uint8_t', 'uint16_t', 'uint32_t',
  'int8_t', 'int16_t', 'int32_t', 'boolean', 'byte', 'word', 'IRrecv',
  'decode_results', 'Adafruit_LiquidCrystal', 'SPIClass', 'TwoWire',
]);

/**
 * Recursive-descent parser for the C++ subset Arduino sketches actually use.
 *
 * It is deliberately permissive: unknown type names are accepted as opaque
 * class types, and constructs it cannot model (templates, multiple
 * inheritance, operator overloading) produce a diagnostic rather than a throw,
 * so one unsupported line does not take the whole sketch down.
 */
export class Parser {
  private t: Token[] = [];
  private p = 0;
  private types = new Set(KNOWN_TYPES);
  errors: ParseError[] = [];

  parse(source: string): Program {
    const lexed = lex(source);
    this.t = lexed.tokens;
    this.p = 0;
    this.errors = lexed.errors.map((e) => ({ line: e.line, message: e.message }));

    // Pre-scan for user-declared struct/class/enum names so their uses parse.
    for (let i = 0; i < this.t.length - 1; i++) {
      const v = this.t[i].value;
      if ((v === 'struct' || v === 'class' || v === 'enum') && this.t[i + 1].kind === 'ident') {
        this.types.add(this.t[i + 1].value);
      }
      if (v === 'typedef') {
        // typedef … NewName;  → the token before the ';' is the new name
        let j = i + 1;
        while (j < this.t.length && this.t[j].value !== ';') j++;
        if (j - 1 > i && this.t[j - 1].kind === 'ident') this.types.add(this.t[j - 1].value);
      }
    }

    const body: TopLevel[] = [];
    while (!this.atEnd()) {
      const before = this.p;
      try {
        const item = this.parseTopLevel();
        if (item) body.push(item);
      } catch (e) {
        this.errors.push({
          line: this.peek().line,
          message: e instanceof Error ? e.message : String(e),
        });
        this.recover();
      }
      if (this.p === before) this.p++; // never spin
    }

    return { body, includes: lexed.includes };
  }

  // ── token helpers ──────────────────────────────────────────────────────────

  private peek(o = 0): Token {
    return this.t[Math.min(this.p + o, this.t.length - 1)];
  }
  private atEnd() {
    return this.peek().kind === 'eof';
  }
  private next(): Token {
    return this.t[this.p++];
  }
  private is(value: string, o = 0) {
    return this.peek(o).value === value && this.peek(o).kind !== 'string';
  }
  private eat(value: string) {
    if (this.is(value)) {
      this.p++;
      return true;
    }
    return false;
  }
  private expect(value: string): Token {
    if (this.is(value)) return this.next();
    throw new Error(`Expected '${value}' but found '${this.peek().value || 'end of file'}'`);
  }
  private recover() {
    let depth = 0;
    while (!this.atEnd()) {
      const v = this.peek().value;
      if (v === '{') depth++;
      if (v === '}') {
        this.p++;
        if (--depth <= 0) return;
        continue;
      }
      if (v === ';' && depth === 0) {
        this.p++;
        return;
      }
      this.p++;
    }
  }

  // ── types ──────────────────────────────────────────────────────────────────

  private looksLikeType(o = 0): boolean {
    let i = o;
    while (['const', 'static', 'volatile', 'extern', 'unsigned', 'signed', 'PROGMEM', 'inline'].includes(this.peek(i).value)) {
      i++;
    }
    const v = this.peek(i).value;
    if (TYPE_WORDS.has(v) || this.types.has(v)) return true;
    if (v === 'struct' || v === 'class' || v === 'enum') return true;

    // A class the sketch never declares, because it comes from a library:
    // `LiquidCrystal lcd(12, 11, 5, 4, 3, 2);`. Two identifiers in a row can
    // only be a declaration in C, so the first one is a type name even though
    // nothing in the file says so.
    if (this.peek(i).kind === 'ident') {
      let j = i + 1;
      while (this.peek(j).value === '*' || this.peek(j).value === '&') j++;
      if (this.peek(j).kind === 'ident') {
        const after = this.peek(j + 1).value;
        return after === '(' || after === ';' || after === '=' || after === '[' || after === ',';
      }
    }
    return false;
  }

  private parseType(): TypeRef {
    let isConst = false;
    let unsigned = false;
    for (;;) {
      if (this.eat('const')) { isConst = true; continue; }
      if (this.eat('static') || this.eat('volatile') || this.eat('extern') || this.eat('PROGMEM') || this.eat('inline')) continue;
      if (this.eat('unsigned')) { unsigned = true; continue; }
      if (this.eat('signed')) { unsigned = false; continue; }
      break;
    }
    if (this.is('struct') || this.is('class') || this.is('enum')) this.next();

    let name = this.next().value;
    // 'long long', 'long int', 'unsigned char' …
    while (TYPE_WORDS.has(this.peek().value) && name !== 'void') {
      const extra = this.next().value;
      name = name === 'long' && extra === 'long' ? 'longlong' : extra === 'int' ? name : extra;
    }
    if (name === 'boolean') name = 'bool';
    if (name === 'byte' || name === 'uint8_t') { name = 'byte'; unsigned = true; }
    if (name === 'word' || name === 'uint16_t') { name = 'word'; unsigned = true; }
    if (name === 'uint32_t') { name = 'long'; unsigned = true; }
    if (name === 'int8_t') name = 'char';
    if (name === 'int16_t') name = 'int';
    if (name === 'int32_t') name = 'long';
    if (name === 'double') name = 'float';

    let pointer = 0;
    while (this.is('*')) { this.next(); pointer++; }
    // References behave like pointers for our purposes; parameters record byRef.
    if (this.is('&')) this.next();

    return { name, unsigned, pointer, dims: [], isConst };
  }

  private parseDims(type: TypeRef) {
    while (this.is('[')) {
      this.next();
      if (this.is(']')) {
        type.dims.push(null);
      } else {
        type.dims.push(this.parseAssign());
      }
      this.expect(']');
    }
  }

  // ── top level ──────────────────────────────────────────────────────────────

  private parseTopLevel(): TopLevel | null {
    if (this.eat(';')) return null;

    if ((this.is('struct') || this.is('class')) && this.peek(1).kind === 'ident' &&
        (this.is('{', 2) || this.is(':', 2))) {
      return this.parseStruct();
    }
    if (this.is('enum')) return this.parseEnum();
    if (this.is('typedef')) {
      while (!this.atEnd() && !this.eat(';')) this.next();
      return null;
    }

    if (!this.looksLikeType()) {
      // A stray expression at file scope: skip it rather than derail the file.
      this.recover();
      return null;
    }

    const line = this.peek().line;
    const isStatic = this.t[this.p].value === 'static';
    const type = this.parseType();
    const name = this.peek().kind === 'ident' ? this.next().value : '';

    // function definition or prototype
    if (this.is('(')) {
      // Except when it is a construction: `LiquidCrystal lcd(12, 11, 5, 4, 3, 2);`
      // looks identical to a prototype, and C++ resolves it by asking whether
      // the parentheses could hold parameter declarations. Numbers cannot.
      if (!this.is(')', 1) && !this.looksLikeType(1)) {
        return this.finishVarDecl(type, name, isStatic, line);
      }
      const params = this.parseParams();
      // skip trailing qualifiers
      while (this.is('const') || this.is('override')) this.next();
      if (this.eat(';')) {
        return { kind: 'Func', name, returnType: type, params, body: null, line };
      }
      const body = this.parseBlock();
      return { kind: 'Func', name, returnType: type, params, body, line };
    }

    return this.finishVarDecl(type, name, isStatic, line);
  }

  private parseParams(): Param[] {
    this.expect('(');
    const params: Param[] = [];
    while (!this.is(')') && !this.atEnd()) {
      if (this.is('void') && this.is(')', 1)) { this.next(); break; }
      const start = this.p;
      const type = this.parseType();
      // parseType consumed a '&' if present; detect it by looking back.
      const byRef = this.t.slice(start, this.p).some((tk) => tk.value === '&');
      const pname = this.peek().kind === 'ident' ? this.next().value : `_${params.length}`;
      this.parseDims(type);
      if (this.eat('=')) this.parseAssign(); // default argument, evaluated at call
      params.push({ name: pname, type, byRef });
      if (!this.eat(',')) break;
    }
    this.expect(')');
    return params;
  }

  private parseStruct(): StructDecl {
    const line = this.peek().line;
    this.next(); // struct | class
    const name = this.next().value;
    this.types.add(name);
    // base-class clause
    if (this.eat(':')) {
      while (!this.is('{') && !this.atEnd()) this.next();
    }
    this.expect('{');
    const fields: Declarator[] = [];
    const methods: FuncDecl[] = [];
    while (!this.is('}') && !this.atEnd()) {
      if (this.eat('public') || this.eat('private') || this.eat('protected')) {
        this.eat(':');
        continue;
      }
      if (this.eat(';')) continue;
      // constructor: same name as the struct
      if (this.is(name) && this.is('(', 1)) {
        const cline = this.peek().line;
        this.next();
        const params = this.parseParams();
        const body = this.is('{') ? this.parseBlock() : null;
        this.eat(';');
        methods.push({
          kind: 'Func', name: '__ctor', returnType: { name: 'void', unsigned: false, pointer: 0, dims: [], isConst: false },
          params, body, line: cline,
        });
        continue;
      }
      if (!this.looksLikeType()) { this.next(); continue; }
      const mline = this.peek().line;
      const type = this.parseType();
      const mname = this.peek().kind === 'ident' ? this.next().value : '';
      if (this.is('(')) {
        const params = this.parseParams();
        while (this.is('const')) this.next();
        const body = this.is('{') ? this.parseBlock() : null;
        this.eat(';');
        methods.push({ kind: 'Func', name: mname, returnType: type, params, body, line: mline });
        continue;
      }
      const decl = this.finishVarDecl(type, mname, false, mline);
      fields.push(...decl.decls);
    }
    this.expect('}');
    this.eat(';');
    return { kind: 'Struct', name, fields, methods, line };
  }

  private parseEnum(): EnumDecl {
    const line = this.peek().line;
    this.next();
    let name = '';
    if (this.peek().kind === 'ident') name = this.next().value;
    this.expect('{');
    const members: { name: string; value: number }[] = [];
    let nextValue = 0;
    while (!this.is('}') && !this.atEnd()) {
      const mname = this.next().value;
      if (this.eat('=')) {
        const e = this.parseAssign();
        nextValue = e.kind === 'Num' ? e.value : nextValue;
      }
      members.push({ name: mname, value: nextValue++ });
      if (!this.eat(',')) break;
    }
    this.expect('}');
    this.eat(';');
    return { kind: 'Enum', name, members, line };
  }

  private finishVarDecl(
    firstType: TypeRef,
    firstName: string,
    isStatic: boolean,
    line: number,
  ): VarDeclStmt {
    const decls: Declarator[] = [];
    let type = firstType;
    let name = firstName;

    for (;;) {
      const dt: TypeRef = { ...type, dims: [] };
      this.parseDims(dt);
      let init: Expr | null = null;
      if (this.eat('=')) {
        init = this.is('{') ? this.parseInitList() : this.parseAssign();
      } else if (this.is('(')) {
        // constructor-style initialisation: Servo s(9);
        this.next();
        const args: Expr[] = [];
        while (!this.is(')') && !this.atEnd()) {
          args.push(this.parseAssign());
          if (!this.eat(',')) break;
        }
        this.expect(')');
        init = {
          kind: 'Call',
          callee: { kind: 'Ident', name: `__construct_${dt.name}`, line },
          args,
          line,
        };
      }
      decls.push({ name, type: dt, init });
      if (!this.eat(',')) break;
      let ptr = 0;
      while (this.is('*')) { this.next(); ptr++; }
      type = { ...firstType, pointer: firstType.pointer + ptr };
      name = this.next().value;
    }
    this.eat(';');
    return { kind: 'VarDecl', decls, isStatic, line };
  }

  private parseInitList(): Expr {
    const line = this.peek().line;
    this.expect('{');
    const items: Expr[] = [];
    while (!this.is('}') && !this.atEnd()) {
      items.push(this.is('{') ? this.parseInitList() : this.parseAssign());
      if (!this.eat(',')) break;
    }
    this.expect('}');
    return { kind: 'InitList', items, line };
  }

  // ── statements ─────────────────────────────────────────────────────────────

  private parseBlock(): BlockStmt {
    const line = this.peek().line;
    this.expect('{');
    const body: Stmt[] = [];
    while (!this.is('}') && !this.atEnd()) {
      const before = this.p;
      try {
        body.push(this.parseStatement());
      } catch (e) {
        this.errors.push({
          line: this.peek().line,
          message: e instanceof Error ? e.message : String(e),
        });
        this.recover();
      }
      if (this.p === before) this.p++;
    }
    this.expect('}');
    return { kind: 'Block', body, line };
  }

  private parseStatement(): Stmt {
    const line = this.peek().line;

    if (this.is('{')) return this.parseBlock();
    if (this.eat(';')) return { kind: 'Empty', line };

    if (this.eat('if')) {
      this.expect('(');
      const test = this.parseExpression();
      this.expect(')');
      const then = this.parseStatement();
      const alt = this.eat('else') ? this.parseStatement() : null;
      return { kind: 'If', test, then, else: alt, line };
    }

    if (this.eat('while')) {
      this.expect('(');
      const test = this.parseExpression();
      this.expect(')');
      return { kind: 'While', test, body: this.parseStatement(), line };
    }

    if (this.eat('do')) {
      const body = this.parseStatement();
      this.expect('while');
      this.expect('(');
      const test = this.parseExpression();
      this.expect(')');
      this.eat(';');
      return { kind: 'DoWhile', test, body, line };
    }

    if (this.eat('for')) {
      this.expect('(');
      let init: Stmt | null = null;
      if (!this.is(';')) {
        init = this.looksLikeType()
          ? this.parseDeclStatement()
          : { kind: 'ExprStmt', expression: this.parseExpression(), line };
        if (init.kind === 'ExprStmt') this.eat(';');
      } else {
        this.next();
      }
      const test = this.is(';') ? null : this.parseExpression();
      this.expect(';');
      const update = this.is(')') ? null : this.parseExpression();
      this.expect(')');
      return { kind: 'For', init, test, update, body: this.parseStatement(), line };
    }

    if (this.eat('switch')) {
      this.expect('(');
      const disc = this.parseExpression();
      this.expect(')');
      this.expect('{');
      const cases: SwitchCase[] = [];
      while (!this.is('}') && !this.atEnd()) {
        let test: Expr | null = null;
        if (this.eat('case')) {
          test = this.parseAssign();
          this.expect(':');
        } else if (this.eat('default')) {
          this.expect(':');
        } else {
          // statements belonging to the previous label
          if (!cases.length) cases.push({ test: null, body: [] });
          cases[cases.length - 1].body.push(this.parseStatement());
          continue;
        }
        cases.push({ test, body: [] });
      }
      this.expect('}');
      return { kind: 'Switch', disc, cases, line };
    }

    if (this.eat('break')) { this.eat(';'); return { kind: 'Break', line }; }
    if (this.eat('continue')) { this.eat(';'); return { kind: 'Continue', line }; }
    if (this.eat('return')) {
      const arg = this.is(';') ? null : this.parseExpression();
      this.eat(';');
      return { kind: 'Return', argument: arg, line };
    }

    if (this.looksLikeType() && this.isDeclaration()) return this.parseDeclStatement();

    const expression = this.parseExpression();
    this.eat(';');
    return { kind: 'ExprStmt', expression, line };
  }

  /**
   * Distinguish `int x = 1;` from `foo(1);` when `foo` happens to be a known
   * type name — a declaration must be followed by an identifier.
   */
  private isDeclaration(): boolean {
    let i = 0;
    while (['const', 'static', 'volatile', 'extern', 'unsigned', 'signed'].includes(this.peek(i).value)) i++;
    if (this.peek(i).value === 'struct' || this.peek(i).value === 'class') return true;
    i++; // base type word
    while (TYPE_WORDS.has(this.peek(i).value)) i++;
    while (this.peek(i).value === '*' || this.peek(i).value === '&') i++;
    return this.peek(i).kind === 'ident';
  }

  private parseDeclStatement(): VarDeclStmt {
    const line = this.peek().line;
    const isStatic = this.peek().value === 'static';
    const type = this.parseType();
    const name = this.peek().kind === 'ident' ? this.next().value : '';
    return this.finishVarDecl(type, name, isStatic, line);
  }

  // ── expressions (precedence climbing) ──────────────────────────────────────

  private parseExpression(): Expr {
    let e = this.parseAssign();
    while (this.is(',')) {
      this.next();
      const right = this.parseAssign();
      e = { kind: 'Binary', op: ',', left: e, right, line: e.line };
    }
    return e;
  }

  parseAssign(): Expr {
    const left = this.parseConditional();
    const op = this.peek().value;
    if (['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='].includes(op)) {
      this.next();
      const value = this.parseAssign();
      return { kind: 'Assign', op, target: left, value, line: left.line };
    }
    return left;
  }

  private parseConditional(): Expr {
    const test = this.parseBinary(0);
    if (this.eat('?')) {
      const then = this.parseAssign();
      this.expect(':');
      const alt = this.parseAssign();
      return { kind: 'Cond', test, then, else: alt, line: test.line };
    }
    return test;
  }

  private static PRECEDENCE: Record<string, number> = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5,
    '==': 6, '!=': 6,
    '<': 7, '>': 7, '<=': 7, '>=': 7,
    '<<': 8, '>>': 8,
    '+': 9, '-': 9,
    '*': 10, '/': 10, '%': 10,
  };

  private parseBinary(min: number): Expr {
    let left = this.parseUnary();
    for (;;) {
      const op = this.peek().value;
      const prec = Parser.PRECEDENCE[op];
      if (this.peek().kind !== 'punct' || prec === undefined || prec < min) break;
      this.next();
      const right = this.parseBinary(prec + 1);
      left =
        op === '&&' || op === '||'
          ? { kind: 'Logical', op, left, right, line: left.line }
          : { kind: 'Binary', op, left, right, line: left.line };
    }
    return left;
  }

  private parseUnary(): Expr {
    const line = this.peek().line;

    if (this.is('++') || this.is('--')) {
      const op = this.next().value as '++' | '--';
      return { kind: 'Update', op, prefix: true, argument: this.parseUnary(), line };
    }
    if (['-', '+', '!', '~', '*', '&'].includes(this.peek().value) && this.peek().kind === 'punct') {
      const op = this.next().value;
      return { kind: 'Unary', op, argument: this.parseUnary(), line };
    }
    if (this.is('sizeof')) {
      this.next();
      if (this.is('(') && this.looksLikeType(1)) {
        this.next();
        const type = this.parseType();
        this.parseDims(type);
        this.expect(')');
        return { kind: 'Sizeof', type, line };
      }
      return { kind: 'Sizeof', argument: this.parseUnary(), line };
    }
    // C-style cast
    if (this.is('(') && this.looksLikeType(1)) {
      const save = this.p;
      this.next();
      const type = this.parseType();
      if (this.eat(')')) {
        return { kind: 'Cast', type, argument: this.parseUnary(), line };
      }
      this.p = save;
    }
    if (this.eat('new')) {
      // `new Foo(...)` collapses to a construction call.
      const type = this.parseType();
      const args: Expr[] = [];
      if (this.eat('(')) {
        while (!this.is(')') && !this.atEnd()) {
          args.push(this.parseAssign());
          if (!this.eat(',')) break;
        }
        this.expect(')');
      }
      return {
        kind: 'Call',
        callee: { kind: 'Ident', name: `__construct_${type.name}`, line },
        args,
        line,
      };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    for (;;) {
      if (this.is('(')) {
        this.next();
        const args: Expr[] = [];
        while (!this.is(')') && !this.atEnd()) {
          args.push(this.parseAssign());
          if (!this.eat(',')) break;
        }
        this.expect(')');
        e = { kind: 'Call', callee: e, args, line: e.line };
        continue;
      }
      if (this.is('[')) {
        this.next();
        const index = this.parseExpression();
        this.expect(']');
        e = { kind: 'Index', object: e, index, line: e.line };
        continue;
      }
      if (this.is('.') || this.is('->')) {
        this.next();
        const property = this.next().value;
        e = { kind: 'Member', object: e, property, line: e.line };
        continue;
      }
      if (this.is('::')) {
        // Namespace qualification is flattened: Serial::write → write
        this.next();
        const property = this.next().value;
        e = { kind: 'Ident', name: property, line: e.line };
        continue;
      }
      if (this.is('++') || this.is('--')) {
        const op = this.next().value as '++' | '--';
        e = { kind: 'Update', op, prefix: false, argument: e, line: e.line };
        continue;
      }
      break;
    }
    return e;
  }

  private parsePrimary(): Expr {
    const tok = this.peek();
    const line = tok.line;

    if (tok.kind === 'number') {
      this.next();
      return { kind: 'Num', value: tok.num ?? 0, isInt: tok.isInt ?? true, line };
    }
    if (tok.kind === 'char') {
      this.next();
      return { kind: 'Num', value: tok.num ?? 0, isInt: true, line };
    }
    if (tok.kind === 'string') {
      this.next();
      let value = tok.value;
      // adjacent string literals concatenate
      while (this.peek().kind === 'string') value += this.next().value;
      return { kind: 'Str', value, line };
    }
    if (tok.value === 'true' || tok.value === 'false') {
      this.next();
      return { kind: 'Num', value: tok.value === 'true' ? 1 : 0, isInt: true, line };
    }
    if (tok.value === 'NULL' || tok.value === 'null' || tok.value === 'nullptr') {
      this.next();
      return { kind: 'Num', value: 0, isInt: true, line };
    }
    if (this.is('(')) {
      this.next();
      const e = this.parseExpression();
      this.expect(')');
      return e;
    }
    if (this.is('{')) return this.parseInitList();
    if (tok.kind === 'ident' || tok.kind === 'keyword') {
      this.next();
      return { kind: 'Ident', name: tok.value, line };
    }

    throw new Error(`Unexpected '${tok.value || 'end of file'}'`);
  }
}

export function parseSketch(source: string): { program: Program; errors: ParseError[] } {
  const p = new Parser();
  const program = p.parse(source);
  return { program, errors: p.errors };
}
