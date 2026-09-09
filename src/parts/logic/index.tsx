import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C } from '@/lib/tokens';
import { DipBody, Silk } from '../primitives';

const BODY = '#F7F8FA';
const EDGE = '#5B6068';

// ─── Gate symbols ────────────────────────────────────────────────────────────

const AND_PATH = 'M-24,-22 L-2,-22 A22,22 0 0,1 -2,22 L-24,22 Z';
const OR_PATH = 'M-26,-22 Q-8,0 -26,22 Q2,22 22,0 Q2,-22 -26,-22 Z';
const XOR_EXTRA = 'M-33,-22 Q-15,0 -33,22';
const NOT_PATH = 'M-20,-20 L18,0 L-20,20 Z';

interface GateProps extends Record<string, string | number> {
  inputs: number;
}

function GateArt({
  shape,
  bubble,
  extra,
  inputs,
  state,
  label,
}: {
  shape: string;
  bubble: boolean;
  extra?: string;
  inputs: number;
  state: ArtProps['state'];
  label: string;
}) {
  const out = !!(Number(state?.outputs ?? 0) & 1);
  const inBits = Number(state?.inputs ?? 0);
  const ys = inputYs(inputs);
  const outX = bubble ? 32 : 24;

  return (
    <g>
      {/* input leads */}
      {ys.map((y, i) => (
        <line
          key={y}
          x1={-46}
          y1={y}
          x2={shape === OR_PATH ? -22 : -24}
          y2={y}
          stroke={state && (inBits >> i) & 1 ? C.ok : EDGE}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      ))}
      {/* output lead */}
      <line
        x1={bubble ? 28 : 22}
        y1={0}
        x2={46}
        y2={0}
        stroke={state ? (out ? C.ok : EDGE) : EDGE}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {extra && <path d={extra} fill="none" stroke={EDGE} strokeWidth={2} />}
      <path d={shape} fill={BODY} stroke={EDGE} strokeWidth={2} strokeLinejoin="round" />
      {bubble && <circle cx={outX - 8} cy={0} r={5} fill={BODY} stroke={EDGE} strokeWidth={2} />}
      <Silk x={shape === NOT_PATH ? -8 : -4} y={0} size={8} fill="#4A4F55" weight={700}>
        {label}
      </Silk>
      {state && (
        <circle cx={46} cy={0} r={4} fill={out ? C.ok : '#C9CED3'} />
      )}
    </g>
  );
}

function inputYs(n: number): number[] {
  if (n <= 1) return [0];
  const span = Math.min(36, 10 * (n - 1));
  return Array.from({ length: n }, (_, i) => -span / 2 + (i * span) / (n - 1));
}

function makeGate(
  id: string,
  name: string,
  model: string,
  shape: string,
  bubble: boolean,
  label: string,
  extra?: string,
  fixedInputs?: number,
) {
  return definePart<GateProps>({
    id,
    name,
    category: 'logic',
    keywords: ['gate', 'logic', 'digital', label.toLowerCase(), 'boolean'],
    size: { w: 104, h: 60 },
    origin: { x: 52, y: 30 },
    model,
    terminals: (props) => {
      const n = fixedInputs ?? Math.max(2, Math.min(6, Number(props.inputs) || 2));
      const ys = inputYs(n);
      const t: TerminalDef[] = ys.map((y, i) => ({
        name: `IN${i + 1}`,
        type: 'wire',
        x: -46,
        y,
        dir: [-1, 0],
      }));
      t.push({ name: 'OUT', type: 'wire', x: 46, y: 0, dir: [1, 0] });
      t.push({ name: 'GND', type: 'wire', x: 0, y: 28, dir: [0, 1], role: 'gnd' });
      return t;
    },
    props: fixedInputs
      ? []
      : [{ key: 'inputs', label: 'Inputs', kind: 'number', min: 2, max: 6, step: 1 }],
    defaults: { inputs: fixedInputs ?? 2 },
    Art: ({ props, state }: ArtProps<GateProps>) => (
      <GateArt
        shape={shape}
        bubble={bubble}
        extra={extra}
        inputs={fixedInputs ?? Math.max(2, Math.min(6, Number(props.inputs) || 2))}
        state={state}
        label={label}
      />
    ),
  });
}

