import type { Circuit } from '../mna/Circuit';
import { audio } from '../audio';
import { clamp, defineDevice, num, R_OPEN, type Device, type DeviceCtx } from './types';

/** Supply the logic family runs on, and the drive impedance of an output. */
const VLOGIC = 5;
const R_DRIVE = 40;
const THRESHOLD = VLOGIC / 2;

/** Voltage on a pin relative to the part's ground pin (or true ground). */
function pinV(c: Circuit, ctx: DeviceCtx, name: string, gndName = 'GND') {
  const g = ctx.node(gndName);
  return c.v(ctx.node(name)) - (g === -1 ? 0 : c.v(g));
}

function readBit(c: Circuit, ctx: DeviceCtx, name: string, gndName = 'GND') {
  return pinV(c, ctx, name, gndName) > THRESHOLD;
}

/** Drive an output pin hard to a logic level. */
function driveBit(
  c: Circuit,
  ctx: DeviceCtx,
  name: string,
  high: boolean,
  gndName = 'GND',
  supply = VLOGIC,
) {
  const node = ctx.node(name);
  const gnd = ctx.node(gndName);
  const g = 1 / R_DRIVE;
  c.stampConductance(node, gnd, g);
  c.stampCurrentSource(gnd, node, (high ? supply : 0) * g);
}

/** Leave an output floating (tri-state / output-disabled). */
function floatPin(c: Circuit, ctx: DeviceCtx, name: string, gndName = 'GND') {
  c.stampResistance(ctx.node(name), ctx.node(gndName), R_OPEN);
}

export interface LogicSpec {
  inputs: (props: DeviceCtx['props']) => string[];
  outputs: (props: DeviceCtx['props']) => string[];
  /** Pure combinational function, or a sequential one reading/writing `s`. */
  compute(inputs: boolean[], s: Record<string, number>, ctx: DeviceCtx): boolean[];
  /** Names of pins that should rise/fall-edge trigger `compute`. */
  clock?: string;
  gnd?: string;
}

/**
 * Behavioural digital part.
 *
 * Inputs are read as thresholds rather than solved as transistor networks —
 * which is both what the reference product does and what keeps a 74HC595 from
 * costing sixty extra unknowns. Outputs are stamped as stiff sources so they
 * drive real analog loads correctly.
 */
export function logicDevice(spec: LogicSpec): Device {
  const gnd = spec.gnd ?? 'GND';
  return {
    stamp(c, ctx) {
      const ins = spec.inputs(ctx.props).map((n) => readBit(c, ctx, n, gnd));

      if (spec.clock) {
        const clk = readBit(c, ctx, spec.clock, gnd);
        const was = ctx.s.__clk === 1;
        if (clk && !was) ctx.s.__edge = 1;
        else ctx.s.__edge = 0;
        ctx.s.__clk = clk ? 1 : 0;
      }

      const outs = spec.compute(ins, ctx.s, ctx);
      const names = spec.outputs(ctx.props);
      names.forEach((n, i) => {
        const v = outs[i];
        if (v === undefined) floatPin(c, ctx, n, gnd);
        else driveBit(c, ctx, n, v, gnd);
      });
      ctx.s.__out = outs.reduce((acc, b, i) => acc + (b ? 1 << i : 0), 0);
      ctx.s.__in = ins.reduce((acc, b, i) => acc + (b ? 1 << i : 0), 0);
    },
    output(_, ctx) {
      return { inputs: ctx.s.__in ?? 0, outputs: ctx.s.__out ?? 0 };
    },
  };
}

// ─── Gates ───────────────────────────────────────────────────────────────────

type GateOp = (bits: boolean[]) => boolean;

const GATES: Record<string, GateOp> = {
  and: (b) => b.every(Boolean),
  or: (b) => b.some(Boolean),
  nand: (b) => !b.every(Boolean),
  nor: (b) => !b.some(Boolean),
  xor: (b) => b.filter(Boolean).length % 2 === 1,
  xnor: (b) => b.filter(Boolean).length % 2 === 0,
  not: (b) => !b[0],
  buffer: (b) => !!b[0],
};

for (const [name, op] of Object.entries(GATES)) {
  defineDevice(`gate-${name}`, () =>
    logicDevice({
      inputs: (p) => {
        const n = name === 'not' || name === 'buffer' ? 1 : Math.max(2, num(p.inputs, 2));
        return Array.from({ length: n }, (_, i) => `IN${i + 1}`);
      },
      outputs: () => ['OUT'],
      compute: (ins) => [op(ins)],
    }),
  );
}

