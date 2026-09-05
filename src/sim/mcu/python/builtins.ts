import type { PyInterpreter } from './Interpreter';
import {
  asSequence,
  PyDict,
  PyList,
  PyNative,
  PySet,
  PyTuple,
  pyEquals,
  pyLen,
  pyNum,
  pyRepr,
  pyStr,
  truthy,
  typeName,
  type PyValue,
} from './values';

/**
 * The Python built-ins a micro:bit program actually reaches for. `print` is
 * routed to the caller so it lands in the serial monitor, which is where the
 * real board sends it too.
 */
export function installBuiltins(interp: PyInterpreter, print: (text: string) => void) {
  const B = interp.builtins;
  const def = (name: string, fn: (args: PyValue[], kwargs: Record<string, PyValue>) => PyValue) =>
    B.set(name, new PyNative(name, fn));

  def('print', (args, kwargs) => {
    const sep = kwargs.sep !== undefined ? pyStr(kwargs.sep) : ' ';
    const end = kwargs.end !== undefined ? pyStr(kwargs.end) : '\n';
    print(args.map(pyStr).join(sep) + end);
    return null;
  });

  def('len', (a) => pyLen(a[0]));
  def('str', (a) => (a.length ? pyStr(a[0]) : ''));
  def('repr', (a) => pyRepr(a[0]));
  def('int', (a) => {
    if (a.length > 1) return parseInt(pyStr(a[0]).trim(), pyNum(a[1])) || 0;
    const v = a[0];
    if (typeof v === 'string') {
      const n = parseInt(v.trim(), 10);
      return Number.isFinite(n) ? n : 0;
    }
    return Math.trunc(pyNum(v));
  });
  def('float', (a) => pyNum(a[0]));
  def('bool', (a) => (a.length ? truthy(a[0]) : false));
  def('abs', (a) => Math.abs(pyNum(a[0])));
  def('round', (a) => {
    const n = pyNum(a[0]);
    const digits = a[1] === undefined ? 0 : Math.trunc(pyNum(a[1]));
    const f = Math.pow(10, digits);
    const r = Math.round(Math.abs(n) * f) / f;
    return (n < 0 ? -r : r) * 1;
  });
  def('min', (a) => reduceSeq(a, (x, y) => (pyNum(y) < pyNum(x) ? y : x)));
  def('max', (a) => reduceSeq(a, (x, y) => (pyNum(y) > pyNum(x) ? y : x)));
  def('sum', (a) =>
    (asSequence(a[0]) ?? []).reduce<number>((t, v) => t + pyNum(v), pyNum(a[1] ?? 0)),
  );
  def('pow', (a) => Math.pow(pyNum(a[0]), pyNum(a[1])));
  def('divmod', (a) => {
    const x = pyNum(a[0]);
    const y = pyNum(a[1]);
    return new PyTuple([Math.floor(x / y), ((x % y) + y) % y]);
  });
  def('hex', (a) => {
    const n = Math.trunc(pyNum(a[0]));
    return n < 0 ? `-0x${(-n).toString(16)}` : `0x${n.toString(16)}`;
  });
  def('bin', (a) => {
    const n = Math.trunc(pyNum(a[0]));
    return n < 0 ? `-0b${(-n).toString(2)}` : `0b${n.toString(2)}`;
  });
  def('ord', (a) => pyStr(a[0]).charCodeAt(0) || 0);
  def('chr', (a) => String.fromCharCode(Math.trunc(pyNum(a[0]))));

  def('range', (a) => {
    const start = a.length > 1 ? pyNum(a[0]) : 0;
    const stop = a.length > 1 ? pyNum(a[1]) : pyNum(a[0]);
    const step = a.length > 2 ? pyNum(a[2]) || 1 : 1;
    const out: PyValue[] = [];
    // Guard against an accidental huge range wedging the frame.
    const limit = 200_000;
    if (step > 0) for (let i = start; i < stop && out.length < limit; i += step) out.push(i);
    else for (let i = start; i > stop && out.length < limit; i += step) out.push(i);
    return new PyList(out);
  });

  def('list', (a) => new PyList(a.length ? [...(asSequence(a[0]) ?? [])] : []));
  def('tuple', (a) => new PyTuple(a.length ? [...(asSequence(a[0]) ?? [])] : []));
  def('set', (a) => {
    const out: PyValue[] = [];
    for (const v of asSequence(a[0] ?? null) ?? []) {
      if (!out.some((x) => pyEquals(x, v))) out.push(v);
    }
    return new PySet(out);
  });
  def('dict', (a) => {
    const d = new PyDict();
    if (a[0] instanceof PyDict) for (const [k, v] of a[0].entries()) d.set(k, v);
    else {
      for (const pair of asSequence(a[0] ?? null) ?? []) {
        const p = asSequence(pair);
        if (p && p.length >= 2) d.set(p[0], p[1]);
      }
    }
    return d;
  });

  def('sorted', (a, kw) => {
    const items = [...(asSequence(a[0]) ?? [])];
    items.sort((x, y) => {
      if (typeof x === 'string' && typeof y === 'string') return x < y ? -1 : x > y ? 1 : 0;
      return pyNum(x) - pyNum(y);
    });
    if (truthy(kw.reverse ?? false)) items.reverse();
    return new PyList(items);
  });
  def('reversed', (a) => new PyList([...(asSequence(a[0]) ?? [])].reverse()));

  def('enumerate', (a) => {
    const start = a[1] === undefined ? 0 : pyNum(a[1]);
    return new PyList(
      (asSequence(a[0]) ?? []).map((v, i) => new PyTuple([i + start, v])),
    );
  });

  def('zip', (a) => {
    const seqs = a.map((s) => asSequence(s) ?? []);
    const n = Math.min(...seqs.map((s) => s.length), Infinity);
    const out: PyValue[] = [];
    for (let i = 0; i < n; i++) out.push(new PyTuple(seqs.map((s) => s[i])));
    return new PyList(out);
  });

  def('any', (a) => (asSequence(a[0]) ?? []).some(truthy));
  def('all', (a) => (asSequence(a[0]) ?? []).every(truthy));

  def('isinstance', (a) => {
    const want = a[1];
    const names = want instanceof PyTuple ? want.items.map(nameOfType) : [nameOfType(want)];
    const actual = typeName(a[0]);
    // int counts as a float for isinstance, as CPython's numeric tower does not
    // but micro:bit programs routinely assume.
    return names.some((n) => n === actual || (n === 'float' && actual === 'int'));
  });
  def('type', (a) => typeName(a[0]));

  def('input', () => '');
  def('id', () => 0);
  def('hasattr', (a) => {
    try {
      interp.getAttr(a[0], pyStr(a[1]), 0);
      return true;
    } catch {
      return false;
    }
  });
  def('getattr', (a) => {
    try {
      return interp.getAttr(a[0], pyStr(a[1]), 0);
    } catch {
      return a[2] ?? null;
    }
  });

  // Exception classes are matched by name, so a bare marker is enough.
  for (const name of [
    'Exception', 'BaseException', 'ValueError', 'TypeError', 'IndexError',
    'KeyError', 'ZeroDivisionError', 'AttributeError', 'NameError',
    'RuntimeError', 'OSError', 'StopIteration', 'AssertionError',
    'MemoryError', 'NotImplementedError', 'ImportError',
  ]) {
    B.set(name, new PyNative(name, (a) => (a.length ? pyStr(a[0]) : '')));
  }

  B.set('True', true);
  B.set('False', false);
  B.set('None', null);
}

function reduceSeq(args: PyValue[], pick: (a: PyValue, b: PyValue) => PyValue): PyValue {
  const items = args.length === 1 ? (asSequence(args[0]) ?? []) : args;
  if (!items.length) return null;
  return items.reduce(pick);
}

function nameOfType(v: PyValue): string {
  if (v instanceof PyNative) return v.name;
  return typeName(v);
}
