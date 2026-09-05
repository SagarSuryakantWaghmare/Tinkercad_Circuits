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

export const DIP74 = [
  Ic74HC02,
  Ic74HC04,
  Ic74HC08,
  Ic74HC32,
  Ic74HC86,
  Ic74HC138,
  Ic74HC4051,
] as unknown as PartDef<never>[];
