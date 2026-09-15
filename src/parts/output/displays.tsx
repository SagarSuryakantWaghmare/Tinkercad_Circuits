import { definePart } from '../registry';
import type { ArtProps, PartDef, TerminalDef } from '../types';
import { C, LED_COLORS } from '@/lib/tokens';
import { BoardShadow, Silk } from '../primitives';

const clamp01 = (n: number) => (isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

// ─── Seven-segment display ───────────────────────────────────────────────────
// Standard 10-pin single digit: bottom row E D COM C DP, top row G F COM A B.

const SEG_BOTTOM = ['E', 'D', 'COM1', 'C', 'DP'];
const SEG_TOP = ['G', 'F', 'COM2', 'A', 'B'];

interface SegProps extends Record<string, string | number> {
  common: string;
  color: string;
}

/** Segment geometry, drawn as tapered bars like a real LED digit. */
const SEGMENTS: Record<string, string> = {
  A: 'M-15,-26 L15,-26 L11,-21 L-11,-21 Z',
  B: 'M17,-24 L21,-19 L21,-3 L17,2 L14,-3 L14,-19 Z',
  C: 'M17,4 L21,9 L21,25 L17,30 L14,25 L14,9 Z',
  D: 'M-15,32 L15,32 L11,27 L-11,27 Z',
  E: 'M-17,4 L-14,9 L-14,25 L-17,30 L-21,25 L-21,9 Z',
  F: 'M-17,-24 L-14,-19 L-14,-3 L-17,2 L-21,-3 L-21,-19 Z',
  G: 'M-15,3 L-11,-1 L11,-1 L15,3 L11,7 L-11,7 Z',
};

function SevenSegArt({ props, state }: ArtProps<SegProps>) {
  const colour = LED_COLORS[String(props.color)] ?? LED_COLORS.red;
  const seg = (state?.segments as number[] | undefined) ?? [];
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const dp = clamp01(seg[7] ?? 0);

  return (
    <g>
      <BoardShadow w={62} h={86} rx={3} />
      <rect x={-31} y={-43} width={62} height={86} rx={3} fill="#1B1D1F" stroke="#0D0E0F" />
      {[-20, -10, 0, 10, 20].map((x) => (
        <g key={x}>
          <rect x={x - 1.6} y={-43} width={3.2} height={13} fill={C.metal} />
          <rect x={x - 1.6} y={30} width={3.2} height={13} fill={C.metal} />
        </g>
      ))}
      {names.map((nm, i) => {
        const lit = clamp01(seg[i] ?? 0);
        return (
          <path
            key={nm}
            d={SEGMENTS[nm]}
            fill={lit > 0.02 ? colour.glow : '#2C2F31'}
            opacity={lit > 0.02 ? 0.45 + 0.55 * lit : 1}
          />
        );
      })}
      <circle cx={24} cy={29} r={2.8} fill={dp > 0.02 ? colour.glow : '#2C2F31'} opacity={dp > 0.02 ? 0.45 + 0.55 * dp : 1} />
    </g>
  );
}

function sevenSegTerminals(): TerminalDef[] {
  const t: TerminalDef[] = [];
  SEG_TOP.forEach((name, i) => {
    t.push({
      name,
      type: 'breadboard_male',
      x: -20 + i * 10,
      y: -40,
      dir: [0, -1],
      group: name.startsWith('COM') ? 'com' : undefined,
    });
  });
  SEG_BOTTOM.forEach((name, i) => {
    t.push({
      name,
      type: 'breadboard_male',
      x: -20 + i * 10,
      y: 40,
      dir: [0, 1],
      group: name.startsWith('COM') ? 'com' : undefined,
    });
  });
  return t;
}

export const SevenSegment = definePart<SegProps>({
  id: 'seven-segment',
  name: '7-Segment Display',
  category: 'output',
  keywords: ['seven segment', 'digit', 'display', 'numeric', '7seg'],
  basic: true,
  size: { w: 70, h: 96 },
  origin: { x: 35, y: 48 },
  socketable: true,
  model: 'seven-segment',
  terminals: sevenSegTerminals(),
  props: [
    {
      key: 'common',
      label: 'Common pin',
      kind: 'select',
      options: [
        { value: 'cathode', label: 'Cathode (−)' },
        { value: 'anode', label: 'Anode (+)' },
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
  defaults: { common: 'cathode', color: 'red' },
  Art: SevenSegArt,
});

// Common-anode variant: same silicon and same 10-pin footprint, different
// polarity convention. The sim device already branches on the `common` prop,
// so shipping a preset lets the palette carry both variants directly.
export const SevenSegmentCa = definePart<SegProps>({
  ...SevenSegment,
  id: 'seven-segment-ca',
  name: '7-Segment Display (Common Anode)',
  keywords: ['seven segment', 'digit', 'display', 'numeric', '7seg', 'anode', 'ca'],
  basic: false,
  defaults: { common: 'anode', color: 'red' },
});

// ─── LED bar graph ───────────────────────────────────────────────────────────

export const BarGraph = definePart({
  id: 'bar-graph',
  name: 'LED Bar Graph',
  category: 'output',
  keywords: ['bargraph', 'bar', 'level', 'meter', '10 segment'],
  size: { w: 110, h: 76 },
  origin: { x: 55, y: 38 },
  socketable: true,
  model: 'bar-graph',
  terminals: Array.from({ length: 10 }, (_, i) => [
    {
      name: `A${i + 1}`,
      type: 'breadboard_male' as const,
      x: -45 + i * 10,
      y: -30,
      dir: [0, -1] as [number, number],
    },
    {
      name: `K${i + 1}`,
      type: 'breadboard_male' as const,
      x: -45 + i * 10,
      y: 30,
      dir: [0, 1] as [number, number],
    },
  ]).flat(),
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps<Record<string, never>>) => {
    const lit = (state?.segments as number[] | undefined) ?? [];
    return (
      <g>
        <BoardShadow w={106} h={62} rx={2} />
        <rect x={-53} y={-31} width={106} height={62} rx={2} fill="#1B1D1F" stroke="#0D0E0F" />
        {Array.from({ length: 10 }, (_, i) => {
          const v = clamp01(lit[i] ?? 0);
          return (
            <g key={i}>
              <rect x={-45 + i * 10 - 1.6} y={-31} width={3.2} height={11} fill={C.metal} />
              <rect x={-45 + i * 10 - 1.6} y={20} width={3.2} height={11} fill={C.metal} />
              <rect
                x={-45 + i * 10 - 3.5}
                y={-18}
                width={7}
                height={36}
                rx={1}
                fill={v > 0.02 ? '#FF3B3B' : '#3A2020'}
                opacity={v > 0.02 ? 0.5 + 0.5 * v : 1}
              />
            </g>
          );
        })}
      </g>
    );
  },
});

// ─── Character LCD ───────────────────────────────────────────────────────────

const LCD_PINS = [
  'VSS', 'VDD', 'V0', 'RS', 'RW', 'E',
  'DB0', 'DB1', 'DB2', 'DB3', 'DB4', 'DB5', 'DB6', 'DB7',
  'LED+', 'LED-',
];

interface LcdProps extends Record<string, string | number> {
  cols: number;
  rows: number;
}

function LcdArt({ props, state }: ArtProps<LcdProps>) {
  const cols = Number(props.cols) || 16;
  const rows = Number(props.rows) || 2;
  const lines = (state?.lines as string[] | undefined) ?? [];
  const backlight = state ? state.backlight !== false : true;

  const cellW = 9;
  const cellH = 13;
  const gridW = cols * cellW;
  const gridH = rows * cellH + (rows - 1) * 3;
  const boardW = Math.max(gridW + 40, 180);
  const boardH = gridH + 62;

  return (
    <g>
      <BoardShadow w={boardW} h={boardH} rx={3} />
      <rect x={-boardW / 2} y={-boardH / 2} width={boardW} height={boardH} rx={3} fill="#1E5E3A" stroke="#164A2D" />
      {/* header */}
      <rect x={-((LCD_PINS.length - 1) * 10) / 2 - 5} y={-boardH / 2 + 1} width={LCD_PINS.length * 10} height={9} rx={1} fill="#1A1C1D" />
      {LCD_PINS.map((p, i) => (
        <rect
          key={p}
          x={-((LCD_PINS.length - 1) * 10) / 2 + i * 10 - 1.4}
          y={-boardH / 2 + 1}
          width={2.8}
          height={9}
          fill={C.solderPad}
        />
      ))}
      {/* glass */}
      <rect
        x={-gridW / 2 - 8}
        y={-gridH / 2 - 6}
        width={gridW + 16}
        height={gridH + 12}
        rx={2}
        fill={backlight ? '#7FBF34' : '#4C6B3A'}
        stroke="#2E4A22"
      />
      {/* character cells */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const ch = (lines[r] ?? '')[c] ?? ' ';
          const x = -gridW / 2 + c * cellW;
          const y = -gridH / 2 + r * (cellH + 3);
          return (
            <g key={`${r}-${c}`}>
              <rect x={x + 0.6} y={y} width={cellW - 1.4} height={cellH} fill="#000" opacity={0.055} />
              {ch !== ' ' && (
                <text
                  x={x + cellW / 2 - 0.4}
                  y={y + cellH / 2}
                  fontSize={10}
                  fontFamily="var(--font-geist-mono), ui-monospace, monospace"
                  fill="#12200B"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {ch}
                </text>
              )}
            </g>
          );
        }),
      )}
      <Silk x={0} y={boardH / 2 - 10} size={6} fill="#9FD0AE" weight={600}>
        {`LCD ${cols}×${rows}`}
      </Silk>
    </g>
  );
}

