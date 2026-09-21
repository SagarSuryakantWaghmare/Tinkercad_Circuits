import { definePart } from '../registry';
import type { ArtProps, CategoryId, PartDef, TerminalDef } from '../types';
import { DipBody, Silk } from '../primitives';

/**
 * Build a through-hole DIP part from a pin list given in package order —
 * pin 1 at the bottom-left, counting anticlockwise, exactly as the datasheet
 * numbers them.
 */
export function dip(opts: {
  id: string;
  name: string;
  label: string;
  sub?: string;
  pins: string[];
  model: string;
  keywords: string[];
  roles?: Record<string, 'power' | 'gnd'>;
  groups?: Record<string, string>;
  basic?: boolean;
  /**
   * Extra sections this chip should appear in. Tinkercad files 74xx chips
   * under Logic; passing `altCategories: ['logic']` lets our IC part also
   * show up in the Logic section without duplicating the definition.
   */
  altCategories?: CategoryId[];
  Art?: (p: ArtProps) => React.ReactElement;
}) {
  const half = opts.pins.length / 2;
  const bodyW = (half - 1) * 10 + 24;
  const bodyH = 44;

  const terminals: TerminalDef[] = opts.pins.map((name, i) => {
    const bottom = i < half;
    const idx = bottom ? i : opts.pins.length - 1 - i;
    return {
      name,
      type: 'breadboard_male',
      x: -((half - 1) * 10) / 2 + idx * 10,
      y: bottom ? 30 : -30,
      dir: [0, bottom ? 1 : -1],
      role: opts.roles?.[name],
      group: opts.groups?.[name],
    };
  });

  return definePart({
    id: opts.id,
    name: opts.name,
    category: 'ics',
    altCategories: opts.altCategories,
    keywords: opts.keywords,
    basic: opts.basic,
    size: { w: bodyW + 16, h: 76 },
    origin: { x: (bodyW + 16) / 2, y: 38 },
    socketable: true,
    rotationStep: 90,
    model: opts.model,
    terminals,
    props: [],
    defaults: {},
    Art:
      opts.Art ??
      (() => (
        <g>
          <DipBody w={bodyW} h={bodyH} pins={opts.pins.length} />
          <Silk x={0} y={opts.sub ? -6 : 0} size={8} fill="#C9CED3" weight={600}>
            {opts.label}
          </Silk>
          {opts.sub && (
            <Silk x={0} y={6} size={5.5} fill="#9BA1A7" weight={500}>
              {opts.sub}
            </Silk>
          )}
        </g>
      )),
  });
}

// ─── 555 timer ───────────────────────────────────────────────────────────────

