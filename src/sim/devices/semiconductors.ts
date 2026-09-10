import type { Circuit } from '../mna/Circuit';
import {
  checkRating,
  clamp,
  damageOf,
  defineDevice,
  destroy,
  formatSI,
  GMIN,
  isBroken,
  num,
  pnjlim,
  R_CLOSED,
  R_OPEN,
  VT,
  type Device,
} from './types';

/**
 * Bipolar transistor, Ebers–Moll level 1.
 *
 * Two junction diodes plus a transport current source, all linearised each
 * Newton iteration. `sign` is +1 for NPN and −1 for PNP, which lets one set of
 * equations serve both by mirroring every voltage.
 */
function bjt(sign: 1 | -1): Device {
  return {
    nonlinear: true,
    stamp(c, ctx) {
      const b = ctx.node('base');
      const col = ctx.node('collector');
      const e = ctx.node('emitter');

      if (isBroken(ctx)) {
        // A cooked transistor stops controlling anything. Open, not shorted:
        // the base drive no longer reaches the load at all.
        c.stampResistance(col, e, R_OPEN);
        c.stampResistance(b, e, R_OPEN);
        return;
      }

      const is = num(ctx.props.is, 1e-14);
      const bf = Math.max(num(ctx.props.beta, 100), 1);
      const br = 1;
      const vcrit = VT * Math.log(VT / (Math.SQRT2 * is));

      let vbe = sign * (c.v(b) - c.v(e));
      let vbc = sign * (c.v(b) - c.v(col));
      const vbeRaw = vbe;
      const vbcRaw = vbc;
      vbe = pnjlim(vbe, ctx.s.vbe ?? 0, VT, vcrit);
      vbc = pnjlim(vbc, ctx.s.vbc ?? 0, VT, vcrit);
      if (Math.abs(vbe - vbeRaw) > 1e-9 || Math.abs(vbc - vbcRaw) > 1e-9) c.limited = true;
      ctx.s.vbe = vbe;
      ctx.s.vbc = vbc;

      const efe = Math.exp(clamp(vbe / VT, -60, 60));
      const efc = Math.exp(clamp(vbc / VT, -60, 60));

      const ibe = (is / bf) * (efe - 1);
      const gbe = (is / (bf * VT)) * efe + GMIN;
      const ibc = (is / br) * (efc - 1);
      const gbc = (is / (br * VT)) * efc + GMIN;

      const ict = is * (efe - efc);
      const gif = (is / VT) * efe;
      const gir = (is / VT) * efc;

      // Base–emitter and base–collector junctions.
      stampDiodeLike(c, sign, b, e, gbe, ibe - gbe * vbe);
      stampDiodeLike(c, sign, b, col, gbc, ibc - gbc * vbc);

      // Transport current, controlled by both junction voltages.
      const cc = sign > 0 ? col : e;
      const ee = sign > 0 ? e : col;
      c.stampVCCS(cc, ee, b, sign > 0 ? e : col, gif);
      c.stampVCCS(cc, ee, sign > 0 ? col : e, b, gir);
      const ieq = ict - gif * vbe + gir * vbc;
      c.stampCurrentSource(cc, ee, sign * ieq * sign);

      ctx.s.ic = sign * (ict - ibc);
      ctx.s.ib = sign * (ibe + ibc);
      ctx.s.vce = c.v(col) - c.v(e);
    },
    commit(_, ctx) {
      if (isBroken(ctx)) return;
      const ic = Math.abs(ctx.s.ic ?? 0);
      const ib = Math.abs(ctx.s.ib ?? 0);

      // A transistor driven straight from a logic pin with no base resistor is
      // the classic beginner mistake, and it kills the junction rather than
      // the load. Tinkercad cannot fail a discrete transistor at all, so this
      // mistake is silent there.
      if (
        checkRating(ctx, ib, {
          label: 'Transistor',
          quantity: 'current',
          warn: num(ctx.props.ibMax, 0.05) * 0.6,
          max: num(ctx.props.ibMax, 0.05),
          hold: 0.05,
          suggest: () =>
            'The base-emitter junction is being driven far too hard. Put a ' +
            'resistor in series with the base — a few kilohms is usual for ' +
            'switching from a logic pin.',
        }) === 'broken'
      ) {
        return;
      }

      const icMax = num(ctx.props.icMax, 0.6);
      const pd = ic * Math.abs(ctx.s.vce ?? 0);
      if (
        checkRating(ctx, ic, {
          label: 'Transistor',
          quantity: 'current',
          warn: icMax * 0.8,
          max: icMax,
          hold: 0.2,
          suggest: () =>
            `This part is good for about ${formatSI(icMax, 'A')} of collector ` +
            'current. Use a bigger transistor, or a MOSFET, for a load this size.',
        }) === 'broken'
      ) {
        return;
      }

      // Dissipation kills a transistor held half-on even when neither current
      // on its own is out of range.
      checkRating(ctx, pd, {
        label: 'Transistor',
        quantity: 'power',
        warn: num(ctx.props.pMax, 0.6) * 0.7,
        max: num(ctx.props.pMax, 0.6),
        hold: 0.5,
        suggest: () =>
          'It is being held part-way on, which turns the difference into heat. ' +
          'Drive the base hard enough to saturate it, or fit a heatsink.',
      });
    },
    output(_, ctx) {
      const dead = isBroken(ctx);
      const ic = dead ? 0 : ctx.s.ic ?? 0;
      const ib = dead ? 0 : ctx.s.ib ?? 0;
      return {
        ic,
        ib,
        vce: ctx.s.vce ?? 0,
        damage: damageOf(ctx),
        saturated: !dead && Math.abs(ctx.s.vce ?? 0) < 0.4 && Math.abs(ic) > 1e-4,
        conducting: !dead && Math.abs(ic) > 1e-5,
      };
    },
  };
}

