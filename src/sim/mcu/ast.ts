export interface Node {
  kind: string;
  line: number;
}

// ── types ────────────────────────────────────────────────────────────────────

export interface TypeRef {
  /** Canonical base name: 'int', 'long', 'float', 'char', 'bool', 'String', … */
  name: string;
  unsigned: boolean;
  pointer: number;
  /** Array dimensions; an empty expression means an inferred size. */
  dims: (Expr | null)[];
  isConst: boolean;
}

// ── expressions ──────────────────────────────────────────────────────────────

export type Expr =
  | NumLit
  | StrLit
  | Ident
  | CallExpr
  | MemberExpr
  | IndexExpr
  | UnaryExpr
  | UpdateExpr
  | BinaryExpr
  | LogicalExpr
  | AssignExpr
  | CondExpr
  | CastExpr
  | SizeofExpr
  | InitList;

export interface NumLit extends Node { kind: 'Num'; value: number; isInt: boolean }
export interface StrLit extends Node { kind: 'Str'; value: string }
export interface Ident extends Node { kind: 'Ident'; name: string }
export interface CallExpr extends Node { kind: 'Call'; callee: Expr; args: Expr[] }
export interface MemberExpr extends Node { kind: 'Member'; object: Expr; property: string }
export interface IndexExpr extends Node { kind: 'Index'; object: Expr; index: Expr }
export interface UnaryExpr extends Node { kind: 'Unary'; op: string; argument: Expr }
export interface UpdateExpr extends Node {
  kind: 'Update';
  op: '++' | '--';
  prefix: boolean;
  argument: Expr;
}
export interface BinaryExpr extends Node { kind: 'Binary'; op: string; left: Expr; right: Expr }
export interface LogicalExpr extends Node { kind: 'Logical'; op: '&&' | '||'; left: Expr; right: Expr }
export interface AssignExpr extends Node { kind: 'Assign'; op: string; target: Expr; value: Expr }
export interface CondExpr extends Node { kind: 'Cond'; test: Expr; then: Expr; else: Expr }
export interface CastExpr extends Node { kind: 'Cast'; type: TypeRef; argument: Expr }
export interface SizeofExpr extends Node { kind: 'Sizeof'; type?: TypeRef; argument?: Expr }
export interface InitList extends Node { kind: 'InitList'; items: Expr[] }

// ── statements ───────────────────────────────────────────────────────────────

export type Stmt =
  | BlockStmt
  | VarDeclStmt
  | ExprStmt
  | IfStmt
  | ForStmt
  | WhileStmt
  | DoWhileStmt
  | SwitchStmt
  | BreakStmt
  | ContinueStmt
  | ReturnStmt
  | EmptyStmt;

export interface BlockStmt extends Node { kind: 'Block'; body: Stmt[] }
export interface Declarator {
  name: string;
  type: TypeRef;
  init: Expr | null;
}
export interface VarDeclStmt extends Node {
  kind: 'VarDecl';
  decls: Declarator[];
  isStatic: boolean;
}
export interface ExprStmt extends Node { kind: 'ExprStmt'; expression: Expr }
export interface IfStmt extends Node { kind: 'If'; test: Expr; then: Stmt; else: Stmt | null }
export interface ForStmt extends Node {
  kind: 'For';
  init: Stmt | null;
  test: Expr | null;
  update: Expr | null;
  body: Stmt;
}
export interface WhileStmt extends Node { kind: 'While'; test: Expr; body: Stmt }
export interface DoWhileStmt extends Node { kind: 'DoWhile'; test: Expr; body: Stmt }
export interface SwitchCase { test: Expr | null; body: Stmt[] }
export interface SwitchStmt extends Node { kind: 'Switch'; disc: Expr; cases: SwitchCase[] }
export interface BreakStmt extends Node { kind: 'Break' }
export interface ContinueStmt extends Node { kind: 'Continue' }
export interface ReturnStmt extends Node { kind: 'Return'; argument: Expr | null }
export interface EmptyStmt extends Node { kind: 'Empty' }

// ── top level ────────────────────────────────────────────────────────────────

export interface Param {
  name: string;
  type: TypeRef;
  byRef: boolean;
}

export interface FuncDecl extends Node {
  kind: 'Func';
  name: string;
  returnType: TypeRef;
  params: Param[];
  body: BlockStmt | null;
}

export interface StructDecl extends Node {
  kind: 'Struct';
  name: string;
  fields: Declarator[];
  methods: FuncDecl[];
}

export interface EnumDecl extends Node {
  kind: 'Enum';
  name: string;
  members: { name: string; value: number }[];
}

export type TopLevel = FuncDecl | VarDeclStmt | StructDecl | EnumDecl;

export interface Program {
  body: TopLevel[];
  includes: string[];
}

export const intType = (name = 'int'): TypeRef => ({
  name,
  unsigned: false,
  pointer: 0,
  dims: [],
  isConst: false,
});