// ─── Flip-flops and latches ──────────────────────────────────────────────────

defineDevice('flipflop-d', () =>
  logicDevice({
    inputs: () => ['D', 'CLK', 'SET', 'RESET'],
    outputs: () => ['Q', 'Q_'],
    clock: 'CLK',
    compute: ([d, , set, reset], s) => {
      if (set) s.q = 1;
      else if (reset) s.q = 0;
      else if (s.__edge === 1) s.q = d ? 1 : 0;
      const q = s.q === 1;
      return [q, !q];
    },
  }),
);

defineDevice('flipflop-jk', () =>
  logicDevice({
    inputs: () => ['J', 'K', 'CLK', 'SET', 'RESET'],
    outputs: () => ['Q', 'Q_'],
    clock: 'CLK',
    compute: ([j, k, , set, reset], s) => {
      if (set) s.q = 1;
      else if (reset) s.q = 0;
      else if (s.__edge === 1) {
        if (j && k) s.q = s.q === 1 ? 0 : 1;
        else if (j) s.q = 1;
        else if (k) s.q = 0;
      }
      const q = s.q === 1;
      return [q, !q];
    },
  }),
);

defineDevice('flipflop-t', () =>
  logicDevice({
    inputs: () => ['T', 'CLK'],
    outputs: () => ['Q', 'Q_'],
    clock: 'CLK',
    compute: ([t], s) => {
      if (s.__edge === 1 && t) s.q = s.q === 1 ? 0 : 1;
      const q = s.q === 1;
      return [q, !q];
    },
  }),
);

defineDevice('latch-sr', () =>
  logicDevice({
    inputs: () => ['S', 'R'],
    outputs: () => ['Q', 'Q_'],
    compute: ([set, reset], s) => {
      if (set && !reset) s.q = 1;
      else if (reset && !set) s.q = 0;
      const q = s.q === 1;
      return [q, !q];
    },
  }),
);

// ─── Arithmetic and routing ──────────────────────────────────────────────────

defineDevice('half-adder', () =>
  logicDevice({
    inputs: () => ['A', 'B'],
    outputs: () => ['SUM', 'CARRY'],
    compute: ([a, b]) => [a !== b, a && b],
  }),
);

defineDevice('full-adder', () =>
  logicDevice({
    inputs: () => ['A', 'B', 'CIN'],
    outputs: () => ['SUM', 'COUT'],
    compute: ([a, b, cin]) => {
      const sum = (a ? 1 : 0) + (b ? 1 : 0) + (cin ? 1 : 0);
      return [sum % 2 === 1, sum >= 2];
    },
  }),
);

defineDevice('adder-4bit', () =>
  logicDevice({
    inputs: () => ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'CIN'],
    outputs: () => ['S1', 'S2', 'S3', 'S4', 'COUT'],
    compute: (ins) => {
      const a = bitsToInt(ins.slice(0, 4));
      const b = bitsToInt(ins.slice(4, 8));
      const total = a + b + (ins[8] ? 1 : 0);
      return [...intToBits(total & 0xf, 4), total > 0xf];
    },
  }),
);

defineDevice('mux', () =>
  logicDevice({
    inputs: (p) => {
      const w = Math.max(2, num(p.width, 4));
      const sel = Math.ceil(Math.log2(w));
      return [
        ...Array.from({ length: w }, (_, i) => `IN${i + 1}`),
        ...Array.from({ length: sel }, (_, i) => `SEL${i + 1}`),
      ];
    },
    outputs: () => ['OUT'],
    compute: (ins, _s, ctx) => {
      const w = Math.max(2, num(ctx.props.width, 4));
      const sel = bitsToInt(ins.slice(w));
      return [!!ins[sel % w]];
    },
  }),
);

defineDevice('demux', () =>
  logicDevice({
    inputs: (p) => {
      const w = Math.max(2, num(p.width, 4));
      const sel = Math.ceil(Math.log2(w));
      return ['IN', ...Array.from({ length: sel }, (_, i) => `SEL${i + 1}`)];
    },
    outputs: (p) => {
      const w = Math.max(2, num(p.width, 4));
      return Array.from({ length: w }, (_, i) => `OUT${i + 1}`);
    },
    compute: (ins, _s, ctx) => {
      const w = Math.max(2, num(ctx.props.width, 4));
      const sel = bitsToInt(ins.slice(1)) % w;
      return Array.from({ length: w }, (_, i) => i === sel && ins[0]);
    },
  }),
);