/** Conductance + companion current source across a junction, sign-aware. */
function stampDiodeLike(
  c: Circuit,
  sign: 1 | -1,
  a: number,
  k: number,
  g: number,
  ieq: number,
) {
  c.stampConductance(a, k, g);
  if (sign > 0) c.stampCurrentSource(a, k, ieq);
  else c.stampCurrentSource(k, a, ieq);
}

defineDevice('npn', () => bjt(1));
defineDevice('pnp', () => bjt(-1));

// ─── MOSFET, level 1 ─────────────────────────────────────────────────────────

function mosfet(sign: 1 | -1): Device {
  return {
    nonlinear: true,
    stamp(c, ctx) {
      const g = ctx.node('gate');
      const d = ctx.node('drain');
      const s = ctx.node('source');

      const vth = sign * num(ctx.props.vth, 2);
      const beta = num(ctx.props.beta, 0.5);
      const lambda = 0.02;

      let vgs = sign * (c.v(g) - c.v(s));
      let vds = sign * (c.v(d) - c.v(s));
      // Damp the gate step; the square law diverges quickly otherwise.
      const vgsOld = ctx.s.vgs ?? 0;
      if (Math.abs(vgs - vgsOld) > 1) {
        vgs = vgsOld + Math.sign(vgs - vgsOld);
        c.limited = true;
      }
      ctx.s.vgs = vgs;

      const vgst = vgs - Math.abs(vth);
      let id = 0;
      let gm = 0;
      let gds = GMIN;

      const reverse = vds < 0;
      if (reverse) vds = -vds;

      if (vgst > 0) {
        if (vds < vgst) {
          // triode
          id = beta * (vgst * vds - (vds * vds) / 2) * (1 + lambda * vds);
          gm = beta * vds * (1 + lambda * vds);
          gds = beta * (vgst - vds) * (1 + lambda * vds) + beta * lambda * (vgst * vds - (vds * vds) / 2);
        } else {
          // saturation
          id = (beta / 2) * vgst * vgst * (1 + lambda * vds);
          gm = beta * vgst * (1 + lambda * vds);
          gds = (beta / 2) * vgst * vgst * lambda + GMIN;
        }
      }

      const dd = reverse ? s : d;
      const ss = reverse ? d : s;
      const nd = sign > 0 ? dd : ss;
      const ns = sign > 0 ? ss : dd;

      c.stampConductance(nd, ns, gds);
      c.stampVCCS(nd, ns, sign > 0 ? g : ns, sign > 0 ? ns : g, gm);
      c.stampCurrentSource(nd, ns, id - gm * vgs - gds * vds);
      // Gate is capacitive: give it a leak so it is never floating.
      c.stampResistance(g, s, 1e9);

      ctx.s.id = sign * id * (reverse ? -1 : 1);
      ctx.s.vgsOut = vgs;
    },
    output(_, ctx) {
      return {
        id: ctx.s.id ?? 0,
        vgs: ctx.s.vgsOut ?? 0,
        conducting: Math.abs(ctx.s.id ?? 0) > 1e-5,
      };
    },
  };
}

