/**
 * Runtime values.
 *
 * Integers are stored as JS numbers but truncated to the width the AVR target
 * actually uses on every assignment, so `int` overflows at 32767 exactly as it
 * does on a real board — a classic source of student bugs that a simulator
 * silently hiding would make useless.
 */

/** What the VM yields when it needs simulated time to pass. */
export interface Wait {
  cycles: number;
}

/**
 * A library method. Most return immediately; ones that consume simulated time
 * (a blocking read, a timed pulse) return a generator so they can suspend the
 * VM instead of blocking the frame.
 */
export type MethodFn = (args: Value[]) => Value | Generator<Wait, Value, void>;

export type Value =
  | number
  | string
  | ArduinoArray
  | StructValue
  | ObjectValue
  | null;

export class ArduinoArray {
  constructor(
    public items: Value[],
    public elemType: string,
  ) {}
  get length() {
    return this.items.length;
  }
}

export class StructValue {
  constructor(
    public typeName: string,
    public fields: Map<string, Value>,
  ) {}
}

/** A library object (Servo, LiquidCrystal…) backed by native methods. */
export class ObjectValue {
  constructor(
    public className: string,
    public methods: Record<string, MethodFn>,
    public state: Record<string, unknown> = {},
  ) {}
}

export interface Ref {
  get(): Value;
  set(v: Value): void;
}

const WIDTHS: Record<string, { bits: number; signed: boolean }> = {
  bool: { bits: 1, signed: false },
  char: { bits: 8, signed: true },
  byte: { bits: 8, signed: false },
  int: { bits: 16, signed: true },
  word: { bits: 16, signed: false },
  short: { bits: 16, signed: true },
  long: { bits: 32, signed: true },
  longlong: { bits: 64, signed: true },
};

/** Coerce a value to the storage width of a declared type. */
export function coerce(v: Value, type: string, unsigned: boolean): Value {
  if (type === 'float' || type === 'double') return toNum(v);
  if (type === 'String' || type === 'string') return toStr(v);
  if (type === 'void') return v;
  const w = WIDTHS[type];
  if (!w) return v; // struct, class, pointer — pass through
  if (typeof v !== 'number') {
    if (v === null) return 0;
    if (typeof v === 'string') return truncate(parseFloat(v) || 0, w.bits, !unsigned && w.signed);
    return v;
  }
  if (type === 'bool') return v ? 1 : 0;
  return truncate(v, w.bits, !unsigned && w.signed);
}

function truncate(v: number, bits: number, signed: boolean): number {
  const t = Math.trunc(v);
  if (bits >= 64 || !Number.isFinite(t)) return t;
  const mod = Math.pow(2, bits);
  let r = ((t % mod) + mod) % mod;
  if (signed && r >= mod / 2) r -= mod;
  return r;
}

export function toNum(v: Value): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v === null) return 0;
  if (v instanceof ArduinoArray) return v.length;
  return 0;
}

export function toStr(v: Value): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return formatNumber(v);
  if (v === null) return '';
  if (v instanceof ArduinoArray) {
    // char arrays print as text, everything else as a list
    if (v.elemType === 'char') {
      return v.items
        .map((c) => String.fromCharCode(toNum(c)))
        .join('')
        .replace(/\0.*$/, '');
    }
    return v.items.map(toStr).join(',');
  }
  return '';
}

export function toBool(v: Value): boolean {
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v.length > 0;
  return v !== null;
}

/** Arduino prints whole floats without a decimal point and doubles to 2 dp. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : Number.isNaN(n) ? 'nan' : '-inf';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function formatWithBase(n: number, base: number): string {
  const t = Math.trunc(n);
  if (base === 10) return String(t);
  const v = t < 0 ? t >>> 0 : t;
  return v.toString(base).toUpperCase();
}

export function formatFloat(n: number, digits: number): string {
  return n.toFixed(Math.max(0, Math.min(20, digits)));
}
