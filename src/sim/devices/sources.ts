import {
  checkRating,
  clamp,
  damageOf,
  defineDevice,
  isBroken,
  num,
  R_CLOSED,
  R_OPEN,
  SUPPLY_PREFIX,
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
  const nominalOf = (ctx: Parameters<Device['stamp']>[1]) => {
    const cells = Math.max(1, num(ctx.props.cells, 1));
    return num(ctx.props.voltage, defaultV) * (ctx.props.cells !== undefined ? cells : 1);
  };
  // What the cell can deliver before it cooks. Internal resistance is the
  // honest proxy: a coin cell has a lot of it and can source very little.
  const iMax = 2.5 / rInternal;

  return {
    check(ctx) {
      // Both terminals on one net is a dead short. There is no operating point
      // to measure — the whole circuit collapses to a single node — so this has
      // to be caught from the wiring rather than from a solve.
      if (ctx.node('+') !== ctx.node('-')) return;
      ctx.s.__broken = 1;
      ctx.report({
        severity: 'breakdown',
        title: 'Battery shorted',
        detail:
          'Both battery terminals are connected to the same point, so the ' +
          'cell is driving a dead short through its own internal resistance.',
        suggestion:
          'Put the load between + and − rather than wiring them together.',
      });
    },
    stamp(c, ctx) {
      const nominal = nominalOf(ctx);
      // Publish for models that need to size a remedy — see supplyVoltage().
      ctx.shared.set(`${SUPPLY_PREFIX}${ctx.partId}`, nominal);

      if (isBroken(ctx)) {
        // A flat cell is not a short: it stops sourcing and goes high-impedance.
        c.stampResistance(ctx.node('+'), ctx.node('-'), R_OPEN);
        return;
      }
      const g = 1 / rInternal;
      c.stampConductance(ctx.node('+'), ctx.node('-'), g);
      c.stampCurrentSource(ctx.node('-'), ctx.node('+'), nominal * g);
    },
    commit(c, ctx) {
      if (isBroken(ctx)) return;
      const nominal = nominalOf(ctx);
      const i = (nominal - (c.v(ctx.node('+')) - c.v(ctx.node('-')))) / rInternal;
      ctx.s.i = i;
      checkRating(ctx, i, {
        label: 'Battery',
        quantity: 'current',
        warn: iMax * 0.5,
        max: iMax,
        // Cells get hot rather than exploding instantly; a couple of seconds of
        // abuse is what finishes one.
        hold: 2,
        suggest: () =>
          'Something is drawing far too much current — look for a short, or a ' +
          'part wired straight across the battery with no resistor.',
      });
    },
    output(c, ctx) {
      const nominal = nominalOf(ctx);
      const vt = c.v(ctx.node('+')) - c.v(ctx.node('-'));
      const i = isBroken(ctx) ? 0 : (nominal - vt) / rInternal;
      return {
        voltage: isBroken(ctx) ? 0 : vt,
        current: i,
        nominal,
        damage: damageOf(ctx),
        shorted: Math.abs(i) > iMax * 0.5,
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
    const right = ctx.s.position === 1;
    c.stampResistance(ctx.node('common'), ctx.node('1'), right ? R_OPEN : R_CLOSED);
    c.stampResistance(ctx.node('common'), ctx.node('2'), right ? R_CLOSED : R_OPEN);
  },
  interact(event, value, ctx) {
    if (event === 'toggle') ctx.s.position = ctx.s.position === 1 ? 0 : 1;
    if (event === 'set') ctx.s.position = value ? 1 : 0;
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
