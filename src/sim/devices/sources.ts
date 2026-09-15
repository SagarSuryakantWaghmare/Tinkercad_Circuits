import {
  clamp,
  defineDevice,
  num,
  R_CLOSED,
  R_OPEN,
  type Device,
} from './types';

/**
 * Batteries are stamped as a Norton equivalent — a conductance in parallel
 * with a current source — rather than an ideal voltage source with a branch
 * unknown. That costs nothing in accuracy at these impedances and means a
 * short across the terminals produces a large but finite current instead of a
 * singular matrix, which is what lets us show the "battery is shorted" warning
 * the way the reference product does.
 */
function battery(defaultV: number, rInternal: number): Device {
  return {
    stamp(c, ctx) {
      const cells = Math.max(1, num(ctx.props.cells, 1));
      const v = num(ctx.props.voltage, defaultV) * (ctx.props.cells !== undefined ? cells : 1);
      const g = 1 / rInternal;
      c.stampConductance(ctx.node('+'), ctx.node('-'), g);
      c.stampCurrentSource(ctx.node('-'), ctx.node('+'), v * g);
    },
    output(c, ctx) {
      const cells = Math.max(1, num(ctx.props.cells, 1));
      const nominal = num(ctx.props.voltage, defaultV) * (ctx.props.cells !== undefined ? cells : 1);
      const vt = c.v(ctx.node('+')) - c.v(ctx.node('-'));
      const i = (nominal - vt) / rInternal;
      return {
        voltage: vt,
        current: i,
        nominal,
        shorted: Math.abs(i) > 5,
      };
    },
  };
}

// One model id covers every cell chemistry; the part supplies voltage/cells.
defineDevice('battery', () => battery(9, 1.2));

// ─── Bench power supply ──────────────────────────────────────────────────────

defineDevice('power-supply', (): Device => ({
  stamp(c, ctx) {
    const v = num(ctx.props.voltage, 5);
    const limit = Math.max(num(ctx.props.currentLimit, 1), 1e-3);
    // Constant voltage until the current limit, then constant current: fold the
    // limit back into an effective source voltage each iteration.
    const g = 1 / 0.05;
    const vEff = ctx.s.foldback === 1 ? clamp(ctx.s.vFold ?? v, 0, v) : v;
    c.stampConductance(ctx.node('+'), ctx.node('-'), g);
    c.stampCurrentSource(ctx.node('-'), ctx.node('+'), vEff * g);
    ctx.s.limit = limit;
  },
  commit(c, ctx) {
    const v = num(ctx.props.voltage, 5);
    const vt = c.v(ctx.node('+')) - c.v(ctx.node('-'));
    const i = ((ctx.s.foldback === 1 ? (ctx.s.vFold ?? v) : v) - vt) / 0.05;
    if (i > (ctx.s.limit ?? 1)) {
      ctx.s.foldback = 1;
      ctx.s.vFold = clamp(vt + (ctx.s.limit ?? 1) * 0.05, 0, v);
    } else if (i < (ctx.s.limit ?? 1) * 0.95) {
      ctx.s.foldback = 0;
      ctx.s.vFold = v;
    }
  },
  output(c, ctx) {
    const v = num(ctx.props.voltage, 5);
    const vt = c.v(ctx.node('+')) - c.v(ctx.node('-'));
    const i = ((ctx.s.foldback === 1 ? (ctx.s.vFold ?? v) : v) - vt) / 0.05;
    return { voltage: vt, current: i, limiting: ctx.s.foldback === 1 };
  },
}));

// ─── Breadboard power module ─────────────────────────────────────────────────
//
// The MB102 rail supply that clips onto a breadboard: an on-board switch feeds
// two regulated rails (5 V and 3.3 V) referenced to a shared ground. When the
// switch is off both rails are pulled down to ground through a leakage
// resistance, matching what happens on a real board when the regulator is
// disabled.

