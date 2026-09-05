export interface PyNode {
  kind: string;
  line: number;
}

// ── expressions ──────────────────────────────────────────────────────────────

export type PyExpr =
  | PyNum
  | PyStr
  | PyFStr
  | PyConst
  | PyName
  | PyTuple
  | PyList
  | PyDict
  | PySet
  | PyCall
  | PyAttr
  | PySubscript
  | PySlice
  | PyUnary
  | PyBinary
  | PyBoolOp
  | PyCompare
  | PyIfExp
  | PyLambda
  | PyComprehension
  | PyStarred;

export interface PyNum extends PyNode { kind: 'Num'; value: number }
export interface PyStr extends PyNode { kind: 'Str'; value: string }
/** f-string: literal chunks interleaved with expressions. */
export interface PyFStr extends PyNode { kind: 'FStr'; parts: (string | PyExpr)[] }
export interface PyConst extends PyNode { kind: 'Const'; value: boolean | null }
export interface PyName extends PyNode { kind: 'Name'; id: string }
export interface PyTuple extends PyNode { kind: 'Tuple'; items: PyExpr[] }
export interface PyList extends PyNode { kind: 'List'; items: PyExpr[] }
export interface PyDict extends PyNode { kind: 'Dict'; keys: PyExpr[]; values: PyExpr[] }
export interface PySet extends PyNode { kind: 'Set'; items: PyExpr[] }
export interface PyStarred extends PyNode { kind: 'Starred'; value: PyExpr }

export interface PyKeywordArg { name: string | null; value: PyExpr }
export interface PyCall extends PyNode {
  kind: 'Call';
  func: PyExpr;
  args: PyExpr[];
  keywords: PyKeywordArg[];
}

export interface PyAttr extends PyNode { kind: 'Attr'; obj: PyExpr; attr: string }
export interface PySubscript extends PyNode { kind: 'Subscript'; obj: PyExpr; index: PyExpr }
export interface PySlice extends PyNode {
  kind: 'SliceExpr';
  lower: PyExpr | null;
  upper: PyExpr | null;
  step: PyExpr | null;
}
export interface PyUnary extends PyNode { kind: 'Unary'; op: string; operand: PyExpr }
export interface PyBinary extends PyNode { kind: 'Binary'; op: string; left: PyExpr; right: PyExpr }
export interface PyBoolOp extends PyNode { kind: 'BoolOp'; op: 'and' | 'or'; values: PyExpr[] }
export interface PyCompare extends PyNode {
  kind: 'Compare';
  left: PyExpr;
  ops: string[];
  comparators: PyExpr[];
}
export interface PyIfExp extends PyNode { kind: 'IfExp'; test: PyExpr; body: PyExpr; orelse: PyExpr }
export interface PyLambda extends PyNode { kind: 'Lambda'; params: PyParam[]; body: PyExpr }
export interface PyComprehension extends PyNode {
  kind: 'Comprehension';
  form: 'list' | 'set' | 'dict' | 'generator';
  element: PyExpr;
  /** Present only for a dict comprehension. */
  value: PyExpr | null;
  target: PyExpr;
  iter: PyExpr;
  condition: PyExpr | null;
}

// ── statements ───────────────────────────────────────────────────────────────

export type PyStmt =
  | PyExprStmt
  | PyAssign
  | PyAugAssign
  | PyIf
  | PyWhile
  | PyFor
  | PyFuncDef
  | PyClassDef
  | PyReturn
  | PyBreak
  | PyContinue
  | PyPass
  | PyImport
  | PyImportFrom
  | PyGlobal
  | PyDelete
  | PyTry
  | PyRaise
  | PyWith
  | PyAssert;

export interface PyExprStmt extends PyNode { kind: 'ExprStmt'; value: PyExpr }
export interface PyAssign extends PyNode { kind: 'Assign'; targets: PyExpr[]; value: PyExpr }
export interface PyAugAssign extends PyNode {
  kind: 'AugAssign';
  target: PyExpr;
  op: string;
  value: PyExpr;
}
export interface PyIf extends PyNode {
  kind: 'If';
  test: PyExpr;
  body: PyStmt[];
  orelse: PyStmt[];
}
export interface PyWhile extends PyNode {
  kind: 'While';
  test: PyExpr;
  body: PyStmt[];
  orelse: PyStmt[];
}
export interface PyFor extends PyNode {
  kind: 'For';
  target: PyExpr;
  iter: PyExpr;
  body: PyStmt[];
  orelse: PyStmt[];
}
export interface PyParam { name: string; def: PyExpr | null; star?: boolean }
export interface PyFuncDef extends PyNode {
  kind: 'FuncDef';
  name: string;
  params: PyParam[];
  body: PyStmt[];
}
export interface PyClassDef extends PyNode {
  kind: 'ClassDef';
  name: string;
  bases: PyExpr[];
  body: PyStmt[];
}
export interface PyReturn extends PyNode { kind: 'Return'; value: PyExpr | null }
export interface PyBreak extends PyNode { kind: 'Break' }
export interface PyContinue extends PyNode { kind: 'Continue' }
export interface PyPass extends PyNode { kind: 'Pass' }
export interface PyImport extends PyNode {
  kind: 'Import';
  names: { name: string; asname: string | null }[];
}
export interface PyImportFrom extends PyNode {
  kind: 'ImportFrom';
  module: string;
  names: { name: string; asname: string | null }[];
}
export interface PyGlobal extends PyNode { kind: 'Global'; names: string[] }
export interface PyDelete extends PyNode { kind: 'Delete'; targets: PyExpr[] }
export interface PyExceptHandler {
  type: PyExpr | null;
  name: string | null;
  body: PyStmt[];
}
export interface PyTry extends PyNode {
  kind: 'Try';
  body: PyStmt[];
  handlers: PyExceptHandler[];
  orelse: PyStmt[];
  finalbody: PyStmt[];
}
export interface PyRaise extends PyNode { kind: 'Raise'; exc: PyExpr | null }
export interface PyWith extends PyNode {
  kind: 'With';
  items: { context: PyExpr; optional: PyExpr | null }[];
  body: PyStmt[];
}
export interface PyAssert extends PyNode { kind: 'Assert'; test: PyExpr; msg: PyExpr | null }

export interface PyModule {
  body: PyStmt[];
  imports: string[];
}