defineDevice('decoder-3to8', () =>
  logicDevice({
    inputs: () => ['A', 'B', 'C', 'EN'],
    outputs: () => Array.from({ length: 8 }, (_, i) => `Y${i}`),
    compute: ([a, b, cc, en]) => {
      const sel = bitsToInt([a, b, cc]);
      return Array.from({ length: 8 }, (_, i) => en && i === sel);
    },
  }),
);

defineDevice('comparator-4bit', () =>
  logicDevice({
    inputs: () => ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
    outputs: () => ['LT', 'EQ', 'GT'],
    compute: (ins) => {
      const a = bitsToInt(ins.slice(0, 4));
      const b = bitsToInt(ins.slice(4, 8));
      return [a < b, a === b, a > b];
    },
  }),
);

defineDevice('counter-4bit', () =>
  logicDevice({
    inputs: () => ['CLK', 'RESET', 'EN'],
    outputs: () => ['Q1', 'Q2', 'Q3', 'Q4'],
    clock: 'CLK',
    compute: ([, reset, en], s) => {
      if (reset) s.count = 0;
      else if (s.__edge === 1 && en) s.count = ((s.count ?? 0) + 1) & 0xf;
      return intToBits(s.count ?? 0, 4);
    },
  }),
);

defineDevice('shift-register-4bit', () =>
  logicDevice({
    inputs: () => ['DATA', 'CLK', 'RESET'],
    outputs: () => ['Q1', 'Q2', 'Q3', 'Q4'],
    clock: 'CLK',
    compute: ([data, , reset], s) => {
      if (reset) s.reg = 0;
      else if (s.__edge === 1) s.reg = (((s.reg ?? 0) << 1) | (data ? 1 : 0)) & 0xf;
      return intToBits(s.reg ?? 0, 4);
    },
  }),
);

// ─── 74HC595 serial-in parallel-out ──────────────────────────────────────────

defineDevice('74hc595', () =>
  logicDevice({
    inputs: () => ['DS', 'SHCP', 'STCP', 'MR', 'OE'],
    outputs: () => ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q7S'],
    compute: ([ds, shcp, stcp, mr, oe], s) => {
      // Shift on the rising edge of SHCP, latch on the rising edge of STCP.
      const shiftEdge = shcp && s.__shcp !== 1;
      const latchEdge = stcp && s.__stcp !== 1;
      s.__shcp = shcp ? 1 : 0;
      s.__stcp = stcp ? 1 : 0;

      if (!mr) s.shift = 0;
      else if (shiftEdge) s.shift = (((s.shift ?? 0) << 1) | (ds ? 1 : 0)) & 0xff;
      if (latchEdge) s.latch = s.shift ?? 0;

      if (oe) return [...Array(8).fill(undefined), ((s.shift ?? 0) >> 7) & 1 ? true : false];
      const latched = s.latch ?? 0;
      return [
        ...Array.from({ length: 8 }, (_, i) => ((latched >> i) & 1) === 1),
        (((s.shift ?? 0) >> 7) & 1) === 1,
      ];
    },
  }),
);

// ─── CD4017 decade counter ───────────────────────────────────────────────────

defineDevice('cd4017', () =>
  logicDevice({
    inputs: () => ['CLK', 'INH', 'MR'],
    outputs: () => [...Array.from({ length: 10 }, (_, i) => `Q${i}`), 'CO'],
    clock: 'CLK',
    compute: ([, inh, mr], s) => {
      if (mr) s.count = 0;
      else if (s.__edge === 1 && !inh) s.count = ((s.count ?? 0) + 1) % 10;
      const n = s.count ?? 0;
      return [...Array.from({ length: 10 }, (_, i) => i === n), n < 5];
    },
  }),
);

// ─── CD4511 BCD to seven-segment ─────────────────────────────────────────────

const SEG_MAP = [
  0b0111111, 0b0000110, 0b1011011, 0b1001111, 0b1100110,
  0b1101101, 0b1111101, 0b0000111, 0b1111111, 0b1101111,
];

defineDevice('cd4511', () =>
  logicDevice({
    inputs: () => ['A', 'B', 'C', 'D', 'LT', 'BL', 'LE'],
    outputs: () => ['Qa', 'Qb', 'Qc', 'Qd', 'Qe', 'Qf', 'Qg'],
    compute: ([a, b, cc, d, lt, bl, le], s) => {
      const digit = bitsToInt([a, b, cc, d]);
      if (!le) s.digit = digit;
      const shown = s.digit ?? 0;
      if (!lt) return Array(7).fill(true);
      if (!bl) return Array(7).fill(false);
      const mask = SEG_MAP[shown] ?? 0;
      return Array.from({ length: 7 }, (_, i) => ((mask >> i) & 1) === 1);
    },
  }),
);