export const AndGate = makeGate('gate-and', 'AND Gate', 'gate-and', AND_PATH, false, 'AND');
export const OrGate = makeGate('gate-or', 'OR Gate', 'gate-or', OR_PATH, false, 'OR');
export const NandGate = makeGate('gate-nand', 'NAND Gate', 'gate-nand', AND_PATH, true, 'NAND');
export const NorGate = makeGate('gate-nor', 'NOR Gate', 'gate-nor', OR_PATH, true, 'NOR');
export const XorGate = makeGate('gate-xor', 'XOR Gate', 'gate-xor', OR_PATH, false, 'XOR', XOR_EXTRA);
export const XnorGate = makeGate('gate-xnor', 'XNOR Gate', 'gate-xnor', OR_PATH, true, 'XNOR', XOR_EXTRA);
export const NotGate = makeGate('gate-not', 'NOT Gate', 'gate-not', NOT_PATH, true, '1', undefined, 1);
export const BufferGate = makeGate('gate-buffer', 'Buffer', 'gate-buffer', NOT_PATH, false, '1', undefined, 1);

// ─── Block-style logic parts ─────────────────────────────────────────────────

function logicBlock(opts: {
  id: string;
  name: string;
  label: string;
  model: string;
  left: string[];
  right: string[];
  keywords: string[];
  props?: PartDef['props'];
  defaults?: Record<string, string | number>;
}) {
  const rows = Math.max(opts.left.length, opts.right.length);
  const h = Math.max(60, rows * 16 + 26);
  const w = 120;

  const pinY = (i: number, n: number) => -((n - 1) * 16) / 2 + i * 16;

  return definePart({
    id: opts.id,
    name: opts.name,
    category: 'logic',
    keywords: opts.keywords,
    size: { w: w + 40, h: h + 20 },
    origin: { x: (w + 40) / 2, y: (h + 20) / 2 },
    model: opts.model,
    terminals: [
      ...opts.left.map((name, i) => ({
        name,
        type: 'wire' as const,
        x: -w / 2 - 18,
        y: pinY(i, opts.left.length),
        dir: [-1, 0] as [number, number],
      })),
      ...opts.right.map((name, i) => ({
        name,
        type: 'wire' as const,
        x: w / 2 + 18,
        y: pinY(i, opts.right.length),
        dir: [1, 0] as [number, number],
      })),
      { name: 'GND', type: 'wire' as const, x: 0, y: h / 2 + 8, dir: [0, 1] as [number, number], role: 'gnd' as const },
    ],
    props: opts.props ?? [],
    defaults: opts.defaults ?? {},
    Art: ({ state }: ArtProps) => {
      const outBits = Number(state?.outputs ?? 0);
      const inBits = Number(state?.inputs ?? 0);
      return (
        <g>
          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill={BODY} stroke={EDGE} strokeWidth={2} />
          <Silk x={0} y={-h / 2 + 12} size={8} fill="#4A4F55" weight={700}>
            {opts.label}
          </Silk>
          {opts.left.map((name, i) => {
            const y = pinY(i, opts.left.length);
            const on = ((inBits >> i) & 1) === 1;
            return (
              <g key={name}>
                <line x1={-w / 2 - 18} y1={y} x2={-w / 2} y2={y} stroke={state && on ? C.ok : EDGE} strokeWidth={2} strokeLinecap="round" />
                <Silk x={-w / 2 + 8} y={y} size={6.5} anchor="start" fill="#5B6068" weight={600}>
                  {name}
                </Silk>
              </g>
            );
          })}
          {opts.right.map((name, i) => {
            const y = pinY(i, opts.right.length);
            const on = ((outBits >> i) & 1) === 1;
            return (
              <g key={name}>
                <line x1={w / 2} y1={y} x2={w / 2 + 18} y2={y} stroke={state && on ? C.ok : EDGE} strokeWidth={2} strokeLinecap="round" />
                <Silk x={w / 2 - 8} y={y} size={6.5} anchor="end" fill="#5B6068" weight={600}>
                  {name}
                </Silk>
                {state && <circle cx={w / 2 + 18} cy={y} r={3.2} fill={on ? C.ok : '#C9CED3'} />}
              </g>
            );
          })}
        </g>
      );
    },
  });
}

export const DFlipFlop = logicBlock({
  id: 'flipflop-d',
  name: 'D Flip-Flop',
  label: 'D FLIP-FLOP',
  model: 'flipflop-d',
  left: ['D', 'CLK', 'SET', 'RESET'],
  right: ['Q', 'Q_'],
  keywords: ['flip flop', 'd', 'register', 'memory', 'sequential'],
});

