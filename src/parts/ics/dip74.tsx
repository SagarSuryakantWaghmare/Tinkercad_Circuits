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

// Tinkercad files every 74xx chip under Logic, not Integrated Circuits. We
// keep the physical-chip copy in ICs and mirror it into Logic so a user
// looking under either heading finds the part they expect.
const LOGIC_ALT = ['logic' as const];

export const Ic74HC02 = dip({
  id: '74hc02',
  name: 'Quad NOR [74HC02]',
  label: '74HC02',
  sub: 'QUAD 2-IN NOR',
  model: 'dip-quad-nor',
  keywords: ['74hc02', '7402', 'quad', 'nor', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
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
  altCategories: LOGIC_ALT,
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
  altCategories: LOGIC_ALT,
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
  altCategories: LOGIC_ALT,
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
  altCategories: LOGIC_ALT,
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
  altCategories: LOGIC_ALT,
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
  altCategories: LOGIC_ALT,
  pins: [
    'Y4', 'Y6', 'COM', 'Y7', 'Y5', 'INH', 'VEE', 'GND',
    'Y2', 'Y1', 'Y0', 'Y3', 'A', 'B', 'C', 'VCC',
  ],
  roles: { ...POWER, VEE: 'gnd' },
});

// ─── Three-input gate family ─────────────────────────────────────────────────
// Same 14-pin footprint used by the 74HC10 / 74HC11 / 74HC27. Each is three
// gates of three inputs sharing power on 7 (GND) and 14 (VCC).
const TRIPLE_3IN_PINS = [
  '1A', '1B', '2A', '2B', '2C', '2Y', 'GND',
  '3Y', '3A', '3B', '3C', '1Y', '1C', 'VCC',
];

export const Ic74HC10 = dip({
  id: '74hc10',
  name: 'Triple 3-Input NAND [74HC10]',
  label: '74HC10',
  sub: 'TRIPLE 3-IN NAND',
  model: 'dip-triple-3-nand',
  keywords: ['74hc10', 'triple', '3 input', 'nand', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: TRIPLE_3IN_PINS,
  roles: POWER,
});

export const Ic74HC11 = dip({
  id: '74hc11',
  name: 'Triple 3-Input AND [74HC11]',
  label: '74HC11',
  sub: 'TRIPLE 3-IN AND',
  model: 'dip-triple-3-and',
  keywords: ['74hc11', 'triple', '3 input', 'and', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: TRIPLE_3IN_PINS,
  roles: POWER,
});

export const Ic74HC27 = dip({
  id: '74hc27',
  name: 'Triple 3-Input NOR [74HC27]',
  label: '74HC27',
  sub: 'TRIPLE 3-IN NOR',
  model: 'dip-triple-3-nor',
  keywords: ['74hc27', 'triple', '3 input', 'nor', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: TRIPLE_3IN_PINS,
  roles: POWER,
});

// ─── Four-input dual gate family ─────────────────────────────────────────────
// 74HC20 / 74HC21. Two 4-input gates in a 14-pin package with NC on pins 3
// and 11.
const DUAL_4IN_PINS = [
  '1A', '1B', 'NC', '1C', '1D', '1Y', 'GND',
  '2Y', '2A', '2B', 'NC2', '2C', '2D', 'VCC',
];

export const Ic74HC20 = dip({
  id: '74hc20',
  name: 'Dual 4-Input NAND [74HC20]',
  label: '74HC20',
  sub: 'DUAL 4-IN NAND',
  model: 'dip-dual-4-nand',
  keywords: ['74hc20', 'dual', '4 input', 'nand', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: DUAL_4IN_PINS,
  roles: POWER,
});

export const Ic74HC21 = dip({
  id: '74hc21',
  name: 'Dual 4-Input AND [74HC21]',
  label: '74HC21',
  sub: 'DUAL 4-IN AND',
  model: 'dip-dual-4-and',
  keywords: ['74hc21', 'dual', '4 input', 'and', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: DUAL_4IN_PINS,
  roles: POWER,
});

// ─── Schmitt-trigger inverter / NAND ─────────────────────────────────────────

export const Ic74HC14 = dip({
  id: '74hc14',
  name: 'Hex Schmitt Inverter [74HC14]',
  label: '74HC14',
  sub: 'HEX SCHMITT INV',
  model: 'dip-hex-schmitt-inv',
  keywords: ['74hc14', 'schmitt', 'hex', 'inverter', 'hysteresis', 'logic'],
  altCategories: LOGIC_ALT,
  // Same footprint as 74HC04; the '14 adds the Schmitt hysteresis.
  pins: [
    '1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND',
    '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC',
  ],
  roles: POWER,
});

export const Ic74HC132 = dip({
  id: '74hc132',
  name: 'Quad Schmitt NAND [74HC132]',
  label: '74HC132',
  sub: 'QUAD SCHMITT NAND',
  model: 'dip-quad-schmitt-nand',
  keywords: ['74hc132', 'schmitt', 'quad', 'nand', 'hysteresis', 'logic'],
  altCategories: LOGIC_ALT,
  // Same footprint as 74HC00 with Schmitt inputs.
  pins: [
    '1A', '1B', '1Y', '2A', '2B', '2Y', 'GND',
    '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC',
  ],
  roles: POWER,
});

// ─── JK flip-flops and 4-bit counter ─────────────────────────────────────────

// 74HC73: dual JK flip-flop with clear. Note the unusual power pinout — VCC
// on pin 4, GND on pin 10 — a quirk of the original 7473 that survived into
// the HC family.
export const Ic74HC73 = dip({
  id: '74hc73',
  name: 'Dual JK Flip-Flop [74HC73]',
  label: '74HC73',
  sub: 'DUAL JK w/CLR',
  model: 'dip-dual-jk',
  keywords: ['74hc73', 'jk', 'flip flop', 'dual', 'clear', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: [
    '1CLK', '1CLR', '1K', 'VCC', '2CLK', '2CLR', '2J',
    '2Q', '2QN', 'GND', '2K', '1Q', '1QN', '1J',
  ],
  roles: { GND: 'gnd', VCC: 'power' },
});

// 74HC76: dual JK flip-flop with preset and clear, in a 16-pin package.
export const Ic74HC76 = dip({
  id: '74hc76',
  name: 'Dual JK Flip-Flop [74HC76]',
  label: '74HC76',
  sub: 'DUAL JK PR/CLR',
  model: 'dip-dual-jk-pr',
  keywords: ['74hc76', 'jk', 'flip flop', 'dual', 'preset', 'clear', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: [
    '1CLK', '1PR', '1CLR', '1J', 'VCC', '2CLK', '2PR', '2CLR',
    '2J', '2Q', '2QN', '2K', 'GND', '1K', '1Q', '1QN',
  ],
  roles: { GND: 'gnd', VCC: 'power' },
});

// 74HC93: 4-bit binary ripple counter. CKA drives Q0; Q0 out to CKB gives
// the full four-bit output on Q0..Q3.
export const Ic74HC93 = dip({
  id: '74hc93',
  name: '4-Bit Binary Counter [74HC93]',
  label: '74HC93',
  sub: '4-BIT COUNTER',
  model: 'dip-4bit-counter',
  keywords: ['74hc93', 'counter', '4 bit', 'binary', 'ripple', 'dip', 'logic'],
  altCategories: LOGIC_ALT,
  pins: [
    'CKB', 'R01', 'R02', 'NC', 'VCC', 'NC2', 'NC3',
    'Q2', 'Q1', 'GND', 'Q3', 'Q0', 'NC4', 'CKA',
  ],
  roles: { GND: 'gnd', VCC: 'power' },
});

export const DIP74 = [
  Ic74HC02,
  Ic74HC04,
  Ic74HC08,
  Ic74HC10,
  Ic74HC11,
  Ic74HC14,
  Ic74HC20,
  Ic74HC21,
  Ic74HC27,
  Ic74HC32,
  Ic74HC73,
  Ic74HC76,
  Ic74HC86,
  Ic74HC93,
  Ic74HC132,
  Ic74HC138,
  Ic74HC4051,
] as unknown as PartDef<never>[];