defineDevice('breadboard-power', (): Device => ({
  stamp(c, ctx) {
    const on = ctx.s.on === undefined ? 1 : ctx.s.on;
    const g = 1 / 0.05;
    if (on === 1) {
      c.stampConductance(ctx.node('5V'), ctx.node('GND'), g);
      c.stampCurrentSource(ctx.node('GND'), ctx.node('5V'), 5 * g);
      c.stampConductance(ctx.node('3V3'), ctx.node('GND'), g);
      c.stampCurrentSource(ctx.node('GND'), ctx.node('3V3'), 3.3 * g);
    } else {
      c.stampResistance(ctx.node('5V'), ctx.node('GND'), 1e6);
      c.stampResistance(ctx.node('3V3'), ctx.node('GND'), 1e6);
    }
    // IN+ is the barrel/USB input jack; treat as passive with a soft tie to
    // ground so a floating input never leaves the matrix singular.
    c.stampResistance(ctx.node('IN+'), ctx.node('GND'), 1e6);
  },
  interact(event, value, ctx) {
    if (event === 'toggle') ctx.s.on = ctx.s.on === 1 ? 0 : 1;
    if (event === 'set') ctx.s.on = value ? 1 : 0;
  },
  output(c, ctx) {
    const on = ctx.s.on === undefined ? 1 : ctx.s.on;
    return {
      on: on === 1,
      v5: c.v(ctx.node('5V')) - c.v(ctx.node('GND')),
      v3: c.v(ctx.node('3V3')) - c.v(ctx.node('GND')),
    };
  },
}));

// ─── Solar panel ─────────────────────────────────────────────────────────────

defineDevice('solar-panel', (): Device => ({
  stamp(c, ctx) {
    const illum = clamp(ctx.s.illumination ?? 100, 0, 100) / 100;
    const voc = num(ctx.props.voltage, 5) * (0.6 + 0.4 * illum);
    const isc = num(ctx.props.current, 0.1) * illum;
    const g = isc / Math.max(voc, 0.01);
    c.stampConductance(ctx.node('+'), ctx.node('-'), g);
    c.stampCurrentSource(ctx.node('-'), ctx.node('+'), isc);
  },
  interact(event, value, ctx) {
    if (event === 'illumination') ctx.s.illumination = clamp(Number(value), 0, 100);
  },
  output(c, ctx) {
    return {
      voltage: c.v(ctx.node('+')) - c.v(ctx.node('-')),
      illumination: ctx.s.illumination ?? 100,
    };
  },
}));

// ─── Mechanical switches ─────────────────────────────────────────────────────

defineDevice('pushbutton', (): Device => ({
  stamp(c, ctx) {
    const closed = ctx.s.pressed === 1;
    // The two legs on each side are already tied by the part's terminal groups;
    // this bridges left to right when the cap is down.
    c.stampResistance(ctx.node('1a'), ctx.node('2a'), closed ? R_CLOSED : R_OPEN);
  },
  interact(event, value, ctx) {
    if (event === 'press') ctx.s.pressed = value ? 1 : 0;
    if (event === 'toggle') ctx.s.pressed = ctx.s.pressed === 1 ? 0 : 1;
  },
  output(_, ctx) {
    return { pressed: ctx.s.pressed === 1 };
  },
}));

defineDevice('slideswitch', (): Device => ({
  stamp(c, ctx) {
    // Three positions: 0 = left closed (common↔1), 1 = centre OFF (both open),
    // 2 = right closed (common↔2). Wiring a motor through common+one terminal
    // used to short across on the opposite throw, so flipping reversed the
    // motor instead of stopping it — the neutral middle position gives a real
    // OFF regardless of how many terminals are wired.
    const p = ctx.s.position ?? 0;
    c.stampResistance(ctx.node('common'), ctx.node('1'), p === 0 ? R_CLOSED : R_OPEN);
    c.stampResistance(ctx.node('common'), ctx.node('2'), p === 2 ? R_CLOSED : R_OPEN);
  },
  interact(event, value, ctx) {
    // Cycle 0 → 1 (off) → 2 → 0 on click so a tap can always find OFF.
    if (event === 'toggle') ctx.s.position = ((ctx.s.position ?? 0) + 1) % 3;
    if (event === 'set') {
      const n = Number(value);
      ctx.s.position = Number.isFinite(n) && n >= 0 && n <= 2 ? Math.round(n) : 0;
    }
  },
  output(_, ctx) {
    return { position: ctx.s.position ?? 0 };
  },
}));