export const JkFlipFlop = logicBlock({
  id: 'flipflop-jk',
  name: 'JK Flip-Flop',
  label: 'JK FLIP-FLOP',
  model: 'flipflop-jk',
  left: ['J', 'K', 'CLK', 'SET', 'RESET'],
  right: ['Q', 'Q_'],
  keywords: ['flip flop', 'jk', 'toggle', 'sequential'],
});

export const TFlipFlop = logicBlock({
  id: 'flipflop-t',
  name: 'T Flip-Flop',
  label: 'T FLIP-FLOP',
  model: 'flipflop-t',
  left: ['T', 'CLK'],
  right: ['Q', 'Q_'],
  keywords: ['flip flop', 't', 'toggle', 'divider'],
});

export const SrLatch = logicBlock({
  id: 'latch-sr',
  name: 'SR Latch',
  label: 'SR LATCH',
  model: 'latch-sr',
  left: ['S', 'R'],
  right: ['Q', 'Q_'],
  keywords: ['latch', 'sr', 'set reset', 'memory'],
});

export const HalfAdder = logicBlock({
  id: 'half-adder',
  name: 'Half Adder',
  label: 'HALF ADDER',
  model: 'half-adder',
  left: ['A', 'B'],
  right: ['SUM', 'CARRY'],
  keywords: ['adder', 'half', 'arithmetic', 'sum'],
});

export const FullAdder = logicBlock({
  id: 'full-adder',
  name: 'Full Adder',
  label: 'FULL ADDER',
  model: 'full-adder',
  left: ['A', 'B', 'CIN'],
  right: ['SUM', 'COUT'],
  keywords: ['adder', 'full', 'arithmetic', 'carry'],
});

export const Adder4Bit = logicBlock({
  id: 'adder-4bit',
  name: '4-bit Adder',
  label: '4-BIT ADDER',
  model: 'adder-4bit',
  left: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'CIN'],
  right: ['S1', 'S2', 'S3', 'S4', 'COUT'],
  keywords: ['adder', '4 bit', 'arithmetic', 'alu'],
});

export const Multiplexer = logicBlock({
  id: 'mux',
  name: 'Multiplexer',
  label: 'MUX',
  model: 'mux',
  left: ['IN1', 'IN2', 'IN3', 'IN4', 'SEL1', 'SEL2'],
  right: ['OUT'],
  keywords: ['mux', 'multiplexer', 'selector', 'switch'],
  props: [
    {
      key: 'width',
      label: 'Channels',
      kind: 'select',
      options: [2, 4, 8].map((v) => ({ value: String(v), label: `${v}-to-1` })),
    },
  ],
  defaults: { width: 4 },
});

export const Demultiplexer = logicBlock({
  id: 'demux',
  name: 'Demultiplexer',
  label: 'DEMUX',
  model: 'demux',
  left: ['IN', 'SEL1', 'SEL2'],
  right: ['OUT1', 'OUT2', 'OUT3', 'OUT4'],
  keywords: ['demux', 'demultiplexer', 'distributor', 'router'],
  props: [
    {
      key: 'width',
      label: 'Channels',
      kind: 'select',
      options: [2, 4, 8].map((v) => ({ value: String(v), label: `1-to-${v}` })),
    },
  ],
  defaults: { width: 4 },
});

export const Decoder38 = logicBlock({
  id: 'decoder-3to8',
  name: '3-to-8 Decoder',
  label: '3→8 DECODER',
  model: 'decoder-3to8',
  left: ['A', 'B', 'C', 'EN'],
  right: ['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7'],
  keywords: ['decoder', '3 to 8', 'demux', 'address'],
});

export const Comparator4Bit = logicBlock({
  id: 'comparator-4bit',
  name: '4-bit Comparator',
  label: 'COMPARATOR',
  model: 'comparator-4bit',
  left: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
  right: ['LT', 'EQ', 'GT'],
  keywords: ['comparator', 'compare', 'magnitude', '4 bit'],
});

export const Counter4Bit = logicBlock({
  id: 'counter-4bit',
  name: '4-bit Counter',
  label: 'COUNTER',
  model: 'counter-4bit',
  left: ['CLK', 'RESET', 'EN'],
  right: ['Q1', 'Q2', 'Q3', 'Q4'],
  keywords: ['counter', 'binary', '4 bit', 'sequential'],
});

export const ShiftRegister4Bit = logicBlock({
  id: 'shift-register-4bit',
  name: '4-bit Shift Register',
  label: 'SHIFT REG',
  model: 'shift-register-4bit',
  left: ['DATA', 'CLK', 'RESET'],
  right: ['Q1', 'Q2', 'Q3', 'Q4'],
  keywords: ['shift register', 'serial', 'sipo', '4 bit'],
});