function makeLcd(id: string, name: string, cols: number, rows: number, i2c: boolean) {
  const pins = i2c ? ['GND', 'VCC', 'SDA', 'SCL'] : LCD_PINS;
  const w = Math.max(cols * 9 + 40, 180);
  const h = rows * 13 + (rows - 1) * 3 + 62;
  return definePart<LcdProps>({
    id,
    name,
    category: 'output',
    keywords: ['lcd', 'display', 'character', 'hd44780', 'screen', i2c ? 'i2c' : 'parallel'],
    basic: !i2c && cols === 16 && rows === 2,
    size: { w: w + 10, h: h + 10 },
    origin: { x: (w + 10) / 2, y: (h + 10) / 2 },
    socketable: true,
    rotationStep: 90,
    model: i2c ? 'lcd-i2c' : 'lcd',
    terminals: pins.map((p, i) => ({
      name: p,
      type: 'breadboard_male' as const,
      x: -((pins.length - 1) * 10) / 2 + i * 10,
      y: -h / 2,
      dir: [0, -1] as [number, number],
      role:
        p === 'VDD' || p === 'VCC' || p === 'LED+' ? ('power' as const)
        : p === 'VSS' || p === 'GND' || p === 'LED-' ? ('gnd' as const)
        : ('digital' as const),
    })),
    props: [
      { key: 'cols', label: 'Columns', kind: 'number', min: 8, max: 20, step: 1 },
      { key: 'rows', label: 'Rows', kind: 'number', min: 1, max: 4, step: 1 },
    ],
    defaults: { cols, rows },
    Art: LcdArt,
  });
}

