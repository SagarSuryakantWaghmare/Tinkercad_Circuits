/**
 * Models for the second wave of catalogue parts — multiplexed displays, lamps,
 * optical couplers, DIP logic families and the analog multiplexer.
 *
 * These live apart from the first-wave files only so the originals stay
 * readable; there is nothing structurally different about them.
 */

import type { Circuit } from '../mna/Circuit';
import { diodeStamp, ledParams, LED_I_RATED } from './passive';
import { logicDevice } from './digital';
import {
  clamp,
  defineDevice,
  num,
  R_CLOSED,
  R_OPEN,
  type Device,
  type DeviceCtx,
} from './types';

const brightnessOf = (i: number) => clamp(Math.sqrt(Math.max(0, i) / LED_I_RATED), 0, 1);

function segment(
  c: Circuit,
  ctx: DeviceCtx,
  anode: number,
  cathode: number,
  key: string,
  colour = 'red',
): number {
  const p = ledParams(colour);
  const { i } = diodeStamp(c, ctx, anode, cathode, p, key);
  return brightnessOf(i);
}

// ─── Four-digit seven-segment display ────────────────────────────────────────
//
// The digits share their segment pins and are selected one at a time, so a
// sketch scanning them at a kilohertz lights each for a quarter of the time.
// Sampling the instantaneous current would show one digit and three blanks, so
// the rendered brightness decays instead of resetting — the same persistence
// the eye supplies when looking at the real thing.

const SEG_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
const PERSIST = 0.955;

defineDevice('seven-segment-4', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const anodeCommon = String(ctx.props.common ?? 'anode') === 'anode';
    const colour = String(ctx.props.color ?? 'red');
    for (let d = 0; d < 4; d++) {
      const com = ctx.node(`D${d + 1}`);
      SEG_NAMES.forEach((s, i) => {
        const pin = ctx.node(s);
        const a = anodeCommon ? com : pin;
        const k = anodeCommon ? pin : com;
        ctx.s[`i${d}_${i}`] = segment(c, ctx, a, k, `vd${d}_${i}`, colour);
      });
    }
  },
  commit(_, ctx) {
    for (let d = 0; d < 4; d++) {
      for (let i = 0; i < 8; i++) {
        const now = ctx.s[`i${d}_${i}`] ?? 0;
        const held = (ctx.s[`b${d}_${i}`] ?? 0) * PERSIST;
        ctx.s[`b${d}_${i}`] = Math.max(now, held);
      }
    }
  },
  output(_, ctx) {
    const digits: number[] = [];
    for (let d = 0; d < 4; d++) {
      for (let i = 0; i < 8; i++) digits.push(ctx.s[`b${d}_${i}`] ?? 0);
    }
    return { digits };
  },
}));

// ─── Incandescent lamp ───────────────────────────────────────────────────────
//
// A tungsten filament is several times more resistive hot than cold, which is
// why a lamp draws a large inrush and then settles. The temperature is carried
// between timesteps so that the inrush actually appears.

defineDevice('light-bulb', (): Device => ({
  stamp(c, ctx) {
    const vRated = Math.max(0.1, num(ctx.props.voltage, 5));
    const watts = Math.max(0.001, num(ctx.props.power, 0.5));
    const rHot = (vRated * vRated) / watts;
    const heat = clamp(ctx.s.heat ?? 0, 0, 1);
    // A cold filament is a tenth of the hot resistance.
    const r = rHot * (0.1 + 0.9 * heat);
    c.stampResistance(ctx.node('terminal1'), ctx.node('terminal2'), Math.max(0.05, r));
    ctx.s.r = r;
  },
  commit(c, ctx) {
    const v = c.v(ctx.node('terminal1')) - c.v(ctx.node('terminal2'));
    const r = Math.max(0.05, ctx.s.r ?? 100);
    const p = (v * v) / r;
    const watts = Math.max(0.001, num(ctx.props.power, 0.5));
    const target = clamp(p / watts, 0, 1.6);
    // First-order thermal lag; a small lamp reaches temperature in ~30 ms.
    const a = clamp(ctx.dt / 0.03, 0, 1);
    ctx.s.heat = (ctx.s.heat ?? 0) * (1 - a) + target * a;
    ctx.s.power = p;
  },
  output(_, ctx) {
    const heat = clamp(ctx.s.heat ?? 0, 0, 1);
    return { brightness: Math.pow(heat, 0.6), power: ctx.s.power ?? 0 };
  },
}));

