import { LED_COLORS } from '@/lib/tokens';
import {
  clamp,
  defineDevice,
  GMIN,
  num,
  pnjlim,
  R_CLOSED,
  R_OPEN,
  VT,
  type Device,
} from './types';

// ─── Resistor ────────────────────────────────────────────────────────────────

defineDevice('resistor', (): Device => ({
  stamp(c, ctx) {
    const r = Math.max(num(ctx.props.resistance, 220), 1e-6);
    c.stampResistance(ctx.node('a'), ctx.node('b'), r);
  },
  output(c, ctx) {
    const a = ctx.node('a');
    const b = ctx.node('b');
    const r = Math.max(num(ctx.props.resistance, 220), 1e-6);
    const v = c.v(a) - c.v(b);
    const i = v / r;
    const p = v * i;
    // Quarter-watt part: past 125 % it discolours, past 200 % it opens.
    const burnt = ctx.s.burnt === 1 || p > 0.5;
    if (p > 0.5) ctx.s.burnt = 1;
    return { voltage: v, current: i, power: p, burnt };
  },
}));

// ─── Capacitors ──────────────────────────────────────────────────────────────

function capacitor(polarised: boolean): Device {
  return {
    needsFineStep: true,
    stamp(c, ctx) {
      const cap = Math.max(num(ctx.props.capacitance, 1e-7), 1e-15);
      const a = ctx.node('a') >= -1 ? ctx.node('a') : -1;
      const b = ctx.node('b');
      const pa = polarised ? ctx.node('+') : a;
      const pb = polarised ? ctx.node('-') : b;
      const geq = cap / Math.max(ctx.dt, 1e-9);
      c.stampConductance(pa, pb, geq);
      // Backward-Euler companion: a current source carrying the charge held
      // from the previous accepted step.
      c.stampCurrentSource(pb, pa, geq * (ctx.s.vprev ?? 0));
    },
    commit(c, ctx) {
      const pa = polarised ? ctx.node('+') : ctx.node('a');
      const pb = polarised ? ctx.node('-') : ctx.node('b');
      ctx.s.vprev = c.v(pa) - c.v(pb);
      if (polarised && ctx.s.vprev < -1) ctx.s.burnt = 1;
      if (ctx.s.vprev > num(ctx.props.voltage, 50) * 1.5) ctx.s.burnt = 1;
    },
    output(c, ctx) {
      return {
        voltage: ctx.s.vprev ?? 0,
        burnt: ctx.s.burnt === 1,
      };
    },
  };
}

defineDevice('capacitor', () => capacitor(false));
defineDevice('capacitor-polarized', () => capacitor(true));

// ─── Inductor ────────────────────────────────────────────────────────────────

defineDevice('inductor', (): Device => ({
  needsFineStep: true,
  stamp(c, ctx) {
    const l = Math.max(num(ctx.props.inductance, 1e-3), 1e-12);
    const geq = Math.max(ctx.dt, 1e-9) / l;
    c.stampConductance(ctx.node('a'), ctx.node('b'), geq);
    c.stampCurrentSource(ctx.node('a'), ctx.node('b'), ctx.s.iprev ?? 0);
  },
  commit(c, ctx) {
    const l = Math.max(num(ctx.props.inductance, 1e-3), 1e-12);
    const v = c.v(ctx.node('a')) - c.v(ctx.node('b'));
    ctx.s.iprev = (ctx.s.iprev ?? 0) + (Math.max(ctx.dt, 1e-9) / l) * v;
  },
  output(_, ctx) {
    return { current: ctx.s.iprev ?? 0 };
  },
}));

// ─── Diodes ──────────────────────────────────────────────────────────────────

export interface DiodeParams {
  is: number;
  n: number;
  /** Reverse breakdown voltage; Infinity for a plain rectifier. */
  bv: number;
}

export function diodeStamp(
  c: Parameters<Device['stamp']>[0],
  ctx: Parameters<Device['stamp']>[1],
  anode: number,
  cathode: number,
  p: DiodeParams,
  stateKey = 'vdold',
): { i: number; v: number } {
  const nvt = p.n * VT;
  const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * p.is));
  const vraw = c.v(anode) - c.v(cathode);
  const vd = pnjlim(vraw, ctx.s[stateKey] ?? 0, nvt, vcrit);
  if (Math.abs(vd - vraw) > 1e-9) c.limited = true;
  ctx.s[stateKey] = vd;

  let i: number;
  let geq: number;

  if (vd >= -p.bv) {
    const e = Math.exp(clamp(vd / nvt, -60, 60));
    i = p.is * (e - 1);
    geq = (p.is / nvt) * e + GMIN;
  } else {
    // Zener/avalanche region: an exponential mirrored about −BV.
    const e = Math.exp(clamp((-vd - p.bv) / nvt, -60, 60));
    i = -p.is * e;
    geq = (p.is / nvt) * e + GMIN;
  }

  const ieq = i - geq * vd;
  c.stampConductance(anode, cathode, geq);
  c.stampCurrentSource(anode, cathode, ieq);
  return { i, v: vd };
}