export const Lcd16x2 = makeLcd('lcd-16x2', 'LCD 16 × 2', 16, 2, false);
export const Lcd20x4 = makeLcd('lcd-20x4', 'LCD 20 × 4', 20, 4, false);
export const Lcd16x2I2C = makeLcd('lcd-16x2-i2c', 'LCD 16 × 2 (I²C)', 16, 2, true);

// ─── NeoPixel ────────────────────────────────────────────────────────────────

const rgbOf = (packed: number) => ({
  r: (packed >> 16) & 0xff,
  g: (packed >> 8) & 0xff,
  b: packed & 0xff,
});

export const NeoPixel = definePart({
  id: 'neopixel',
  name: 'NeoPixel',
  category: 'output',
  keywords: ['ws2812', 'neopixel', 'addressable', 'rgb', 'smart led'],
  size: { w: 64, h: 64 },
  origin: { x: 32, y: 32 },
  socketable: true,
  model: 'neopixel',
  terminals: [
    { name: 'VDD', type: 'breadboard_male', x: -15, y: -25, dir: [0, -1], role: 'power' },
    { name: 'DIN', type: 'breadboard_male', x: -15, y: 25, dir: [0, 1], role: 'digital' },
    { name: 'DOUT', type: 'breadboard_male', x: 15, y: -25, dir: [0, -1], role: 'digital' },
    { name: 'VSS', type: 'breadboard_male', x: 15, y: 25, dir: [0, 1], role: 'gnd' },
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps<Record<string, never>>) => {
    const packed = Number((state?.pixels as number[] | undefined)?.[0] ?? 0);
    const { r, g, b } = rgbOf(packed);
    const lit = Math.max(r, g, b) / 255;
    const hex = `rgb(${r},${g},${b})`;
    return (
      <g>
        {lit > 0.02 && <circle cx={0} cy={0} r={26} fill={hex} opacity={0.3 * lit} />}
        <rect x={-16} y={-16} width={32} height={32} rx={2} fill="#F2F2F2" stroke="#CFCFCF" />
        <rect x={-11} y={-11} width={22} height={22} rx={1.5} fill={lit > 0.02 ? hex : '#E4E4E4'} />
        <circle cx={0} cy={0} r={6} fill={lit > 0.02 ? hex : '#D8D8D8'} opacity={0.9} />
        <path d="M-16,-16 L-11,-16 L-16,-11 Z" fill="#9AA0A6" />
      </g>
    );
  },
});

