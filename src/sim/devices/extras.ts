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

// 74HC14 is functionally the same hex inverter with Schmitt-trigger inputs;
// the hysteresis matters for slow-rising signals, but the truth table is
// identical, so we reuse the inverter behaviour.
defineDevice('dip-hex-schmitt-inv', () =>
  logicDevice({
    inputs: () => ['1A', '2A', '3A', '4A', '5A', '6A'],
    outputs: () => ['1Y', '2Y', '3Y', '4Y', '5Y', '6Y'],
    compute: (i) => i.map((v) => !v),
  }),
);

// 74HC132 quad Schmitt NAND.
defineDevice('dip-quad-schmitt-nand', () =>
  logicDevice({
    inputs: () => ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B'],
    outputs: () => ['1Y', '2Y', '3Y', '4Y'],
    compute: (i) => [
      !(i[0] && i[1]),
      !(i[2] && i[3]),
      !(i[4] && i[5]),
      !(i[6] && i[7]),
    ],
  }),
);

// ─── Triple 3-input and dual 4-input gate chips ─────────────────────────────
// 74HC10 / 74HC11 / 74HC27: three gates of three inputs.
const TRIPLE_3IN_OPS: Record<string, (a: boolean, b: boolean, c: boolean) => boolean> = {
  nand: (a, b, c) => !(a && b && c),
  and: (a, b, c) => a && b && c,
  nor: (a, b, c) => !(a || b || c),
};
for (const [op, fn] of Object.entries(TRIPLE_3IN_OPS)) {
  defineDevice(`dip-triple-3-${op}`, () =>
    logicDevice({
      inputs: () => ['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C'],
      outputs: () => ['1Y', '2Y', '3Y'],
      compute: (i) => [fn(i[0], i[1], i[2]), fn(i[3], i[4], i[5]), fn(i[6], i[7], i[8])],
    }),
  );
}

// 74HC20 / 74HC21: two gates of four inputs.
const DUAL_4IN_OPS: Record<string, (a: boolean, b: boolean, c: boolean, d: boolean) => boolean> = {
  nand: (a, b, c, d) => !(a && b && c && d),
  and: (a, b, c, d) => a && b && c && d,
};
for (const [op, fn] of Object.entries(DUAL_4IN_OPS)) {
  defineDevice(`dip-dual-4-${op}`, () =>
    logicDevice({
      inputs: () => ['1A', '1B', '1C', '1D', '2A', '2B', '2C', '2D'],
      outputs: () => ['1Y', '2Y'],
      compute: (i) => [fn(i[0], i[1], i[2], i[3]), fn(i[4], i[5], i[6], i[7])],
    }),
  );
}

// ─── Dual JK flip-flops (74HC73 without preset, 74HC76 with) ─────────────────
// Real '73 / '76 clock on the FALLING edge — J and K sample as the clock
// transitions high→low. Match that here so a circuit designed against the
// datasheet behaves the way the datasheet says it will.
defineDevice('dip-dual-jk', () =>
  logicDevice({
    inputs: () => ['1J', '1K', '1CLK', '1CLR', '2J', '2K', '2CLK', '2CLR'],
    outputs: () => ['1Q', '1QN', '2Q', '2QN'],
    compute: ([j1, k1, clk1, clr1, j2, k2, clk2, clr2], s) => {
      const step = (
        j: boolean,
        k: boolean,
        clk: boolean,
        clr: boolean,
        prevClk: number,
        q: number,
      ) => {
        // Async clear is active-low.
        if (!clr) return { q: 0, prev: clk ? 1 : 0 };
        // Falling edge of clock triggers the JK.
        if (!clk && prevClk === 1) {
          if (j && k) q = q === 1 ? 0 : 1;
          else if (j) q = 1;
          else if (k) q = 0;
        }
        return { q, prev: clk ? 1 : 0 };
      };
      const r1 = step(j1, k1, clk1, clr1, s.__clk1 ?? 0, s.q1 ?? 0);
      const r2 = step(j2, k2, clk2, clr2, s.__clk2 ?? 0, s.q2 ?? 0);
      s.q1 = r1.q;
      s.q2 = r2.q;
      s.__clk1 = r1.prev;
      s.__clk2 = r2.prev;
      return [r1.q === 1, r1.q !== 1, r2.q === 1, r2.q !== 1];
    },
  }),
);