// ─── Bi-colour and infrared LEDs ─────────────────────────────────────────────

defineDevice('led-bicolor', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const k = ctx.node('cathode');
    ctx.s.red = segment(c, ctx, ctx.node('anodeR'), k, 'vr', 'red');
    ctx.s.green = segment(c, ctx, ctx.node('anodeG'), k, 'vg', 'green');
  },
  output(_, ctx) {
    return { red: ctx.s.red ?? 0, green: ctx.s.green ?? 0 };
  },
}));

/** A 940 nm emitter has a lower forward drop than any visible colour. */
const IR_DIODE = { is: 3e-9, n: 1.9, rs: 1.5, bv: 5 };

defineDevice('led-ir', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const { i } = diodeStamp(c, ctx, ctx.node('anode'), ctx.node('cathode'), IR_DIODE, 'vd');
    ctx.s.i = i;
  },
  output(_, ctx) {
    return { brightness: brightnessOf(ctx.s.i ?? 0), current: ctx.s.i ?? 0 };
  },
}));

// ─── Photo-interrupter (slotted optical switch) ──────────────────────────────
//
// An emitter faces a phototransistor across a gap. The collector pulls down
// only while the emitter is lit and nothing is in the slot, which is exactly
// the behaviour an encoder wheel or an end-stop relies on.

defineDevice('photo-interrupter', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const { i } = diodeStamp(c, ctx, ctx.node('anode'), ctx.node('cathode'), IR_DIODE, 'vd');
    const lit = brightnessOf(i) > 0.05;
    const blocked = (ctx.s.blocked ?? 0) > 0.5;
    const conducting = lit && !blocked;
    ctx.s.conducting = conducting ? 1 : 0;
    c.stampResistance(ctx.node('collector'), ctx.node('emitter'), conducting ? 220 : R_OPEN);
  },
  interact(event, value, ctx) {
    if (event === 'toggle') ctx.s.blocked = ctx.s.blocked === 1 ? 0 : 1;
    else if (event === 'set') ctx.s.blocked = value ? 1 : 0;
  },
  output(_, ctx) {
    return { blocked: (ctx.s.blocked ?? 0) > 0.5, conducting: ctx.s.conducting === 1 };
  },
}));

// ─── Infrared remote handset ─────────────────────────────────────────────────
//
// The handset publishes the key it is holding down and every IR receiver in the
// design watches for it. Real hardware modulates a 38 kHz carrier that the
// receiver demodulates, so what a sketch actually sees is the envelope — which
// is what is reproduced here, at a timescale the solver can resolve.

export const IR_BUS = 'ir:bus';

export interface IrBus {
  /** Key code being transmitted right now, or null when the air is quiet. */
  code: number | null;
}

defineDevice('ir-remote', (): Device => ({
  stamp(_, ctx) {
    // The handset runs off its own cells and is not part of the circuit.
    const code = ctx.s.code ?? -1;
    ctx.shared.set(IR_BUS, { code: code >= 0 ? code : null } satisfies IrBus);
  },
  interact(event, value, ctx) {
    if (event === 'press') ctx.s.code = typeof value === 'number' ? value : 0;
    else if (event === 'release') ctx.s.code = -1;
  },
  output(_, ctx) {
    const code = ctx.s.code ?? -1;
    return { code, sending: code >= 0 };
  },
}));

// ─── Crystal ─────────────────────────────────────────────────────────────────

defineDevice('crystal', (): Device => ({
  stamp(c, ctx) {
    // At every frequency but its own a quartz blank is a few picofarads, which
    // is all a transient solver running at 100 µs steps can see of it.
    c.stampResistance(ctx.node('terminal1'), ctx.node('terminal2'), R_OPEN);
  },
  output(_, ctx) {
    return { frequency: num(ctx.props.frequency, 16e6) };
  },
}));