interface RingProps extends Record<string, string | number> {
  count: number;
}

export const NeoPixelRing = definePart<RingProps>({
  id: 'neopixel-ring',
  name: 'NeoPixel Ring',
  category: 'output',
  keywords: ['ws2812', 'ring', 'neopixel', 'circle', 'rgb'],
  size: { w: 160, h: 160 },
  origin: { x: 80, y: 80 },
  model: 'neopixel',
  terminals: [
    { name: 'VDD', type: 'wire', x: -30, y: 70, dir: [0, 1], role: 'power' },
    { name: 'VSS', type: 'wire', x: -10, y: 70, dir: [0, 1], role: 'gnd' },
    { name: 'DIN', type: 'wire', x: 10, y: 70, dir: [0, 1], role: 'digital' },
    { name: 'DOUT', type: 'wire', x: 30, y: 70, dir: [0, 1], role: 'digital' },
  ],
  props: [
    {
      key: 'count',
      label: 'Pixels',
      kind: 'select',
      options: [8, 12, 16, 24].map((v) => ({ value: String(v), label: `${v}` })),
    },
  ],
  defaults: { count: 12 },
  Art: ({ props, state }: ArtProps<RingProps>) => {
    const count = Number(props.count) || 12;
    const px = (state?.pixels as number[] | undefined) ?? [];
    const R = 52;
    return (
      <g>
        <circle cx={0} cy={0} r={66} fill="#1B1D1F" stroke="#0E0F10" />
        <circle cx={0} cy={0} r={34} fill={C.canvasBg} />
        {Array.from({ length: count }, (_, i) => {
          const a = (i / count) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(a) * R;
          const y = Math.sin(a) * R;
          const { r, g, b } = rgbOf(Number(px[i] ?? 0));
          const lit = Math.max(r, g, b) / 255;
          const hex = `rgb(${r},${g},${b})`;
          return (
            <g key={i}>
              {lit > 0.02 && <circle cx={x} cy={y} r={14} fill={hex} opacity={0.35 * lit} />}
              <rect x={x - 7} y={y - 7} width={14} height={14} rx={1.5} fill="#F2F2F2" stroke="#CFCFCF" strokeWidth={0.6} />
              <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={1} fill={lit > 0.02 ? hex : '#E4E4E4'} />
            </g>
          );
        })}
      </g>
    );
  },
});

export const NeoPixelStrip = definePart<RingProps>({
  id: 'neopixel-strip',
  name: 'NeoPixel Strip',
  category: 'output',
  keywords: ['ws2812', 'strip', 'neopixel', 'led strip', 'rgb'],
  size: { w: 340, h: 50 },
  origin: { x: 170, y: 25 },
  model: 'neopixel',
  terminals: [
    { name: 'VDD', type: 'wire', x: -160, y: -16, dir: [-1, 0], role: 'power' },
    { name: 'DIN', type: 'wire', x: -160, y: 0, dir: [-1, 0], role: 'digital' },
    { name: 'VSS', type: 'wire', x: -160, y: 16, dir: [-1, 0], role: 'gnd' },
    { name: 'DOUT', type: 'wire', x: 160, y: 0, dir: [1, 0], role: 'digital' },
  ],
  props: [
    {
      key: 'count',
      label: 'Pixels',
      kind: 'select',
      options: [8, 12, 16, 24, 30].map((v) => ({ value: String(v), label: `${v}` })),
    },
  ],
  defaults: { count: 8 },
  Art: ({ props, state }: ArtProps<RingProps>) => {
    const count = Number(props.count) || 8;
    const px = (state?.pixels as number[] | undefined) ?? [];
    const step = 300 / count;
    return (
      <g>
        <rect x={-155} y={-14} width={310} height={28} rx={2} fill="#1B1D1F" stroke="#0E0F10" />
        {Array.from({ length: count }, (_, i) => {
          const x = -150 + step / 2 + i * step;
          const { r, g, b } = rgbOf(Number(px[i] ?? 0));
          const lit = Math.max(r, g, b) / 255;
          const hex = `rgb(${r},${g},${b})`;
          return (
            <g key={i}>
              {lit > 0.02 && <circle cx={x} cy={0} r={13} fill={hex} opacity={0.3 * lit} />}
              <rect x={x - 7} y={-7} width={14} height={14} rx={1.5} fill="#F2F2F2" stroke="#CFCFCF" strokeWidth={0.6} />
              <rect x={x - 4.5} y={-4.5} width={9} height={9} rx={1} fill={lit > 0.02 ? hex : '#E4E4E4'} />
            </g>
          );
        })}
      </g>
    );
  },
});