defineDevice('nmos', () => mosfet(1));
defineDevice('pmos', () => mosfet(-1));

// ─── Relays ──────────────────────────────────────────────────────────────────

/**
 * Electromechanical relay. The coil is a plain resistance; when enough current
 * flows through it the armature pulls in, with hysteresis so it does not
 * chatter around the threshold.
 */
function relay(poles: number): Device {
  return {
    stamp(c, ctx) {
      const coilR = Math.max(num(ctx.props.coilResistance, 120), 1);
      c.stampResistance(ctx.node('coil1'), ctx.node('coil2'), coilR);

      const on = ctx.s.energised === 1;
      for (let p = 1; p <= poles; p++) {
        const com = ctx.node(`COM${p}`);
        c.stampResistance(com, ctx.node(`NO${p}`), on ? R_CLOSED : R_OPEN);
        c.stampResistance(com, ctx.node(`NC${p}`), on ? R_OPEN : R_CLOSED);
      }
    },
    commit(c, ctx) {
      const coilR = Math.max(num(ctx.props.coilResistance, 120), 1);
      const v = Math.abs(c.v(ctx.node('coil1')) - c.v(ctx.node('coil2')));
      const i = v / coilR;
      const pullIn = num(ctx.props.pullInCurrent, 0.03);
      // Hysteresis: pulls in at the rated current, drops out at 60 % of it.
      if (i > pullIn) ctx.s.energised = 1;
      else if (i < pullIn * 0.6) ctx.s.energised = 0;
      ctx.s.coilCurrent = i;
    },
    output(_, ctx) {
      return {
        energised: ctx.s.energised === 1,
        coilCurrent: ctx.s.coilCurrent ?? 0,
      };
    },
  };
}

defineDevice('relay-spdt', () => relay(1));
defineDevice('relay-dpdt', () => relay(2));

// ─── Linear voltage regulator ────────────────────────────────────────────────

defineDevice('regulator', (): Device => ({
  stamp(c, ctx) {
    if (isBroken(ctx)) {
      c.stampResistance(ctx.node('input'), ctx.node('gnd'), R_OPEN);
      c.stampResistance(ctx.node('output'), ctx.node('gnd'), R_OPEN);
      return;
    }
    const vin = c.v(ctx.node('input')) - c.v(ctx.node('gnd'));
    const target = num(ctx.props.output, 5);
    // A linear regulator cannot exceed its input minus the dropout.
    const dropout = 2;
    const vout = Math.min(target, Math.max(0, vin - dropout));
    const g = 1 / 0.2;
    c.stampConductance(ctx.node('output'), ctx.node('gnd'), g);
    c.stampCurrentSource(ctx.node('gnd'), ctx.node('output'), vout * g);
    // Quiescent draw on the input.
    c.stampResistance(ctx.node('input'), ctx.node('gnd'), 5000);
    ctx.s.vout = vout;
    ctx.s.vin = vin;
  },
  commit(_, ctx) {
    if (isBroken(ctx)) return;
    // A 78xx-style part is rated to about 35 V in; past that the pass element
    // goes, and it usually takes whatever it was feeding with it.
    checkRating(ctx, ctx.s.vin ?? 0, {
      label: 'Regulator',
      quantity: 'voltage',
      warn: num(ctx.props.vinMax, 35) * 0.8,
      max: num(ctx.props.vinMax, 35),
      hold: 0.1,
      suggest: () =>
        'Input voltage is beyond what this regulator can take. Drop it first, ' +
        'or use a switching regulator rated for the input.',
    });
  },
  output(_, ctx) {
    return {
      vout: isBroken(ctx) ? 0 : ctx.s.vout ?? 0,
      vin: ctx.s.vin ?? 0,
      damage: damageOf(ctx),
      dropout: (ctx.s.vin ?? 0) - (ctx.s.vout ?? 0) < 2.2,
    };
  },
}));