// ─── ULN2003 Darlington array ────────────────────────────────────────────────

defineDevice('uln2003', (): Device => ({
  stamp(c, ctx) {
    for (let i = 1; i <= 7; i++) {
      const on = readBit(c, ctx, `IN${i}`, 'GND');
      // Open-collector: pulls to ~0.9 V when on, otherwise high impedance.
      const out = ctx.node(`OUT${i}`);
      const gnd = ctx.node('GND');
      if (on) {
        const g = 1 / 3;
        c.stampConductance(out, gnd, g);
        c.stampCurrentSource(gnd, out, 0.9 * g);
      } else {
        c.stampResistance(out, gnd, R_OPEN);
      }
    }
  },
  output() {
    return {};
  },
}));

// ─── Clock generator, logic toggle and probe ─────────────────────────────────

defineDevice('clock-generator', (): Device => ({
  needsFineStep: true,
  stamp(c, ctx) {
    const hz = Math.max(0.1, num(ctx.props.frequency, 1));
    const phase = ((ctx.t * hz) % 1 + 1) % 1;
    const high = phase < num(ctx.props.duty, 50) / 100;
    ctx.s.high = high ? 1 : 0;
    const node = ctx.node('OUT');
    const gnd = ctx.node('GND');
    const g = 1 / R_DRIVE;
    c.stampConductance(node, gnd, g);
    c.stampCurrentSource(gnd, node, (high ? VLOGIC : 0) * g);
  },
  output(_, ctx) {
    return { high: ctx.s.high === 1 };
  },
}));

defineDevice('logic-toggle', (): Device => ({
  stamp(c, ctx) {
    const high = ctx.s.high === 1;
    const g = 1 / R_DRIVE;
    c.stampConductance(ctx.node('OUT'), ctx.node('GND'), g);
    c.stampCurrentSource(ctx.node('GND'), ctx.node('OUT'), (high ? VLOGIC : 0) * g);
  },
  interact(event, value, ctx) {
    if (event === 'toggle') ctx.s.high = ctx.s.high === 1 ? 0 : 1;
    if (event === 'set') ctx.s.high = value ? 1 : 0;
  },
  output(_, ctx) {
    return { high: ctx.s.high === 1 };
  },
}));

defineDevice('logic-probe', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(ctx.node('IN'), ctx.node('GND'), 1e6);
  },
  output(c, ctx) {
    const v = pinV(c, ctx, 'IN');
    return { voltage: v, high: v > THRESHOLD, floating: Math.abs(v) < 0.15 };
  },
}));

// ─── 555 timer ───────────────────────────────────────────────────────────────

/**
 * Behavioural 555: two comparators against the internal divider, an RS latch,
 * and the discharge transistor. Modelling it this way rather than at the
 * transistor level keeps the astable configuration rock-solid.
 */
defineDevice('timer-555', (): Device => ({
  needsFineStep: true,
  stamp(c, ctx) {
    const gnd = ctx.node('GND');
    const vcc = c.v(ctx.node('VCC')) - c.v(gnd);
    const upper = (2 / 3) * vcc;
    const lower = (1 / 3) * vcc;

    const threshold = c.v(ctx.node('THR')) - c.v(gnd);
    const trigger = c.v(ctx.node('TRIG')) - c.v(gnd);
    const reset = c.v(ctx.node('RESET')) - c.v(gnd);

    if (reset < 0.7 && ctx.node('RESET') !== -1) ctx.s.q = 0;
    else if (trigger < lower) ctx.s.q = 1;
    else if (threshold > upper) ctx.s.q = 0;

    const on = ctx.s.q === 1;

    // Output push-pull, roughly 1.7 V below the rail when high.
    const g = 1 / 10;
    c.stampConductance(ctx.node('OUT'), gnd, g);
    c.stampCurrentSource(gnd, ctx.node('OUT'), (on ? Math.max(0, vcc - 1.7) : 0.1) * g);

    // Discharge transistor to ground when the output is low.
    c.stampResistance(ctx.node('DIS'), gnd, on ? R_OPEN : 20);

    // Internal 5 kΩ divider chain.
    c.stampResistance(ctx.node('VCC'), ctx.node('CTRL'), 5000);
    c.stampResistance(ctx.node('CTRL'), gnd, 10000);

    ctx.s.vcc = vcc;
  },
  output(_, ctx) {
    return { out: ctx.s.q === 1, vcc: ctx.s.vcc ?? 0 };
  },
}));