// ─── 8×8 LED matrix ──────────────────────────────────────────────────────────

export const LedMatrix = definePart({
  id: 'led-matrix',
  name: 'LED Matrix 8 × 8',
  category: 'output',
  keywords: ['matrix', '8x8', 'dot matrix', 'display', 'max7219'],
  size: { w: 180, h: 180 },
  origin: { x: 90, y: 90 },
  socketable: true,
  rotationStep: 90,
  model: 'led-matrix',
  terminals: [
    ...Array.from({ length: 8 }, (_, i) => ({
      name: `ROW${i + 1}`,
      type: 'breadboard_male' as const,
      x: -35 + i * 10,
      y: -80,
      dir: [0, -1] as [number, number],
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      name: `COL${i + 1}`,
      type: 'breadboard_male' as const,
      x: -35 + i * 10,
      y: 80,
      dir: [0, 1] as [number, number],
    })),
  ],
  props: [],
  defaults: {},
  Art: ({ state }: ArtProps<Record<string, never>>) => {
    const grid = (state?.grid as number[] | undefined) ?? [];
    return (
      <g>
        <BoardShadow w={156} h={156} rx={3} />
        <rect x={-78} y={-78} width={156} height={156} rx={3} fill="#1B1D1F" stroke="#0D0E0F" />
        {Array.from({ length: 8 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => {
            const v = clamp01(grid[r * 8 + c] ?? 0);
            return (
              <circle
                key={`${r}-${c}`}
                cx={-63 + c * 18}
                cy={-63 + r * 18}
                r={7}
                fill={v > 0.02 ? '#FF3B3B' : '#33191A'}
                opacity={v > 0.02 ? 0.45 + 0.55 * v : 1}
              />
            );
          }),
        )}
      </g>
    );
  },
});

// Tinkercad ships fixed-size ring and strip presets alongside the flexible
// module. We keep the flexible NeoPixelRing/Strip and add named presets so
// students dragging "NeoPixel Ring 12" find it directly under Output rather
// than having to change a prop after placing the generic ring.
function neoRingPreset(id: string, name: string, count: number, base: PartDef<RingProps>) {
  return definePart<RingProps>({
    ...base,
    id,
    name,
    // Different id / name / defaults share the same Art and terminals.
    defaults: { ...base.defaults, count },
  });
}

function neoStripPreset(id: string, name: string, count: number, base: PartDef<RingProps>) {
  return definePart<RingProps>({
    ...base,
    id,
    name,
    defaults: { ...base.defaults, count },
  });
}

export const NeoPixelRing12 = neoRingPreset(
  'neopixel-ring-12',
  'NeoPixel Ring 12',
  12,
  NeoPixelRing,
);
export const NeoPixelRing16 = neoRingPreset(
  'neopixel-ring-16',
  'NeoPixel Ring 16',
  16,
  NeoPixelRing,
);
export const NeoPixelStrip6 = neoStripPreset(
  'neopixel-strip-6',
  'NeoPixel Strip 6',
  6,
  NeoPixelStrip,
);
export const NeoPixelStrip8 = neoStripPreset(
  'neopixel-strip-8',
  'NeoPixel Strip 8',
  8,
  NeoPixelStrip,
);
export const NeoPixelStrip10 = neoStripPreset(
  'neopixel-strip-10',
  'NeoPixel Strip 10',
  10,
  NeoPixelStrip,
);
export const NeoPixelStrip16 = neoStripPreset(
  'neopixel-strip-16',
  'NeoPixel Strip 16',
  16,
  NeoPixelStrip,
);
export const NeoPixelStrip20 = neoStripPreset(
  'neopixel-strip-20',
  'NeoPixel Strip 20',
  20,
  NeoPixelStrip,
);

export const DISPLAYS: PartDef<never>[] = [
  SevenSegment,
  SevenSegmentCa,
  BarGraph,
  Lcd16x2,
  Lcd20x4,
  Lcd16x2I2C,
  NeoPixel,
  NeoPixelRing,
  NeoPixelRing12,
  NeoPixelRing16,
  NeoPixelStrip,
  NeoPixelStrip6,
  NeoPixelStrip8,
  NeoPixelStrip10,
  NeoPixelStrip16,
  NeoPixelStrip20,
  LedMatrix,
] as unknown as PartDef<never>[];
