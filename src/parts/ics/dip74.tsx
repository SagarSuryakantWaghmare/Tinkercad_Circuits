import type { PartDef } from '../types';
import { dip } from './index';

/**
 * The 74HC logic family in DIP packages.
 *
 * Behaviourally these are the same gates as the abstract symbols in the Logic
 * category, but pinned out to a real package so a design drawn here transfers
 * to a breadboard unchanged. Pin 1 is bottom-left and numbering runs
 * anticlockwise, exactly as on the part.
 */

/** Quad two-input gate pinout, shared by the '08 / '32 / '86. */
const QUAD_PINS = [
  '1A', '1B', '1Y', '2A', '2B', '2Y', 'GND',
  '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC',
];

const POWER = { VCC: 'power', GND: 'gnd' } as const;

export const Ic74HC02 = dip({
  id: '74hc02',
  name: 'Quad NOR [74HC02]',
  label: '74HC02',
  sub: 'QUAD 2-IN NOR',
  model: 'dip-quad-nor',
  keywords: ['74hc02', '7402', 'quad', 'nor', 'dip', 'logic'],
  // The '02 puts each gate's output ahead of its inputs, unlike the rest.
  pins: [
    '1Y', '1A', '1B', '2Y', '2A', '2B', 'GND',
    '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC',
  ],
  roles: POWER,
});

export const Ic74HC04 = dip({
  id: '74hc04',
  name: 'Hex Inverter [74HC04]',
  label: '74HC04',
  sub: 'HEX INVERTER',
  model: 'dip-hex-inverter',
  keywords: ['74hc04', '7404', 'hex', 'inverter', 'not', 'dip', 'logic'],
  pins: [
    '1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND',
    '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC',
  ],
  roles: POWER,
});

export const Ic74HC08 = dip({
  id: '74hc08',
  name: 'Quad AND [74HC08]',
  label: '74HC08',
  sub: 'QUAD 2-IN AND',
  model: 'dip-quad-and',
  keywords: ['74hc08', '7408', 'quad', 'and', 'dip', 'logic'],
  pins: QUAD_PINS,
  roles: POWER,
});

export const Ic74HC32 = dip({
  id: '74hc32',
  name: 'Quad OR [74HC32]',
  label: '74HC32',
  sub: 'QUAD 2-IN OR',
  model: 'dip-quad-or',
  keywords: ['74hc32', '7432', 'quad', 'or', 'dip', 'logic'],
  pins: QUAD_PINS,
  roles: POWER,
});

export const Ic74HC86 = dip({
  id: '74hc86',
  name: 'Quad XOR [74HC86]',
  label: '74HC86',
  sub: 'QUAD 2-IN XOR',
  model: 'dip-quad-xor',
  keywords: ['74hc86', '7486', 'quad', 'xor', 'exclusive or', 'dip', 'logic'],
  pins: QUAD_PINS,
  roles: POWER,
});

export const Ic74HC138 = dip({
  id: '74hc138',
  name: '3-to-8 Decoder [74HC138]',
  label: '74HC138',
  sub: '3-TO-8 DECODER',
  model: '74hc138',
  keywords: ['74hc138', '74138', 'decoder', 'demultiplexer', '3 to 8', 'dip'],
  pins: [
    'A', 'B', 'C', 'G2A', 'G2B', 'G1', 'Y7', 'GND',
    'Y6', 'Y5', 'Y4', 'Y3', 'Y2', 'Y1', 'Y0', 'VCC',
  ],
  roles: POWER,
});

export const Ic74HC4051 = dip({
  id: '74hc4051',
  name: '8-Channel Analog Mux [74HC4051]',
  label: '74HC4051',
  sub: '8-CH ANALOG MUX',
  model: '74hc4051',
  keywords: ['74hc4051', '4051', 'analog', 'mux', 'multiplexer', '8 channel', 'dip'],
  pins: [
    'Y4', 'Y6', 'COM', 'Y7', 'Y5', 'INH', 'VEE', 'GND',
    'Y2', 'Y1', 'Y0', 'Y3', 'A', 'B', 'C', 'VCC',
  ],
  roles: { ...POWER, VEE: 'gnd' },
});

// ── Schmitt-trigger inputs ───────────────────────────────────────────────────
// The hysteresis is the point: a slow RC ramp or a bouncing switch becomes one
// clean edge instead of a burst of them.

export const Ic74HC14 = dip({
  id: '74hc14',
  name: 'Hex Schmitt Inverter [74HC14]',
  label: '74HC14',
  sub: 'HEX SCHMITT INV',
  model: 'dip-hex-schmitt-inverter',
  keywords: ['74hc14', '7414', 'schmitt', 'trigger', 'hysteresis', 'inverter', 'debounce'],
  pins: [
    '1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND',
    '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC',
  ],
  roles: POWER,
});

