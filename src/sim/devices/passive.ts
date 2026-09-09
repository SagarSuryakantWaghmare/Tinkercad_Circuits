import { LED_COLORS } from '@/lib/tokens';
import {
  checkRating,
  clamp,
  damageOf,
  defineDevice,
  formatSI,
  GMIN,
  isBroken,
  num,
  pnjlim,
  R_CLOSED,
  R_OPEN,
  standardResistor,
  supplyVoltage,
  VT,
  type Device,
  type DeviceCtx,
} from './types';

/** Standard through-hole power ratings, for suggesting a bigger part. */
const RESISTOR_WATTS = [0.125, 0.25, 0.5, 1, 2, 5];

// ─── Resistor ────────────────────────────────────────────────────────────────

const resistorOhms = (ctx: DeviceCtx) => Math.max(num(ctx.props.resistance, 220), 1e-6);

defineDevice('resistor', (): Device => ({
  stamp(c, ctx) {
    // A resistor that has burnt through is an open circuit, not a resistor.
    c.stampResistance(
      ctx.node('a'),
      ctx.node('b'),
      isBroken(ctx) ? R_OPEN : resistorOhms(ctx),
    );
  },
  commit(c, ctx) {
    if (isBroken(ctx)) return;
    const v = c.v(ctx.node('a')) - c.v(ctx.node('b'));
    const p = (v * v) / resistorOhms(ctx);
    ctx.s.power = p;
    const rated = Math.max(num(ctx.props.powerRating, 0.25), 0.001);
    checkRating(ctx, p, {
      label: 'Resistor',
      quantity: 'power',
      warn: rated,
      // Past twice its rating it discolours and then opens; a film resistor
      // survives a short spike, so this needs to be sustained.
      max: rated * 2,
      hold: 0.25,
      suggest: (watts) => {
        const bigger = RESISTOR_WATTS.find((w) => w >= watts);
        return bigger
          ? `Fit a ${formatSI(bigger, 'W')} resistor here, or drop the voltage across it.`
          : 'Reduce the voltage across this resistor — no through-hole part will take that.';
      },
    });
  },
  output(c, ctx) {
    const r = resistorOhms(ctx);
    const v = c.v(ctx.node('a')) - c.v(ctx.node('b'));
    return {
      voltage: v,
      current: isBroken(ctx) ? 0 : v / r,
      power: ctx.s.power ?? 0,
      damage: damageOf(ctx),
      burnt: isBroken(ctx),
    };
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
      if (isBroken(ctx)) return;
      const rated = num(ctx.props.voltage, 50);

      // An electrolytic put in backwards fails on its own account, well below
      // its forward rating — it is the single most common way to kill one.
      if (polarised && ctx.s.vprev < -1) {
        ctx.s.__broken = 1;
        ctx.report({
          severity: 'breakdown',
          title: 'Capacitor destroyed',
          detail:
            `This electrolytic is wired backwards — its negative pin sits ` +
            `${formatSI(Math.abs(ctx.s.vprev), 'V')} above its positive one.`,
          suggestion: 'Turn the capacitor round: the stripe marks the negative leg.',
        });
        return;
      }

      checkRating(ctx, ctx.s.vprev, {
        label: 'Capacitor',
        quantity: 'voltage',
        warn: rated,
        max: rated * 1.5,
        hold: 0.05,
        suggest: (v) =>
          `Use a capacitor rated for at least ${formatSI(v * 1.5, 'V')}.`,
      });
    },
    output(_, ctx) {
      return {
        voltage: ctx.s.vprev ?? 0,
        damage: damageOf(ctx),
        burnt: isBroken(ctx),
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

/**
 * The series resistor this LED needed, worked out from the supply the circuit
 * actually contains rather than from its sagged terminal voltage.
 */
function suggestLedResistor(ctx: DeviceCtx, vf: number): string | undefined {
  const supply = supplyVoltage(ctx);
  if (supply <= vf) return 'Add a series resistor to limit the current.';
  const ideal = (supply - vf) / LED_I_RATED;
  const r = standardResistor(ideal);
  return (
    `A ${formatSI(supply, 'V')} supply needs about ${formatSI(r, '\u03a9')} in ` +
    `series with this LED to hold it near ${formatSI(LED_I_RATED, 'A')}.`
  );
}

defineDevice('led', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const p = ledParams(String(ctx.props.color ?? 'red'));
    if (isBroken(ctx)) {
      c.stampConductance(ctx.node('anode'), ctx.node('cathode'), GMIN);
      return;
    }
    // A small series resistance keeps the exponential from dominating the
    // solve and matches the bulk resistance of a real die.
    diodeStamp(c, ctx, ctx.node('anode'), ctx.node('cathode'), p);
  },
  commit(c, ctx) {
    if (isBroken(ctx)) return;
    const p = ledParams(String(ctx.props.color ?? 'red'));
    checkRating(ctx, ledCurrent(c, ctx), {
      label: 'LED',
      quantity: 'current',
      warn: LED_I_RATED,
      max: LED_I_MAX,
      // A real die takes a moment to cook, and a brief inrush should not
      // destroy an LED that would have survived it.
      hold: 0.05,
      suggest: () => suggestLedResistor(ctx, p.vf),
    });
  },
  output(c, ctx) {
    const i = isBroken(ctx) ? 0 : ledCurrent(c, ctx);
    // Perceived brightness rises much faster than current at the low end.
    const brightness = isBroken(ctx) ? 0 : clamp(Math.sqrt(i / LED_I_RATED), 0, 1);
    return {
      current: i,
      brightness,
      damage: damageOf(ctx),
      burnt: isBroken(ctx),
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
    if (ctx.s.blown === 1) return;
    const rating = num(ctx.props.rating, 1);
    const i = Math.abs((c.v(ctx.node('a')) - c.v(ctx.node('b'))) / R_CLOSED);
    if (i > rating) {
      ctx.s.blown = 1;
      ctx.s.__broken = 1;
      ctx.report({
        severity: 'breakdown',
        title: 'Fuse blown',
        detail:
          `${formatSI(i, 'A')} flowed through a fuse rated ` +
          `${formatSI(rating, 'A')}, so it opened the circuit.`,
        // A blown fuse is the fuse doing its job, so the remedy is upstream.
        suggestion: 'Find what is drawing the extra current before replacing it.',
      });
    }
  },
  output(_, ctx) {
    return { blown: ctx.s.blown === 1, damage: damageOf(ctx) };
  },
}));