// ─── 74HC4051 eight-channel analog multiplexer ───────────────────────────────

defineDevice('74hc4051', (): Device => ({
  stamp(c, ctx) {
    const gnd = ctx.node('GND');
    const ref = gnd === -1 ? 0 : c.v(gnd);
    const bit = (n: string) => c.v(ctx.node(n)) - ref > 2.5;
    const inhibit = bit('INH');
    const sel = (bit('A') ? 1 : 0) | (bit('B') ? 2 : 0) | (bit('C') ? 4 : 0);
    for (let i = 0; i < 8; i++) {
      c.stampResistance(ctx.node('COM'), ctx.node(`Y${i}`), !inhibit && i === sel ? 80 : R_OPEN);
    }
    ctx.s.sel = inhibit ? -1 : sel;
  },
  output(_, ctx) {
    return { channel: ctx.s.sel ?? -1 };
  },
}));

// ─── DIP logic families ──────────────────────────────────────────────────────
//
// One model per package with every gate on the die wired: a 74HC08 with only
// the first gate connected would quietly mislead anyone reading a datasheet
// alongside the screen.

const DIP_OPS: Record<string, (a: boolean, b: boolean) => boolean> = {
  and: (a, b) => a && b,
  or: (a, b) => a || b,
  nand: (a, b) => !(a && b),
  nor: (a, b) => !(a || b),
  xor: (a, b) => a !== b,
};

for (const [op, fn] of Object.entries(DIP_OPS)) {
  defineDevice(`dip-quad-${op}`, () =>
    logicDevice({
      inputs: () => ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'],
      outputs: () => ['1Y', '2Y', '3Y', '4Y'],
      compute: (i) => [fn(i[0], i[1]), fn(i[2], i[3]), fn(i[4], i[5]), fn(i[6], i[7])],
    }),
  );
}

defineDevice('dip-hex-inverter', () =>
  logicDevice({
    inputs: () => ['1A', '2A', '3A', '4A', '5A', '6A'],
    outputs: () => ['1Y', '2Y', '3Y', '4Y', '5Y', '6Y'],
    compute: (i) => i.map((v) => !v),
  }),
);

defineDevice('74hc138', () =>
  logicDevice({
    inputs: () => ['A', 'B', 'C', 'G1', 'G2A', 'G2B'],
    outputs: () => Array.from({ length: 8 }, (_, i) => `Y${i}`),
    compute: ([a, b, c, g1, g2a, g2b]) => {
      const enabled = g1 && !g2a && !g2b;
      const sel = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0);
      // Outputs are active low and all sit high while the chip is disabled.
      return Array.from({ length: 8 }, (_, i) => !(enabled && i === sel));
    },
  }),
);

// ─── Relay module ────────────────────────────────────────────────────────────
//
// The board carries its own coil driver, so the signal pin switches it directly
// rather than needing a transistor of the user's own.

defineDevice('relay-module', (): Device => ({
  stamp(c, ctx) {
    const gnd = ctx.node('GND');
    const ref = gnd === -1 ? 0 : c.v(gnd);
    const vin = c.v(ctx.node('IN')) - ref;
    const activeLow = String(ctx.props.trigger ?? 'high') === 'low';
    const on = activeLow ? vin < 1.5 : vin > 2.5;
    ctx.s.energised = on ? 1 : 0;

    // The input drives an opto/transistor stage, not a bare coil.
    c.stampResistance(ctx.node('IN'), ctx.node('GND'), 1000);
    c.stampResistance(ctx.node('VCC'), ctx.node('GND'), on ? 72 : 12000);

    const com = ctx.node('COM');
    c.stampResistance(com, ctx.node('NO'), on ? R_CLOSED : R_OPEN);
    c.stampResistance(com, ctx.node('NC'), on ? R_OPEN : R_CLOSED);
  },
  output(_, ctx) {
    return { energised: ctx.s.energised === 1 };
  },
}));