// ─── Potentiometer ───────────────────────────────────────────────────────────

defineDevice('potentiometer', (): Device => ({
  stamp(c, ctx) {
    const total = Math.max(num(ctx.props.resistance, 10000), 1);
    const f = clamp(ctx.s.wiper ?? 0.5, 0, 1);
    // A minimum of a few ohms on each leg keeps the end stops well conditioned.
    c.stampResistance(ctx.node('terminal1'), ctx.node('wiper'), Math.max(total * f, 1));
    c.stampResistance(ctx.node('wiper'), ctx.node('terminal2'), Math.max(total * (1 - f), 1));
  },
  interact(event, value, ctx) {
    if (event === 'set') ctx.s.wiper = clamp(Number(value), 0, 1);
    if (event === 'delta') ctx.s.wiper = clamp((ctx.s.wiper ?? 0.5) + Number(value), 0, 1);
  },
  output(_, ctx) {
    return { wiper: ctx.s.wiper ?? 0.5 };
  },
}));

// ─── Light-dependent resistor ────────────────────────────────────────────────

/**
 * CdS cell response. Resistance falls roughly log-linearly with illumination:
 * about 1 MΩ in the dark and 1 kΩ under bright light, which is the range a
 * GL5528 covers and what the usual divider circuits are designed around.
 */
function ldrResistance(lux: number): number {
  const l = clamp(lux, 0.01, 100000);
  const logR = 6 - 0.75 * (Math.log10(l) + 1);
  return clamp(Math.pow(10, logR), 200, 5e6);
}

defineDevice('photoresistor', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(
      ctx.node('terminal1'),
      ctx.node('terminal2'),
      ldrResistance(ctx.s.lux ?? 100),
    );
  },
  interact(event, value, ctx) {
    if (event === 'set') ctx.s.lux = clamp(Number(value), 0, 100000);
    // Light is dragged on a log scale — a linear one is unusable across the
    // six decades a CdS cell actually spans.
    if (event === 'deltaLog') {
      ctx.s.lux = clamp((ctx.s.lux ?? 100) * Math.pow(10, Number(value)), 0.05, 100000);
    }
  },
  output(_, ctx) {
    const lux = ctx.s.lux ?? 100;
    return { lux, resistance: ldrResistance(lux) };
  },
}));

// ─── TMP36 temperature sensor ────────────────────────────────────────────────

defineDevice('tmp36', (): Device => ({
  stamp(c, ctx) {
    const t = clamp(ctx.s.tempC ?? 25, -40, 125);
    // 500 mV at 0 °C, 10 mV per degree, referenced to the sensor's own ground.
    const vout = 0.5 + 0.01 * t;
    const g = 1 / 100;
    c.stampConductance(ctx.node('vout'), ctx.node('gnd'), g);
    c.stampCurrentSource(ctx.node('gnd'), ctx.node('vout'), vout * g);
    // Quiescent draw so the sensor loads its supply a little.
    c.stampResistance(ctx.node('power'), ctx.node('gnd'), 1e5);
  },
  interact(event, value, ctx) {
    if (event === 'set') ctx.s.tempC = clamp(Number(value), -40, 125);
    if (event === 'delta') ctx.s.tempC = clamp((ctx.s.tempC ?? 25) + Number(value), -40, 125);
  },
  output(c, ctx) {
    return {
      tempC: ctx.s.tempC ?? 25,
      vout: c.v(ctx.node('vout')) - c.v(ctx.node('gnd')),
    };
  },
}));