function makeDiode(p: DiodeParams, aName = 'anode', kName = 'cathode'): Device {
  return {
    nonlinear: true,
    stamp(c, ctx) {
      diodeStamp(c, ctx, ctx.node(aName), ctx.node(kName), p);
    },
    output(c, ctx) {
      const vd = c.v(ctx.node(aName)) - c.v(ctx.node(kName));
      const nvt = p.n * VT;
      const i =
        vd >= -p.bv
          ? p.is * (Math.exp(clamp(vd / nvt, -60, 60)) - 1)
          : -p.is * Math.exp(clamp((-vd - p.bv) / nvt, -60, 60));
      return { voltage: vd, current: i };
    },
  };
}

defineDevice('diode', () => makeDiode({ is: 2.5e-9, n: 1.8, bv: 75 }));
defineDevice('schottky', () => makeDiode({ is: 2e-6, n: 1.1, bv: 40 }));
defineDevice('zener', (): Device => {
  let dev: Device | null = null;
  return {
    nonlinear: true,
    stamp(c, ctx) {
      if (!dev) dev = makeDiode({ is: 2.5e-9, n: 1.8, bv: num(ctx.props.breakdown, 5.1) });
      dev.stamp(c, ctx);
    },
    output(c, ctx) {
      return dev?.output?.(c, ctx) ?? {};
    },
  };
});

// ─── LED ─────────────────────────────────────────────────────────────────────

/** Rated forward current for a 5 mm indicator LED. */
export const LED_I_RATED = 0.02;
export const LED_I_MAX = 0.05;

export function ledParams(colour: string): DiodeParams & { vf: number } {
  const vf = LED_COLORS[colour]?.vf ?? 1.8;
  const n = 2.2;
  // Choose Is so the junction reaches its rated current at Vf.
  const is = LED_I_RATED / Math.exp(vf / (n * VT));
  return { is, n, bv: 5, vf };
}

defineDevice('led', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const p = ledParams(String(ctx.props.color ?? 'red'));
    if (ctx.s.burnt === 1) {
      c.stampConductance(ctx.node('anode'), ctx.node('cathode'), GMIN);
      return;
    }
    // A small series resistance keeps the exponential from dominating the
    // solve and matches the bulk resistance of a real die.
    diodeStamp(c, ctx, ctx.node('anode'), ctx.node('cathode'), p);
  },
  commit(c, ctx) {
    const i = ledCurrent(c, ctx);
    if (i > LED_I_MAX) {
      ctx.s.overload = (ctx.s.overload ?? 0) + ctx.dt;
      if (ctx.s.overload > 0.05) ctx.s.burnt = 1;
    } else {
      ctx.s.overload = 0;
    }
  },
  output(c, ctx) {
    const i = ledCurrent(c, ctx);
    // Perceived brightness rises much faster than current at the low end.
    const brightness = ctx.s.burnt === 1 ? 0 : clamp(Math.sqrt(i / LED_I_RATED), 0, 1);
    return {
      current: i,
      brightness,
      burnt: ctx.s.burnt === 1,
      overloaded: i > LED_I_MAX,
    };
  },
}));

function ledCurrent(
  c: Parameters<NonNullable<Device['output']>>[0],
  ctx: Parameters<NonNullable<Device['output']>>[1],
): number {
  if (ctx.s.burnt === 1) return 0;
  const p = ledParams(String(ctx.props.color ?? 'red'));
  // Use the limited junction voltage the solve actually settled on; the raw
  // node difference can be far off during a failed solve and would report an
  // absurd current.
  const vd = Math.min(
    ctx.s.vdold ?? 0,
    c.v(ctx.node('anode')) - c.v(ctx.node('cathode')),
  );
  return Math.max(0, p.is * (Math.exp(clamp(vd / (p.n * VT), -60, 60)) - 1));
}

defineDevice('led-rgb', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const common = ctx.node('common');
    const anodeCommon = String(ctx.props.common) === 'anode';
    for (const ch of ['red', 'green', 'blue'] as const) {
      const p = ledParams(ch === 'red' ? 'red' : ch === 'green' ? 'green' : 'blue');
      const pin = ctx.node(ch);
      const a = anodeCommon ? common : pin;
      const k = anodeCommon ? pin : common;
      // Each channel keeps its own junction-limiting memory.
      diodeStamp(c, ctx, a, k, p, `vd_${ch}`);
    }
  },
  output(c, ctx) {
    const anodeCommon = String(ctx.props.common) === 'anode';
    const common = ctx.node('common');
    const out: Record<string, number> = {};
    for (const ch of ['red', 'green', 'blue'] as const) {
      const p = ledParams(ch);
      const pin = ctx.node(ch);
      const vd = anodeCommon ? c.v(common) - c.v(pin) : c.v(pin) - c.v(common);
      const i = Math.max(0, p.is * (Math.exp(clamp(vd / (p.n * VT), -60, 60)) - 1));
      out[ch[0]] = clamp(Math.sqrt(i / LED_I_RATED), 0, 1);
    }
    return out;
  },
}));

// ─── Fuse ────────────────────────────────────────────────────────────────────

defineDevice('fuse', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(
      ctx.node('a'),
      ctx.node('b'),
      ctx.s.blown === 1 ? R_OPEN : R_CLOSED,
    );
  },
  commit(c, ctx) {
    const i = Math.abs((c.v(ctx.node('a')) - c.v(ctx.node('b'))) / R_CLOSED);
    if (i > num(ctx.props.rating, 1)) ctx.s.blown = 1;
  },
  output(_, ctx) {
    return { blown: ctx.s.blown === 1 };
  },
}));