// ─── Sources and probes ──────────────────────────────────────────────────────

interface ClockProps extends Record<string, string | number> {
  frequency: number;
  duty: number;
}

export const ClockGenerator = definePart<ClockProps>({
  id: 'clock-generator',
  name: 'Clock Generator',
  category: 'logic',
  keywords: ['clock', 'oscillator', 'square wave', 'pulse', 'timing'],
  size: { w: 110, h: 70 },
  origin: { x: 55, y: 35 },
  model: 'clock-generator',
  terminals: [
    { name: 'OUT', type: 'wire', x: 48, y: 0, dir: [1, 0] },
    { name: 'GND', type: 'wire', x: 0, y: 30, dir: [0, 1], role: 'gnd' },
  ],
  props: [
    { key: 'frequency', label: 'Frequency', kind: 'number', unit: 'Hz', min: 0.1, max: 10000, step: 0.1 },
    { key: 'duty', label: 'Duty cycle', kind: 'slider', min: 5, max: 95, step: 1, unit: '%' },
  ],
  defaults: { frequency: 1, duty: 50 },
  Art: ({ props, state }: ArtProps<ClockProps>) => {
    const high = !!state?.high;
    return (
      <g>
        <rect x={-46} y={-28} width={92} height={56} rx={3} fill={BODY} stroke={EDGE} strokeWidth={2} />
        <path
          d="M-32,6 L-32,-8 L-20,-8 L-20,6 L-8,6 L-8,-8 L4,-8 L4,6 L16,6 L16,-8 L28,-8"
          fill="none"
          stroke={high ? C.ok : EDGE}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Silk x={0} y={19} size={6.5} fill="#5B6068" weight={600}>
          {`${props.frequency} Hz · ${props.duty}%`}
        </Silk>
        <line x1={46} y1={0} x2={56} y2={0} stroke={high ? C.ok : EDGE} strokeWidth={2.2} />
        {state && <circle cx={48} cy={0} r={4} fill={high ? C.ok : '#C9CED3'} />}
      </g>
    );
  },
});

export const LogicToggle = definePart({
  id: 'logic-toggle',
  name: 'Logic Toggle',
  category: 'logic',
  keywords: ['toggle', 'input', 'switch', 'logic level', 'high low'],
  size: { w: 96, h: 60 },
  origin: { x: 48, y: 30 },
  model: 'logic-toggle',
  terminals: [
    { name: 'OUT', type: 'wire', x: 44, y: 0, dir: [1, 0] },
    { name: 'GND', type: 'wire', x: 0, y: 26, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: {},
  Art: ({ state, simulating, interact }: ArtProps) => {
    const high = !!state?.high;
    return (
      <g>
        <rect x={-42} y={-24} width={80} height={48} rx={5} fill={BODY} stroke={EDGE} strokeWidth={2} />
        <rect
          x={-34}
          y={-13}
          width={64}
          height={26}
          rx={13}
          fill={high ? '#D6F0C4' : '#E6E8EB'}
          stroke={high ? C.ok : '#B9BEC4'}
          strokeWidth={1.5}
        />
        <circle cx={high ? 17 : -21} cy={0} r={10} fill={high ? C.ok : '#8E949A'} />
        <Silk x={high ? -14 : 12} y={0} size={9} fill="#5B6068" weight={700}>
          {high ? '1' : '0'}
        </Silk>
        <line x1={38} y1={0} x2={50} y2={0} stroke={high ? C.ok : EDGE} strokeWidth={2.2} />
        {simulating && (
          <rect
            x={-42}
            y={-24}
            width={80}
            height={48}
            fill="transparent"
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              interact?.('toggle');
            }}
          />
        )}
      </g>
    );
  },
});