// 74HC76 is a dual JK with both preset (async, active-low) and clear.
defineDevice('dip-dual-jk-pr', () =>
  logicDevice({
    inputs: () => ['1J', '1K', '1CLK', '1PR', '1CLR', '2J', '2K', '2CLK', '2PR', '2CLR'],
    outputs: () => ['1Q', '1QN', '2Q', '2QN'],
    compute: ([j1, k1, clk1, pr1, clr1, j2, k2, clk2, pr2, clr2], s) => {
      const step = (
        j: boolean, k: boolean, clk: boolean, pr: boolean, clr: boolean,
        prevClk: number, q: number,
      ) => {
        if (!clr) q = 0;
        else if (!pr) q = 1;
        else if (!clk && prevClk === 1) {
          if (j && k) q = q === 1 ? 0 : 1;
          else if (j) q = 1;
          else if (k) q = 0;
        }
        return { q, prev: clk ? 1 : 0 };
      };
      const r1 = step(j1, k1, clk1, pr1, clr1, s.__clk1 ?? 0, s.q1 ?? 0);
      const r2 = step(j2, k2, clk2, pr2, clr2, s.__clk2 ?? 0, s.q2 ?? 0);
      s.q1 = r1.q;
      s.q2 = r2.q;
      s.__clk1 = r1.prev;
      s.__clk2 = r2.prev;
      return [r1.q === 1, r1.q !== 1, r2.q === 1, r2.q !== 1];
    },
  }),
);

// 74HC74 is a dual positive-edge-triggered D flip-flop with async preset and clear.
defineDevice('dip-dual-d', () =>
  logicDevice({
    inputs: () => ['1D', '1CLK', '1PR', '1CLR', '2D', '2CLK', '2PR', '2CLR'],
    outputs: () => ['1Q', '1QN', '2Q', '2QN'],
    compute: ([d1, clk1, pr1, clr1, d2, clk2, pr2, clr2], s) => {
      const step = (
        d: boolean, clk: boolean, pr: boolean, clr: boolean,
        prevClk: number, q: number,
      ) => {
        if (!clr) q = 0;
        else if (!pr) q = 1;
        else if (clk && prevClk === 0) {
          q = d ? 1 : 0;
        }
        return { q, prev: clk ? 1 : 0 };
      };
      const r1 = step(d1, clk1, pr1, clr1, s.__clk1 ?? 0, s.q1 ?? 0);
      const r2 = step(d2, clk2, pr2, clr2, s.__clk2 ?? 0, s.q2 ?? 0);
      s.q1 = r1.q;
      s.q2 = r2.q;
      s.__clk1 = r1.prev;
      s.__clk2 = r2.prev;
      return [r1.q === 1, r1.q !== 1, r2.q === 1, r2.q !== 1];
    },
  }),
);

// ─── 74HC93 4-bit binary ripple counter ─────────────────────────────────────
// Internally two stages: CKA drives the Q0 divide-by-2, CKB drives a
// divide-by-8 that feeds Q1..Q3. Real hardware needs Q0 → CKB wired
// externally for a straight 0..15 count; both edges here are treated as
// falling for continuity with the real IC — students who don't wire Q0 to
// CKB still see Q0 toggle correctly on CKA, and count-up on CKB alone.
defineDevice('dip-4bit-counter', () =>
  logicDevice({
    inputs: () => ['CKA', 'CKB', 'R01', 'R02'],
    outputs: () => ['Q0', 'Q1', 'Q2', 'Q3'],
    compute: ([cka, ckb, r01, r02], s) => {
      const reset = r01 && r02;
      if (reset) {
        s.q0 = 0;
        s.count3 = 0;
      } else {
        // Falling edge on CKA toggles Q0.
        if (!cka && s.__cka === 1) s.q0 = s.q0 === 1 ? 0 : 1;
        // Falling edge on CKB increments the upper three bits (mod 8).
        if (!ckb && s.__ckb === 1) s.count3 = ((s.count3 ?? 0) + 1) & 0b111;
      }
      s.__cka = cka ? 1 : 0;
      s.__ckb = ckb ? 1 : 0;
      const upper = s.count3 ?? 0;
      // Q0 is the LSB; Q1..Q3 are the three bits of the upper counter.
      return [
        s.q0 === 1,
        (upper & 0b001) !== 0,
        (upper & 0b010) !== 0,
        (upper & 0b100) !== 0,
      ];
    },
  }),
);

