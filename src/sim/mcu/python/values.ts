import type { PyFuncDef, PyLambda } from './ast';

/** What the VM yields when it needs simulated time to pass. */
export interface PyWait {
  cycles: number;
}

export type PyValue =
  | number
  | string
  | boolean
  | null
  | PyList
  | PyTuple
  | PyDict
  | PySet
  | PyFunction
  | PyNative
  | PyInstance
  | PyClass
  | PyModule;

export class PyList {
  constructor(public items: PyValue[] = []) {}
}

export class PyTuple {
  constructor(public items: PyValue[] = []) {}
}

export class PySet {
  constructor(public items: PyValue[] = []) {}
}

export class PyDict {
  /** Keys are normalised to a primitive so lookups behave like Python's. */
  map = new Map<string | number | boolean, { key: PyValue; value: PyValue }>();

  static from(pairs: [PyValue, PyValue][]) {
    const d = new PyDict();
    for (const [k, v] of pairs) d.set(k, v);
    return d;
  }
  static hash(k: PyValue): string | number | boolean {
    if (typeof k === 'number' || typeof k === 'string' || typeof k === 'boolean') return k;
    if (k === null) return 'None';
    return `obj:${String(k)}`;
  }
  set(key: PyValue, value: PyValue) {
    this.map.set(PyDict.hash(key), { key, value });
  }
  get(key: PyValue): PyValue | undefined {
    return this.map.get(PyDict.hash(key))?.value;
  }
  has(key: PyValue) {
    return this.map.has(PyDict.hash(key));
  }
  delete(key: PyValue) {
    this.map.delete(PyDict.hash(key));
  }
  keys(): PyValue[] {
    return [...this.map.values()].map((e) => e.key);
  }
  values(): PyValue[] {
    return [...this.map.values()].map((e) => e.value);
  }
  entries(): [PyValue, PyValue][] {
    return [...this.map.values()].map((e) => [e.key, e.value] as [PyValue, PyValue]);
  }
  get size() {
    return this.map.size;
  }
}

export class PyFunction {
  constructor(
    public def: PyFuncDef | PyLambda,
    public closure: unknown,
    public name = 'lambda',
    /** Bound instance for a method call. */
    public self: PyValue = null,
  ) {}
}

/**
 * A function implemented in TypeScript. Returning a generator lets it suspend
 * the VM — which is how `sleep()` and the blocking display calls work.
 */
export class PyNative {
  constructor(
    public name: string,
    public fn: (args: PyValue[], kwargs: Record<string, PyValue>) =>
      | PyValue
      | Generator<PyWait, PyValue, void>,
  ) {}
}

/** A user-defined class. */
export class PyClass {
  constructor(
    public name: string,
    public attrs: Map<string, PyValue>,
    public bases: PyClass[] = [],
  ) {}

  lookup(name: string): PyValue | undefined {
    if (this.attrs.has(name)) return this.attrs.get(name);
    for (const b of this.bases) {
      const v = b.lookup(name);
      if (v !== undefined) return v;
    }
    return undefined;
  }
}

/** An instance of a user class, or a native object exposing methods. */
export class PyInstance {
  constructor(
    public cls: PyClass | null,
    public attrs = new Map<string, PyValue>(),
    /** Display name for native objects with no user class. */
    public typeName = 'object',
  ) {}
}

/** A module namespace: `microbit`, `music`, `random`… */
export class PyModule {
  constructor(
    public name: string,
    public attrs = new Map<string, PyValue>(),
  ) {}
}

// ── coercions ────────────────────────────────────────────────────────────────

export function truthy(v: PyValue): boolean {
  if (v === null || v === false) return false;
  if (v === true) return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  if (v instanceof PyList || v instanceof PyTuple || v instanceof PySet) return v.items.length > 0;
  if (v instanceof PyDict) return v.size > 0;
  return true;
}

export function pyNum(v: PyValue): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v === null) return 0;
  return 0;
}