export const Timer555 = dip({
  id: 'timer-555',
  name: '555 Timer',
  label: 'NE555',
  sub: 'TIMER',
  basic: true,
  model: 'timer-555',
  keywords: ['555', 'timer', 'astable', 'monostable', 'oscillator', 'ne555'],
  pins: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

// Tinkercad ships the 556 dual timer alongside the 555, so we match — two 555
// cores in one 14-pin package. Both cores share VCC/GND on pins 14/7. We reuse
// the single-555 model per core so behaviour lines up with what students see
// from a 555, just twice.
export const Timer556 = dip({
  id: 'timer-556',
  name: '556 Dual Timer',
  label: 'NE556',
  sub: 'DUAL TIMER',
  model: 'timer-556',
  keywords: ['556', 'dual timer', 'ne556', 'astable', 'monostable', 'oscillator'],
  pins: [
    '1DIS', '1THR', '1CTRL', '1RESET', '1OUT', '1TRIG', 'GND',
    '2TRIG', '2OUT', '2RESET', '2CTRL', '2THR', '2DIS', 'VCC',
  ],
  roles: { GND: 'gnd', VCC: 'power' },
});

// ─── Amplifiers ──────────────────────────────────────────────────────────────

export const OpAmp = dip({
  id: 'opamp',
  name: 'Operational Amplifier',
  label: 'LM741',
  sub: 'OP-AMP',
  model: 'opamp',
  keywords: ['op amp', 'opamp', 'lm741', 'amplifier', 'analog', 'buffer'],
  pins: ['OFFSET1', 'IN-', 'IN+', 'V-', 'OFFSET2', 'OUT', 'V+', 'NC'],
  roles: { 'V+': 'power', 'V-': 'gnd' },
});

export const Comparator = dip({
  id: 'comparator',
  name: 'Comparator [LM339]',
  label: 'LM339',
  sub: 'COMPARATOR',
  model: 'comparator',
  keywords: ['comparator', 'lm339', 'lm393', 'threshold', 'analog'],
  pins: ['OUT2', 'OUT1', 'VCC', 'IN-', 'IN+', 'IN2-', 'IN2+', 'GND'],
  roles: { GND: 'gnd', VCC: 'power' },
});

export const DualComparator = dip({
  id: 'lm393',
  name: 'Dual Comparator [LM393]',
  label: 'LM393',
  sub: 'DUAL COMP',
  model: 'lm393',
  keywords: ['comparator', 'lm393', 'dual', 'threshold', 'analog', 'dip'],
  pins: ['OUT1', 'IN1-', 'IN1+', 'GND', 'IN2+', 'IN2-', 'OUT2', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

// ─── Shift registers and counters ────────────────────────────────────────────

export const ShiftRegister595 = dip({
  id: '74hc595',
  name: 'Shift Register [74HC595]',
  label: '74HC595',
  sub: 'SIPO',
  basic: true,
  model: '74hc595',
  keywords: ['shift register', '74hc595', 'sipo', 'expander', 'serial'],
  altCategories: ['logic'],
  pins: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'GND', 'Q7S', 'OE', 'STCP', 'SHCP', 'MR', 'DS', 'Q0', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

export const ShiftRegister165 = dip({
  id: '74hc165',
  name: 'Shift Register [74HC165]',
  label: '74HC165',
  sub: 'PISO',
  model: 'shift-register-4bit',
  keywords: ['shift register', '74hc165', 'piso', 'parallel in', 'input expander'],
  altCategories: ['logic'],
  pins: ['PL', 'CLK', 'D4', 'D5', 'D6', 'D7', 'Q7_', 'GND', 'Q7', 'DS', 'D0', 'D1', 'D2', 'D3', 'CE', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

// 74HC164: 8-bit serial-in parallel-out shift register — the simpler cousin
// of the 595 (no output latch, so Q outputs update on every clock rather
// than only when STCP fires). 14-pin package. Reuses the '595 sim device,
// which correctly handles the case where LE / OE are permanently enabled.
export const ShiftRegister164 = dip({
  id: '74hc164',
  name: 'Shift Register [74HC164]',
  label: '74HC164',
  sub: 'SIPO',
  model: '74hc164',
  keywords: ['shift register', '74hc164', 'sipo', 'serial in', '8 bit'],
  altCategories: ['logic'],
  pins: ['A', 'B', 'Q0', 'Q1', 'Q2', 'Q3', 'GND', 'CLK', 'CLR', 'Q4', 'Q5', 'Q6', 'Q7', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

// 74HC75: quad transparent D-latch. Pairs of latches share a common enable
// (E12 for latches 1-2, E34 for 3-4); each pair works as a 2-bit latch.
export const Ic74HC75 = dip({
  id: '74hc75',
  name: '4-Bit D-Latch [74HC75]',
  label: '74HC75',
  sub: 'QUAD D LATCH',
  model: 'quad-d-latch',
  keywords: ['latch', '74hc75', 'd latch', 'quad', 'transparent', '4 bit'],
  altCategories: ['logic'],
  pins: [
    '1Q_', '1D', '2D', 'E34', 'VCC', '3D', '4D', '4Q_',
    '4Q', '3Q', 'E12', 'GND', '2Q', '1Q',
  ],
  roles: { GND: 'gnd', VCC: 'power' },
});

export const Cd4017 = dip({
  id: 'cd4017',
  name: 'Decade Counter [CD4017]',
  label: 'CD4017',
  sub: 'DECADE',
  model: 'cd4017',
  keywords: ['counter', 'cd4017', 'decade', 'johnson', 'sequencer'],
  altCategories: ['logic'],
  pins: ['Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'GND', 'Q8', 'Q4', 'CO', 'Q9', 'CLK', 'INH', 'MR', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

export const Cd4511 = dip({
  id: 'cd4511',
  name: 'BCD → 7-Segment [CD4511]',
  label: 'CD4511',
  sub: 'BCD→7SEG',
  model: 'cd4511',
  keywords: ['cd4511', 'bcd', 'seven segment', 'decoder', 'driver'],
  altCategories: ['logic'],
  pins: ['B', 'C', 'LT', 'BL', 'LE', 'D', 'A', 'GND', 'Qe', 'Qd', 'Qc', 'Qb', 'Qa', 'Qg', 'Qf', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

export const Uln2003 = dip({
  id: 'uln2003',
  name: 'Darlington Array [ULN2003]',
  label: 'ULN2003',
  sub: 'DRIVER',
  model: 'uln2003',
  keywords: ['uln2003', 'darlington', 'driver', 'stepper', 'relay driver'],
  pins: ['IN1', 'IN2', 'IN3', 'IN4', 'IN5', 'IN6', 'IN7', 'GND', 'COM', 'OUT7', 'OUT6', 'OUT5', 'OUT4', 'OUT3', 'OUT2', 'OUT1'],
  roles: { GND: 'gnd' },
});

export const Mcp3008 = dip({
  id: 'mcp3008',
  name: 'ADC [MCP3008]',
  label: 'MCP3008',
  sub: '8-CH ADC',
  model: 'mcp3008',
  keywords: ['adc', 'mcp3008', 'analog to digital', 'spi', 'expander'],
  pins: ['CH0', 'CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6', 'CH7', 'DGND', 'CS', 'DIN', 'DOUT', 'CLK', 'AGND', 'VREF', 'VDD'],
  roles: { DGND: 'gnd', VDD: 'power' },
  groups: { DGND: 'gnd', AGND: 'gnd' },
});

export const Eeprom = dip({
  id: 'eeprom-24lc256',
  name: 'EEPROM [24LC256]',
  label: '24LC256',
  sub: 'I²C 32K',
  model: 'eeprom',
  keywords: ['eeprom', 'memory', 'i2c', '24lc256', 'storage'],
  pins: ['A0', 'A1', 'A2', 'VSS', 'SDA', 'SCL', 'WP', 'VCC'],
  roles: { VSS: 'gnd', VCC: 'power' },
});

// Tinkercad ships a standalone 4-bit latch as a Logic-section chip. Ours is
// modelled on the 74HC373 octal transparent latch's pinout, exposed with a
// single-latch simulation model.
export const Ic74HC373 = dip({
  id: '74hc373',
  name: '8-Bit Latch [74HC373]',
  label: '74HC373',
  sub: 'OCTAL LATCH',
  model: 'octal-latch',
  keywords: ['latch', '74hc373', 'octal', 'transparent', 'register', 'd latch'],
  altCategories: ['logic'],
  // Pin 1 is OE, then Q0/D0 pairs run down each side to a GND at pin 10,
  // returning via D5..D7/Q5..Q7 back up to LE and VCC on 11 and 20.
  pins: [
    'OE',  'Q0', 'D0', 'D1', 'Q1', 'Q2', 'D2', 'D3', 'Q3', 'GND',
    'LE',  'Q4', 'D4', 'D5', 'Q5', 'Q6', 'D6', 'D7', 'Q7', 'VCC',
  ],
  roles: { GND: 'gnd', VCC: 'power' },
});

// 8-bit I²C GPIO expander. Tinkercad calls this the "8-port I²C expander";
// in the wild it is normally a PCF8574 in a 16-pin DIP.
export const Pcf8574 = dip({
  id: 'pcf8574',
  name: 'I²C GPIO Expander [PCF8574]',
  label: 'PCF8574',
  sub: 'I²C GPIO',
  model: 'pcf8574',
  keywords: ['pcf8574', 'i2c', 'gpio', 'expander', 'port expander', '8 bit'],
  altCategories: ['logic'],
  pins: [
    'A0', 'A1', 'A2', 'P0', 'P1', 'P2', 'P3', 'VSS',
    'SDA', 'SCL', 'INT', 'P7', 'P6', 'P5', 'P4', 'VDD',
  ],
  roles: { VSS: 'gnd', VDD: 'power' },
});

// The Microchip alternative — same idea (8-bit I²C GPIO expander) but with
// register-based I²C, interrupt-on-change and configurable pull-ups. 18-pin
// DIP. Reuses the PCF8574 stub model since the pin functions are equivalent
// at this level of abstraction.
export const Mcp23008 = dip({
  id: 'mcp23008',
  name: 'I²C GPIO Expander [MCP23008]',
  label: 'MCP23008',
  sub: 'I²C GPIO 8-BIT',
  model: 'pcf8574',
  keywords: ['mcp23008', 'i2c', 'gpio', 'expander', 'port expander', 'microchip'],
  altCategories: ['logic'],
  pins: [
    'SCL', 'SDA', 'A0', 'A1', 'A2', 'RESET', 'NC', 'INT', 'VSS',
    'GP0', 'GP1', 'GP2', 'GP3', 'GP4', 'GP5', 'GP6', 'GP7', 'VDD',
  ],
  roles: { VSS: 'gnd', VDD: 'power' },
});

export const ICS: PartDef<never>[] = [
  Timer555,
  Timer556,
  OpAmp,
  Comparator,
  DualComparator,
  ShiftRegister595,
  ShiftRegister164,
  ShiftRegister165,
  Cd4017,
  Cd4511,
  Uln2003,
  Mcp3008,
  Eeprom,
  Ic74HC373,
  Ic74HC75,
  Pcf8574,
  Mcp23008,
] as unknown as PartDef<never>[];