// ─── 74HC164 8-bit SIPO shift register ──────────────────────────────────────
// Two data inputs (A, B) are AND-ed to produce the serial-in bit; CLR is
// active-low async clear; CLK shifts on rising edge; Q0..Q7 update every
// clock (no separate latch pin).
defineDevice('74hc164', () =>
  logicDevice({
    inputs: () => ['A', 'B', 'CLK', 'CLR'],
    outputs: () => ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
    compute: ([a, b, clk, clr], s) => {
      if (!clr) {
        s.reg = 0;
      } else if (clk && s.__clk !== 1) {
        // Rising edge — shift in (A AND B).
        const bit = a && b ? 1 : 0;
        s.reg = (((s.reg ?? 0) << 1) | bit) & 0xff;
      }
      s.__clk = clk ? 1 : 0;
      const v = s.reg ?? 0;
      return Array.from({ length: 8 }, (_, i) => ((v >> i) & 1) === 1);
    },
  }),
);

// ─── 74HC75 quad transparent D-latch ────────────────────────────────────────
// Two pairs of latches share a common enable each. While enable is HIGH the
// paired Q follows D; when enable falls LOW the Q holds the last D value.
defineDevice('quad-d-latch', () =>
  logicDevice({
    inputs: () => ['1D', '2D', '3D', '4D', 'E12', 'E34'],
    outputs: () => ['1Q', '1Q_', '2Q', '2Q_', '3Q', '3Q_', '4Q', '4Q_'],
    compute: ([d1, d2, d3, d4, e12, e34], s) => {
      if (e12) {
        s.q1 = d1 ? 1 : 0;
        s.q2 = d2 ? 1 : 0;
      }
      if (e34) {
        s.q3 = d3 ? 1 : 0;
        s.q4 = d4 ? 1 : 0;
      }
      const q1 = s.q1 === 1;
      const q2 = s.q2 === 1;
      const q3 = s.q3 === 1;
      const q4 = s.q4 === 1;
      return [q1, !q1, q2, !q2, q3, !q3, q4, !q4];
    },
  }),
);

// ─── 74HC373 octal transparent latch ────────────────────────────────────────
// LE (Latch Enable) is level-sensitive: while high the outputs follow the D
// inputs; while low the outputs hold the last D values. OE (active low)
// enables the outputs; when OE is high the outputs float.
defineDevice('octal-latch', () =>
  logicDevice({
    inputs: () => ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'LE', 'OE'],
    outputs: () => ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
    compute: (i, s) => {
      const le = i[8];
      const oe = i[9];
      if (le) s.latch = i.slice(0, 8).reduce((n, b, k) => n + (b ? 1 << k : 0), 0);
      if (oe) return Array(8).fill(undefined) as boolean[];
      const v = s.latch ?? 0;
      return Array.from({ length: 8 }, (_, k) => ((v >> k) & 1) === 1);
    },
  }),
);

// ─── PCF8574 8-bit I²C GPIO expander ────────────────────────────────────────
// A full I²C bus model is out of scope; the pins are quasi-bidirectional
// weak pull-ups on real hardware. Present them as high-impedance references
// to ground so wiring the chip in doesn't corrupt neighbouring nets, and
// expose the sampled voltage for the panel. Reading P0..P7 through a
// sketch remains a to-do that will need an I²C bus model, but the chip is
// now safe to place and probe without a driven-vs-driven conflict.
defineDevice('pcf8574', (): Device => ({
  stamp(c, ctx) {
    // 100 kΩ to ground on every port pin — matches the real chip's weak
    // internal pull-ups (~100 µA) as a network safe default.
    for (let i = 0; i < 8; i++) {
      c.stampResistance(ctx.node(`P${i}`), ctx.node('VSS'), 1e5);
    }
    // SDA / SCL as high-impedance stubs so an I²C bus can be wired in
    // without shorting anything.
    c.stampResistance(ctx.node('SDA'), ctx.node('VSS'), R_OPEN);
    c.stampResistance(ctx.node('SCL'), ctx.node('VSS'), R_OPEN);
    c.stampResistance(ctx.node('INT'), ctx.node('VSS'), R_OPEN);
    // Address pins similarly high-impedance so they don't accidentally
    // steal current from the address strap.
    for (const a of ['A0', 'A1', 'A2']) {
      c.stampResistance(ctx.node(a), ctx.node('VSS'), R_OPEN);
    }
  },
  output(c, ctx) {
    const vss = c.v(ctx.node('VSS'));
    const pins: number[] = [];
    for (let i = 0; i < 8; i++) {
      pins.push(c.v(ctx.node(`P${i}`)) - vss);
    }
    return { pins };
  },
}));

