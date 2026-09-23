import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C, LED_COLORS } from '@/lib/tokens';
import { BoardShadow, Leg, Silk } from '../primitives';

const clamp01 = (n: number) => (isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

// ─── Four-digit seven-segment display ────────────────────────────────────────
//
// Twelve pins: eight segment lines shared by every digit, and four commons that
// select one digit at a time. Pin order follows the usual 0.56" module — six
// along the top, six along the bottom.

const TOP_PINS = ['D1', 'A', 'F', 'D2', 'D3', 'B'];
const BOTTOM_PINS = ['E', 'D', 'DP', 'C', 'G', 'D4'];

/** Segment geometry for one digit, drawn as tapered bars. */
const SEGMENTS: Record<string, string> = {
  A: 'M-10,-19 L10,-19 L7,-15 L-7,-15 Z',
  B: 'M12,-17 L15,-13 L15,-2 L12,1 L9,-2 L9,-13 Z',
  C: 'M12,3 L15,6 L15,17 L12,21 L9,17 L9,6 Z',
  D: 'M-10,23 L10,23 L7,19 L-7,19 Z',
  E: 'M-12,3 L-9,6 L-9,17 L-12,21 L-15,17 L-15,6 Z',
  F: 'M-12,-17 L-9,-13 L-9,-2 L-12,1 L-15,-2 L-15,-13 Z',
  G: 'M-10,2 L-7,-1 L7,-1 L10,2 L7,5 L-7,5 Z',
};
const SEG_ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

interface Seg4Props extends Record<string, string | number> {
  common: string;
  color: string;
}

const SEG4_W = 150;
const SEG4_H = 76;

function SevenSeg4Art({ props, state }: ArtProps<Seg4Props>) {
  const colour = LED_COLORS[String(props.color)] ?? LED_COLORS.red;
  const digits = (state?.digits as number[] | undefined) ?? [];

  return (
    <g>
      <BoardShadow w={SEG4_W} h={SEG4_H} rx={3} />
      <rect
        x={-SEG4_W / 2}
        y={-SEG4_H / 2}
        width={SEG4_W}
        height={SEG4_H}
        rx={3}
        fill="#1B1D1F"
        stroke="#0D0E0F"
      />
      {TOP_PINS.map((_, i) => (
        <rect
          key={`t${i}`}
          x={-25 + i * 10 - 1.6}
          y={-SEG4_H / 2 - 12}
          width={3.2}
          height={14}
          fill={C.metal}
        />
      ))}
      {BOTTOM_PINS.map((_, i) => (
        <rect
          key={`b${i}`}
          x={-25 + i * 10 - 1.6}
          y={SEG4_H / 2 - 2}
          width={3.2}
          height={14}
          fill={C.metal}
        />
      ))}

      {[0, 1, 2, 3].map((d) => (
        <g key={d} transform={`translate(${-52.5 + d * 35} 0)`}>
          {SEG_ORDER.map((nm, i) => {
            const lit = clamp01(digits[d * 8 + i] ?? 0);
            return (
              <path
                key={nm}
                d={SEGMENTS[nm]}
                fill={lit > 0.02 ? colour.glow : '#2C2F31'}
                opacity={lit > 0.02 ? 0.4 + 0.6 * lit : 1}
              />
            );
          })}
          <circle
            cx={19}
            cy={21}
            r={2.2}
            fill={clamp01(digits[d * 8 + 7] ?? 0) > 0.02 ? colour.glow : '#2C2F31'}
          />
        </g>
      ))}
      {/* Colon between the middle digits, as clock modules have. */}
      {[-8, 6].map((y) => (
        <circle key={y} cx={-17.5} cy={y} r={2.2} fill="#2C2F31" />
      ))}
    </g>
  );
}

function seg4Terminals(): TerminalDef[] {
  const t: TerminalDef[] = [];
  // 12 clear of the body, not 10: that puts the two rows 100 apart, ten whole
  // pitches, so they land on rows either side of the centre channel the way a
  // DIP package does. At 96 only one row could ever be in holes.
  TOP_PINS.forEach((name, i) => {
    t.push({ name, type: 'breadboard_male', x: -25 + i * 10, y: -SEG4_H / 2 - 12, dir: [0, -1] });
  });
  BOTTOM_PINS.forEach((name, i) => {
    t.push({ name, type: 'breadboard_male', x: -25 + i * 10, y: SEG4_H / 2 + 12, dir: [0, 1] });
  });
  return t;
}

export const SevenSegment4 = definePart<Seg4Props>({
  id: 'seven-segment-4',
  name: '4-Digit 7-Segment Display',
  category: 'output',
  keywords: ['seven segment', '4 digit', 'clock', 'display', 'numeric', 'multiplexed'],
  size: { w: SEG4_W + 10, h: SEG4_H + 34 },
  origin: { x: (SEG4_W + 10) / 2, y: (SEG4_H + 34) / 2 },
  socketable: true,
  rotationStep: 90,
  model: 'seven-segment-4',
  terminals: seg4Terminals(),
  props: [
    {
      key: 'common',
      label: 'Digit pins are',
      kind: 'select',
      options: [
        { value: 'anode', label: 'Common anode (+)' },
        { value: 'cathode', label: 'Common cathode (−)' },
      ],
      help: 'Which way round the digit-select pins drive the segments.',
    },
    {
      key: 'color',
      label: 'Colour',
      kind: 'color',
      options: ['red', 'green', 'blue', 'yellow', 'white'].map((v) => ({
        value: v,
        label: v[0].toUpperCase() + v.slice(1),
      })),
    },
  ],
  defaults: { common: 'anode', color: 'red' },
  Art: SevenSeg4Art,
});

// The Tinkercad "Clock Display" variant: same 4-digit module with the colon
// permanently lit so it reads as a clock. A separate part means the palette
// carries a ready-to-use HH:MM display alongside the plain 4-digit module.
function SevenSegClockArt(p: ArtProps<Seg4Props>) {
  const colour = LED_COLORS[String(p.props.color)] ?? LED_COLORS.red;
  return (
    <g>
      <SevenSeg4Art {...p} />
      {[-8, 6].map((y) => (
        <circle key={y} cx={-17.5} cy={y} r={2.2} fill={colour.glow} opacity={0.9} />
      ))}
    </g>
  );
}

export const SevenSegmentClock = definePart<Seg4Props>({
  id: 'seven-segment-clock',
  name: '7-Segment Clock Display',
  category: 'output',
  keywords: ['seven segment', 'clock', 'display', 'colon', 'time', 'hh mm'],
  size: { w: SEG4_W + 10, h: SEG4_H + 34 },
  origin: { x: (SEG4_W + 10) / 2, y: (SEG4_H + 34) / 2 },
  socketable: true,
  rotationStep: 90,
  model: 'seven-segment-4',
  terminals: seg4Terminals(),
  props: [
    {
      key: 'common',
      label: 'Digit pins are',
      kind: 'select',
      options: [
        { value: 'anode', label: 'Common anode (+)' },
        { value: 'cathode', label: 'Common cathode (−)' },
      ],
    },
    {
      key: 'color',
      label: 'Colour',
      kind: 'color',
      options: ['red', 'green', 'blue', 'yellow', 'white'].map((v) => ({
        value: v,
        label: v[0].toUpperCase() + v.slice(1),
      })),
    },
  ],
  defaults: { common: 'anode', color: 'red' },
  Art: SevenSegClockArt,
});

// ─── Incandescent lamp ───────────────────────────────────────────────────────

interface BulbProps extends Record<string, string | number> {
  voltage: number;
  power: number;
}

export const LightBulb = definePart<BulbProps>({
  id: 'light-bulb',
  name: 'Light Bulb',
  category: 'output',
  keywords: ['lamp', 'bulb', 'incandescent', 'light', 'filament', 'globe'],
  size: { w: 66, h: 108 },
  origin: { x: 33, y: 54 },
  socketable: true,
  model: 'light-bulb',
  terminals: [
    { name: 'terminal1', type: 'breadboard_male', x: -10, y: 44, dir: [0, 1], role: 'passive' },
    { name: 'terminal2', type: 'breadboard_male', x: 10, y: 44, dir: [0, 1], role: 'passive' },
  ],
  props: [
    { key: 'voltage', label: 'Rated voltage', kind: 'number', min: 1, max: 240, step: 0.5, unit: 'V' },
    { key: 'power', label: 'Rated power', kind: 'number', min: 0.05, max: 100, step: 0.05, unit: 'W' },
  ],
  defaults: { voltage: 5, power: 0.5 },
  Art: ({ state }: ArtProps<BulbProps>) => {
    const b = clamp01(Number(state?.brightness ?? 0));
    return (
      <g>
        <Leg x1={-10} y1={26} x2={-10} y2={44} />
        <Leg x1={10} y1={26} x2={10} y2={44} />
        {/* Screw base */}
        <path d="M-11,18 L11,18 L9,32 L-9,32 Z" fill="#B0B5BA" stroke="#8C9197" strokeWidth={1} />
        {[21, 25, 29].map((y) => (
          <line key={y} x1={-10.5} y1={y} x2={10.5} y2={y} stroke="#8C9197" strokeWidth={1.2} />
        ))}
        {/* Glass envelope */}
        {b > 0.02 && (
          <circle cx={0} cy={-12} r={40} fill={LED_COLORS.yellow.glow} opacity={0.18 + 0.4 * b} />
        )}
        <path
          d="M-12,20 C-24,8 -26,-6 -26,-14 A26,26 0 1,1 26,-14 C26,-6 24,8 12,20 Z"
          fill={b > 0.02 ? '#FFF3C8' : '#DDE6EC'}
          fillOpacity={b > 0.02 ? 0.5 + 0.5 * b : 0.55}
          stroke="#AEBCC6"
          strokeWidth={1.4}
        />
        {/* Filament */}
        <path
          d="M-6,18 L-6,2 L-3,8 L0,0 L3,8 L6,2 L6,18"
          fill="none"
          stroke={b > 0.02 ? LED_COLORS.yellow.glow : '#8C9197'}
          strokeWidth={b > 0.02 ? 2 + 1.6 * b : 1.4}
          strokeLinejoin="round"
        />
      </g>
    );
  },
});

// ─── Bi-colour LED ───────────────────────────────────────────────────────────

export const BicolorLed = definePart({
  id: 'led-bicolor',
  name: 'Bi-Colour LED',
  category: 'output',
  keywords: ['bicolor', 'bicolour', 'two colour', 'red green', 'led', 'dual'],
  size: { w: 46, h: 76 },
  origin: { x: 23, y: 38 },
  socketable: true,
  model: 'led-bicolor',
  terminals: [
    { name: 'anodeR', type: 'breadboard_male', x: -10, y: 30, dir: [0, 1], role: 'passive' },
    { name: 'cathode', type: 'breadboard_male', x: 0, y: 30, dir: [0, 1], role: 'passive' },
    { name: 'anodeG', type: 'breadboard_male', x: 10, y: 30, dir: [0, 1], role: 'passive' },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps) => {
    const r = clamp01(Number(state?.red ?? 0));
    const g = clamp01(Number(state?.green ?? 0));
    const lit = Math.max(r, g);
    // Both dice share one lens, so the colours mix rather than sit side by side.
    const mix = `rgb(${Math.round(40 + 215 * r)},${Math.round(40 + 215 * g)},60)`;
    return (
      <g>
        <Leg x1={-10} y1={12} x2={-10} y2={30} />
        <Leg x1={0} y1={12} x2={0} y2={30} />
        <Leg x1={10} y1={12} x2={10} y2={30} />
        {lit > 0.02 && <circle cx={0} cy={-8} r={26} fill={mix} opacity={0.16 + 0.42 * lit} />}
        <path
          d="M-13,12 L-13,-6 A13,13 0 0,1 13,-6 L13,12 Z"
          fill={lit > 0.02 ? mix : '#C8D2CE'}
          fillOpacity={lit > 0.02 ? 0.55 + 0.45 * lit : 0.7}
          stroke="#8E9A96"
          strokeWidth={1.2}
        />
        <rect x={-15} y={10} width={30} height={4} rx={1.5} fill="#B6C0BC" />
        <Silk x={-10} y={22} size={5} fill="#6B7378" weight={600}>
          R
        </Silk>
        <Silk x={10} y={22} size={5} fill="#6B7378" weight={600}>
          G
        </Silk>
      </g>
    );
  },
});

// ─── Infrared LED ────────────────────────────────────────────────────────────

export const IrLed = definePart({
  id: 'led-ir',
  name: 'Infrared LED',
  category: 'output',
  keywords: ['ir', 'infrared', 'emitter', '940nm', 'led', 'transmitter'],
  size: { w: 40, h: 70 },
  origin: { x: 20, y: 35 },
  socketable: true,
  model: 'led-ir',
  terminals: [
    { name: 'anode', type: 'breadboard_male', x: -5, y: 28, dir: [0, 1], role: 'passive' },
    { name: 'cathode', type: 'breadboard_male', x: 5, y: 28, dir: [0, 1], role: 'passive' },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps) => {
    const b = clamp01(Number(state?.brightness ?? 0));
    return (
      <g>
        <Leg x1={-5} y1={10} x2={-5} y2={28} />
        <Leg x1={5} y1={10} x2={5} y2={28} />
        {/* Infrared is invisible; the die glow is shown faintly so it reads. */}
        {b > 0.02 && <circle cx={0} cy={-8} r={22} fill="#8B6BE8" opacity={0.12 + 0.28 * b} />}
        <path
          d="M-11,10 L-11,-6 A11,11 0 0,1 11,-6 L11,10 Z"
          fill="#2E3336"
          fillOpacity={0.85}
          stroke="#1B1E20"
          strokeWidth={1.2}
        />
        {b > 0.02 && <circle cx={0} cy={-3} r={5} fill="#A98BFF" opacity={0.35 + 0.5 * b} />}
        <rect x={-13} y={8} width={26} height={4} rx={1.5} fill="#3A4043" />
      </g>
    );
  },
});

export const OUTPUT_EXTRAS: PartDef<never>[] = [
  SevenSegment4,
  SevenSegmentClock,
  LightBulb,
  BicolorLed,
  IrLed,
] as unknown as PartDef<never>[];