// ─── H-bridge motor driver ───────────────────────────────────────────────────

/**
 * L293D-style dual driver. Each channel gates its two outputs from a logic
 * input and an enable line, driving them to the motor supply or to ground.
 */
defineDevice('motor-driver', (): Device => ({
  stamp(c, ctx) {
    const gnd = ctx.node('GND');
    const vs = c.v(ctx.node('VS')) - c.v(gnd);
    const logicHigh = 2.5;

    for (const ch of ['1', '2'] as const) {
      const en = c.v(ctx.node(`EN${ch}`)) - c.v(gnd) > logicHigh;
      for (const half of ['A', 'B'] as const) {
        const inPin = ctx.node(`IN${ch}${half}`);
        const outPin = ctx.node(`OUT${ch}${half}`);
        if (!en) {
          c.stampResistance(outPin, gnd, R_OPEN);
          continue;
        }
        const high = c.v(inPin) - c.v(gnd) > logicHigh;
        // 1.2 V total drop through the bridge, as the datasheet gives.
        const level = high ? Math.max(0, vs - 1.2) : 0.6;
        const g = 1 / 2;
        c.stampConductance(outPin, gnd, g);
        c.stampCurrentSource(gnd, outPin, level * g);
      }
    }
    c.stampResistance(ctx.node('VSS'), gnd, 4000);
  },
  output() {
    return {};
  },
}));

// ─── Optocoupler ─────────────────────────────────────────────────────────────

defineDevice('optocoupler', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    // Input LED.
    const a = ctx.node('anode');
    const k = ctx.node('cathode');
    if (isBroken(ctx)) {
      c.stampResistance(a, k, R_OPEN);
      c.stampResistance(ctx.node('collector'), ctx.node('emitter'), R_OPEN);
      return;
    }
    const vd = c.v(a) - c.v(k);
    const is = 1e-15;
    const e = Math.exp(clamp(vd / (2 * VT), -60, 60));
    const g = (is / (2 * VT)) * e + GMIN;
    const i = is * (e - 1);
    c.stampConductance(a, k, g);
    c.stampCurrentSource(a, k, i - g * vd);

    // Output transistor: conducts in proportion to the LED current.
    const ctr = num(ctx.props.ctr, 0.5);
    const ic = Math.max(0, i) * ctr;
    const rce = ic > 1e-6 ? Math.max(50, 0.2 / ic) : R_OPEN;
    c.stampResistance(ctx.node('collector'), ctx.node('emitter'), rce);
    ctx.s.ledCurrent = i;
    ctx.s.vled = vd;
    ctx.s.on = ic > 1e-5 ? 1 : 0;
  },
  commit(_, ctx) {
    if (isBroken(ctx)) return;
    const vled = ctx.s.vled ?? 0;

    // The input LED has almost no reverse withstand — six volts backwards is
    // enough to destroy it, and it is the one reverse-polarity check the
    // reference product bothers with.
    if (vled < -6) {
      destroy(ctx, {
        severity: 'breakdown',
        title: 'Optocoupler destroyed',
        detail:
          `The input LED has ${formatSI(Math.abs(vled), 'V')} across it the ` +
          'wrong way round, against a reverse rating of 6 V.',
        suggestion: 'Turn the input round, or add a diode across it to clamp the reverse voltage.',
      });
      return;
    }

    checkRating(ctx, ctx.s.ledCurrent ?? 0, {
      label: 'Optocoupler',
      quantity: 'current',
      warn: 0.02,
      max: 0.06,
      hold: 0.05,
      suggest: () => 'Add a series resistor on the input LED, as you would for any LED.',
    });
  },
  output(_, ctx) {
    return {
      on: !isBroken(ctx) && ctx.s.on === 1,
      ledCurrent: isBroken(ctx) ? 0 : ctx.s.ledCurrent ?? 0,
      damage: damageOf(ctx),
    };
  },
}));