/** `str()` — matches CPython's formatting closely enough to read naturally. */
export function pyStr(v: PyValue): string {
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    if (!Number.isFinite(v)) return v > 0 ? 'inf' : Number.isNaN(v) ? 'nan' : '-inf';
    return String(Math.round(v * 1e12) / 1e12);
  }
  if (v instanceof PyList) return `[${v.items.map(pyRepr).join(', ')}]`;
  if (v instanceof PyTuple) {
    return v.items.length === 1
      ? `(${pyRepr(v.items[0])},)`
      : `(${v.items.map(pyRepr).join(', ')})`;
  }
  if (v instanceof PySet) return v.items.length ? `{${v.items.map(pyRepr).join(', ')}}` : 'set()';
  if (v instanceof PyDict) {
    return `{${v.entries().map(([k, val]) => `${pyRepr(k)}: ${pyRepr(val)}`).join(', ')}}`;
  }
  if (v instanceof PyFunction) return `<function ${v.name}>`;
  if (v instanceof PyNative) return `<built-in function ${v.name}>`;
  if (v instanceof PyClass) return `<class '${v.name}'>`;
  if (v instanceof PyModule) return `<module '${v.name}'>`;
  if (v instanceof PyInstance) {
    const str = v.attrs.get('__str__');
    if (typeof str === 'string') return str;
    return `<${v.cls?.name ?? v.typeName} object>`;
  }
  return String(v);
}

export function pyRepr(v: PyValue): string {
  if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
  return pyStr(v);
}

export function pyEquals(a: PyValue, b: PyValue): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'boolean') return a === (b ? 1 : 0);
  if (typeof a === 'boolean' && typeof b === 'number') return (a ? 1 : 0) === b;
  if (a instanceof PyList && b instanceof PyList) return seqEq(a.items, b.items);
  if (a instanceof PyTuple && b instanceof PyTuple) return seqEq(a.items, b.items);
  if (a instanceof PySet && b instanceof PySet) {
    return a.items.length === b.items.length && a.items.every((x) => b.items.some((y) => pyEquals(x, y)));
  }
  if (a instanceof PyDict && b instanceof PyDict) {
    if (a.size !== b.size) return false;
    return a.entries().every(([k, v]) => b.has(k) && pyEquals(b.get(k)!, v));
  }
  return false;
}

const seqEq = (a: PyValue[], b: PyValue[]) =>
  a.length === b.length && a.every((x, i) => pyEquals(x, b[i]));

/** Sequence view for iteration, indexing and `len`. */
export function asSequence(v: PyValue): PyValue[] | null {
  if (v instanceof PyList || v instanceof PyTuple || v instanceof PySet) return v.items;
  if (typeof v === 'string') return [...v];
  if (v instanceof PyDict) return v.keys();
  return null;
}

export function pyLen(v: PyValue): number {
  if (typeof v === 'string') return v.length;
  if (v instanceof PyDict) return v.size;
  const seq = asSequence(v);
  if (seq) return seq.length;
  if (v instanceof PyInstance) {
    const n = v.attrs.get('__len__');
    if (typeof n === 'number') return n;
    const items = asSequence(v.attrs.get('__items__') ?? null);
    if (items) return items.length;
  }
  return 0;
}

export function typeName(v: PyValue): string {
  if (v === null) return 'NoneType';
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float';
  if (typeof v === 'string') return 'str';
  if (v instanceof PyList) return 'list';
  if (v instanceof PyTuple) return 'tuple';
  if (v instanceof PySet) return 'set';
  if (v instanceof PyDict) return 'dict';
  if (v instanceof PyFunction || v instanceof PyNative) return 'function';
  if (v instanceof PyClass) return 'type';
  if (v instanceof PyModule) return 'module';
  if (v instanceof PyInstance) return v.cls?.name ?? v.typeName;
  return 'object';
}

/** Python's negative-index and clamping rules for a slice or subscript. */
export function normaliseIndex(i: number, len: number): number {
  return i < 0 ? i + len : i;
}