// ─── MCP3008 8-channel ADC ──────────────────────────────────────────────────
// Full SPI slave is out of scope; expose the eight analog channels and the
// SPI bus pins as high-impedance stubs so an ADC in a design is safe to
// wire and probe without corrupting other nets.
defineDevice('mcp3008', (): Device => ({
  stamp(c, ctx) {
    for (let i = 0; i < 8; i++) {
      c.stampResistance(ctx.node(`CH${i}`), ctx.node('DGND'), 1e7);
    }
    for (const p of ['CS', 'DIN', 'DOUT', 'CLK']) {
      c.stampResistance(ctx.node(p), ctx.node('DGND'), R_OPEN);
    }
    c.stampResistance(ctx.node('VREF'), ctx.node('DGND'), R_OPEN);
  },
  output(c, ctx) {
    const gnd = c.v(ctx.node('DGND'));
    const channels = Array.from({ length: 8 }, (_, i) =>
      c.v(ctx.node(`CH${i}`)) - gnd,
    );
    return { channels };
  },
}));

// ─── 24LC256 32K I²C EEPROM ─────────────────────────────────────────────────
// Same treatment as the PCF8574: without a bus model there's nothing to
// simulate, but the pins should be high-impedance so wiring the chip in is
// harmless.
defineDevice('eeprom', (): Device => ({
  stamp(c, ctx) {
    for (const p of ['A0', 'A1', 'A2', 'SDA', 'SCL', 'WP']) {
      c.stampResistance(ctx.node(p), ctx.node('VSS'), R_OPEN);
    }
  },
  output() {
    return {};
  },
}));

// ─── 556 dual timer ─────────────────────────────────────────────────────────
// Two independent 555 cores in one package. Reuse the 555 core twice; each
// half has its own comparators, latch and discharge transistor referenced to
// the shared VCC/GND.
defineDevice('timer-556', (): Device => ({
  needsFineStep: true,
  stamp(c, ctx) {
    const gnd = ctx.node('GND');
    const vcc = c.v(ctx.node('VCC')) - c.v(gnd);
    const upper = (2 / 3) * vcc;
    const lower = (1 / 3) * vcc;

    for (const half of ['1', '2'] as const) {
      const threshold = c.v(ctx.node(`${half}THR`)) - c.v(gnd);
      const trigger = c.v(ctx.node(`${half}TRIG`)) - c.v(gnd);
      const reset = c.v(ctx.node(`${half}RESET`)) - c.v(gnd);

      const qKey = `q${half}` as const;
      if (reset < 0.7 && ctx.node(`${half}RESET`) !== -1) ctx.s[qKey] = 0;
      else if (trigger < lower) ctx.s[qKey] = 1;
      else if (threshold > upper) ctx.s[qKey] = 0;

      const on = ctx.s[qKey] === 1;
      const g = 1 / 10;
      c.stampConductance(ctx.node(`${half}OUT`), gnd, g);
      c.stampCurrentSource(
        gnd,
        ctx.node(`${half}OUT`),
        (on ? Math.max(0, vcc - 1.7) : 0.1) * g,
      );
      c.stampResistance(ctx.node(`${half}DIS`), gnd, on ? R_OPEN : 20);
      // Per-half CTRL divider off the shared rail.
      c.stampResistance(ctx.node('VCC'), ctx.node(`${half}CTRL`), 5000);
      c.stampResistance(ctx.node(`${half}CTRL`), gnd, 10000);
    }
  },
  output(_, ctx) {
    return {
      out1: ctx.s.q1 === 1,
      out2: ctx.s.q2 === 1,
    };
  },
}));

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