export const Ic74HC132 = dip({
  id: '74hc132',
  name: 'Quad NAND Schmitt [74HC132]',
  label: '74HC132',
  sub: 'QUAD NAND SCHMITT',
  model: 'dip-quad-nand-schmitt',
  keywords: ['74hc132', '74132', 'schmitt', 'nand', 'hysteresis', 'debounce'],
  pins: QUAD_PINS,
  roles: POWER,
});

// ── Gates with more than two inputs ─────────────────────────────────────────

/** Triple 3-input pinout, shared by the '10 / '11 / '27. */
const TRIPLE_3_PINS = [
  '1A', '1B', '2A', '2B', '2C', '2Y', 'GND',
  '3Y', '3A', '3B', '3C', '1Y', '1C', 'VCC',
];

/** Dual 4-input pinout, shared by the '20 / '21. */
const DUAL_4_PINS = [
  '1A', '1B', 'NC1', '1C', '1D', '1Y', 'GND',
  '2Y', '2A', '2B', 'NC2', '2C', '2D', 'VCC',
];

export const Ic74HC10 = dip({
  id: '74hc10',
  name: 'Triple 3-Input NAND [74HC10]',
  label: '74HC10',
  sub: 'TRIPLE 3-IN NAND',
  model: 'dip-triple-3in-nand',
  keywords: ['74hc10', '7410', 'triple', '3 input', 'nand', 'dip'],
  pins: TRIPLE_3_PINS,
  roles: POWER,
});

export const Ic74HC11 = dip({
  id: '74hc11',
  name: 'Triple 3-Input AND [74HC11]',
  label: '74HC11',
  sub: 'TRIPLE 3-IN AND',
  model: 'dip-triple-3in-and',
  keywords: ['74hc11', '7411', 'triple', '3 input', 'and', 'dip'],
  pins: TRIPLE_3_PINS,
  roles: POWER,
});

export const Ic74HC27 = dip({
  id: '74hc27',
  name: 'Triple 3-Input NOR [74HC27]',
  label: '74HC27',
  sub: 'TRIPLE 3-IN NOR',
  model: 'dip-triple-3in-nor',
  keywords: ['74hc27', '7427', 'triple', '3 input', 'nor', 'dip'],
  pins: TRIPLE_3_PINS,
  roles: POWER,
});

export const Ic74HC20 = dip({
  id: '74hc20',
  name: 'Dual 4-Input NAND [74HC20]',
  label: '74HC20',
  sub: 'DUAL 4-IN NAND',
  model: 'dip-dual-4in-nand',
  keywords: ['74hc20', '7420', 'dual', '4 input', 'nand', 'dip'],
  pins: DUAL_4_PINS,
  roles: POWER,
});

export const Ic74HC21 = dip({
  id: '74hc21',
  name: 'Dual 4-Input AND [74HC21]',
  label: '74HC21',
  sub: 'DUAL 4-IN AND',
  model: 'dip-dual-4in-and',
  keywords: ['74hc21', '7421', 'dual', '4 input', 'and', 'dip'],
  pins: DUAL_4_PINS,
  roles: POWER,
});

// ── Comparator packages ─────────────────────────────────────────────────────
// Open-collector outputs, so several can be tied together as a wired-OR.

export const Lm339 = dip({
  id: 'lm339',
  name: 'Quad Comparator [LM339]',
  label: 'LM339',
  sub: 'QUAD COMPARATOR',
  model: 'lm339',
  keywords: ['lm339', 'comparator', 'quad', 'open collector', 'threshold'],
  pins: [
    'OUT2', 'OUT1', 'VCC', 'IN1-', 'IN1+', 'IN2-', 'IN2+',
    'GND', 'IN3-', 'IN3+', 'IN4-', 'IN4+', 'OUT4', 'OUT3',
  ],
  roles: POWER,
});

export const Lm393 = dip({
  id: 'lm393',
  name: 'Dual Comparator [LM393]',
  label: 'LM393',
  sub: 'DUAL COMPARATOR',
  model: 'lm393',
  keywords: ['lm393', 'comparator', 'dual', 'open collector', 'threshold'],
  pins: ['OUT1', 'IN1-', 'IN1+', 'GND', 'IN2+', 'IN2-', 'OUT2', 'VCC'],
  roles: POWER,
});

export const DIP74 = [
  Ic74HC02,
  Ic74HC04,
  Ic74HC08,
  Ic74HC32,
  Ic74HC86,
  Ic74HC138,
  Ic74HC4051,
  Ic74HC14,
  Ic74HC132,
  Ic74HC10,
  Ic74HC11,
  Ic74HC27,
  Ic74HC20,
  Ic74HC21,
  Lm339,
  Lm393,
] as unknown as PartDef<never>[];
