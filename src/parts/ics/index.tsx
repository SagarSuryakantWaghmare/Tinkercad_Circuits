import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
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
    keywords: opts.keywords,
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
  model: 'timer-555',
  keywords: ['555', 'timer', 'astable', 'monostable', 'oscillator', 'ne555'],
  pins: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC'],
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

// ─── Shift registers and counters ────────────────────────────────────────────

export const ShiftRegister595 = dip({
  id: '74hc595',
  name: 'Shift Register [74HC595]',
  label: '74HC595',
  sub: 'SIPO',
  model: '74hc595',
  keywords: ['shift register', '74hc595', 'sipo', 'expander', 'serial'],
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
  pins: ['PL', 'CLK', 'D4', 'D5', 'D6', 'D7', 'Q7_', 'GND', 'Q7', 'DS', 'D0', 'D1', 'D2', 'D3', 'CE', 'VCC'],
  roles: { GND: 'gnd', VCC: 'power' },
});

export const Cd4017 = dip({
  id: 'cd4017',
  name: 'Decade Counter [CD4017]',
  label: 'CD4017',
  sub: 'DECADE',
  model: 'cd4017',
  keywords: ['counter', 'cd4017', 'decade', 'johnson', 'sequencer'],
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

export const ICS: PartDef<never>[] = [
  Timer555,
  OpAmp,
  Comparator,
  ShiftRegister595,
  ShiftRegister165,
  Cd4017,
  Cd4511,
  Uln2003,
  Mcp3008,
  Eeprom,
] as unknown as PartDef<never>[];