// ─── Op-amp and comparator ───────────────────────────────────────────────────

/**
 * Op-amp as a voltage-controlled voltage source with a branch unknown, clamped
 * to the supply rails. The gain is finite (200 k) which is what keeps a
 * follower stable instead of oscillating between rails.
 */
defineDevice('opamp', (): Device => ({
  branches: 1,
  nonlinear: true,
  stamp(c, ctx) {
    const k = ctx.branch0;
    const vp = c.v(ctx.node('IN+'));
    const vn = c.v(ctx.node('IN-'));
    const vsp = c.v(ctx.node('V+'));
    const vsn = c.v(ctx.node('V-'));
    const gain = 2e5;

    const ideal = (vp - vn) * gain;
    const hi = vsp - 1.2;
    const lo = vsn + 1.2;

    if (ideal > hi || ideal < lo) {
      // Saturated: hold the output at the rail with a plain source.
      c.stampVoltageSource(ctx.node('OUT'), -1, k, clamp(ideal, lo, hi));
      ctx.s.saturated = 1;
    } else {
      c.stampVCVS(ctx.node('OUT'), -1, ctx.node('IN+'), ctx.node('IN-'), k, gain);
      ctx.s.saturated = 0;
    }
    // Input bias paths so unconnected inputs are still referenced.
    c.stampResistance(ctx.node('IN+'), -1, 1e9);
    c.stampResistance(ctx.node('IN-'), -1, 1e9);
    ctx.s.vout = c.v(ctx.node('OUT'));
  },
  output(_, ctx) {
    return { vout: ctx.s.vout ?? 0, saturated: ctx.s.saturated === 1 };
  },
}));

defineDevice('comparator', (): Device => ({
  stamp(c, ctx) {
    const gnd = ctx.node('GND');
    const vp = c.v(ctx.node('IN+')) - c.v(gnd);
    const vn = c.v(ctx.node('IN-')) - c.v(gnd);
    const high = vp > vn;
    ctx.s.high = high ? 1 : 0;
    // Open-collector output, like an LM339.
    if (high) c.stampResistance(ctx.node('OUT'), gnd, R_OPEN);
    else {
      const g = 1 / 20;
      c.stampConductance(ctx.node('OUT'), gnd, g);
      c.stampCurrentSource(gnd, ctx.node('OUT'), 0.2 * g);
    }
    c.stampResistance(ctx.node('IN+'), gnd, 1e8);
    c.stampResistance(ctx.node('IN-'), gnd, 1e8);
  },
  output(_, ctx) {
    return { high: ctx.s.high === 1 };
  },
}));

// ─── Buzzer-style piezo driven directly by logic (no MCU present) ────────────

defineDevice('logic-sounder', (): Device => ({
  needsFineStep: true,
  stamp(c, ctx) {
    c.stampResistance(ctx.node('IN'), ctx.node('GND'), 1000);
  },
  commit(c, ctx) {
    const v = pinV(c, ctx, 'IN');
    const high = v > THRESHOLD;
    if ((ctx.s.high === 1) !== high) {
      const period = (ctx.t - (ctx.s.lastEdge ?? 0)) * 2;
      if (period > 1 / 20000 && period < 1 / 20) ctx.s.freq = 1 / period;
      ctx.s.lastEdge = ctx.t;
      ctx.s.high = high ? 1 : 0;
      ctx.s.silence = 0;
    } else {
      ctx.s.silence = (ctx.s.silence ?? 0) + ctx.dt;
    }
    const id = `logic:${ctx.partId}`;
    if ((ctx.s.silence ?? 1) < 0.05 && (ctx.s.freq ?? 0) > 0) {
      audio.play(id, ctx.s.freq, 0.5, 'square');
    } else audio.stop(id);
  },
  output(_, ctx) {
    return { frequency: ctx.s.freq ?? 0 };
  },
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

function bitsToInt(bits: boolean[]): number {
  return bits.reduce((acc, b, i) => acc + (b ? 1 << i : 0), 0);
}

function intToBits(v: number, n: number): boolean[] {
  return Array.from({ length: n }, (_, i) => ((v >> i) & 1) === 1);
}