export const LogicProbe = definePart({
  id: 'logic-probe',
  name: 'Logic Probe',
  category: 'logic',
  keywords: ['probe', 'indicator', 'output', 'led', 'monitor'],
  size: { w: 76, h: 68 },
  origin: { x: 38, y: 34 },
  model: 'logic-probe',
  terminals: [
    { name: 'IN', type: 'wire', x: -34, y: 0, dir: [-1, 0] },
    { name: 'GND', type: 'wire', x: 0, y: 30, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps) => {
    const high = !!state?.high;
    const floating = !!state?.floating;
    const fill = !state ? '#C9CED3' : floating ? '#E3B341' : high ? C.ok : '#7B8288';
    return (
      <g>
        <rect x={-30} y={-28} width={60} height={56} rx={5} fill={BODY} stroke={EDGE} strokeWidth={2} />
        {high && <circle cx={0} cy={-4} r={22} fill={C.ok} opacity={0.22} />}
        <circle cx={0} cy={-4} r={14} fill={fill} stroke={EDGE} strokeWidth={1.5} />
        <Silk x={0} y={-4} size={10} fill="#FFFFFF" weight={800}>
          {!state ? '' : floating ? '?' : high ? '1' : '0'}
        </Silk>
        <line x1={-40} y1={0} x2={-30} y2={0} stroke={EDGE} strokeWidth={2.2} />
        <Silk x={0} y={18} size={6} fill="#5B6068" weight={600}>
          {state ? `${Number(state.voltage ?? 0).toFixed(2)} V` : 'PROBE'}
        </Silk>
      </g>
    );
  },
});

export const LogicSounder = definePart({
  id: 'logic-sounder',
  name: 'Logic Buzzer',
  category: 'logic',
  keywords: ['buzzer', 'sound', 'audible', 'probe'],
  size: { w: 76, h: 68 },
  origin: { x: 38, y: 34 },
  model: 'logic-sounder',
  terminals: [
    { name: 'IN', type: 'wire', x: -34, y: 0, dir: [-1, 0] },
    { name: 'GND', type: 'wire', x: 0, y: 30, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps) => (
    <g>
      <rect x={-30} y={-28} width={60} height={56} rx={5} fill={BODY} stroke={EDGE} strokeWidth={2} />
      <path d="M-12,-6 L-4,-6 L4,-14 L4,10 L-4,2 L-12,2 Z" fill="#5B6068" />
      {Number(state?.frequency ?? 0) > 0 &&
        [8, 13].map((r) => (
          <path key={r} d={`M${6 + r * 0.5},${-r * 0.7} A${r},${r} 0 0,1 ${6 + r * 0.5},${r * 0.7}`} fill="none" stroke={C.select} strokeWidth={2} />
        ))}
      <Silk x={0} y={20} size={6} fill="#5B6068" weight={600}>
        {Number(state?.frequency ?? 0) > 0 ? `${Math.round(Number(state?.frequency))} Hz` : 'BUZZER'}
      </Silk>
    </g>
  ),
});

// A DIP-packaged quad gate, for students building from real part numbers.
export const Quad2InputNand = definePart({
  id: '74hc00',
  name: 'Quad NAND [74HC00]',
  category: 'logic',
  keywords: ['74hc00', 'quad', 'nand', 'dip', 'ttl'],
  size: { w: 106, h: 76 },
  origin: { x: 53, y: 38 },
  socketable: true,
  rotationStep: 90,
  model: 'gate-nand',
  terminals: ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC'].map(
    (name, i) => {
      const bottom = i < 7;
      const idx = bottom ? i : 13 - i;
      return {
        name: name === '1A' ? 'IN1' : name === '1B' ? 'IN2' : name === '1Y' ? 'OUT' : name,
        type: 'breadboard_male' as const,
        x: -30 + idx * 10,
        y: bottom ? 30 : -30,
        dir: [0, bottom ? 1 : -1] as [number, number],
        role: name === 'GND' ? ('gnd' as const) : name === 'VCC' ? ('power' as const) : undefined,
      };
    },
  ),
  props: [],
  defaults: { inputs: 2 },
  Art: () => (
    <g>
      <DipBody w={90} h={44} pins={14} />
      <Silk x={0} y={-5} size={8} fill="#C9CED3" weight={600}>
        74HC00
      </Silk>
      <Silk x={0} y={6} size={5.5} fill="#9BA1A7" weight={500}>
        QUAD NAND
      </Silk>
    </g>
  ),
});

export const LOGIC: PartDef<never>[] = [
  AndGate, OrGate, NandGate, NorGate, XorGate, XnorGate, NotGate, BufferGate,
  DFlipFlop, JkFlipFlop, TFlipFlop, SrLatch,
  HalfAdder, FullAdder, Adder4Bit,
  Multiplexer, Demultiplexer, Decoder38, Comparator4Bit,
  Counter4Bit, ShiftRegister4Bit,
  ClockGenerator, LogicToggle, LogicProbe, LogicSounder, Quad2InputNand,
] as unknown as PartDef<never>[];
