import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { LED_COLORS } from '@/lib/tokens';
import { Leg } from '../primitives';

interface LedProps extends Record<string, string | number> {
  color: string;
}

const COLOR_OPTIONS = Object.keys(LED_COLORS).map((k) => ({
  value: k,
  label: k[0].toUpperCase() + k.slice(1),
}));

/**
 * A 5 mm through-hole LED viewed from above: the lens dome with its flat
 * cathode side, the two leads, and the emissive glow whose opacity tracks the
 * solved forward current.
 */
function LedArt({ props, state }: ArtProps<LedProps>) {
  const c = LED_COLORS[String(props.color)] ?? LED_COLORS.red;
  const brightness = clamp01(Number(state?.brightness ?? 0));
  const burnt = !!state?.burnt;

  return (
    <g>
      {/* leads: anode is the long one */}
      <Leg x1={-5} y1={4} x2={-5} y2={22} />
      <Leg x1={5} y1={4} x2={5} y2={14} />

      {/* glow, painted under the lens so the dome still reads as glass */}
      {brightness > 0.01 && !burnt && (
        <>
          <circle cx={0} cy={-4} r={26} fill={c.glow} opacity={0.16 * brightness} />
          <circle cx={0} cy={-4} r={17} fill={c.glow} opacity={0.3 * brightness} />
        </>
      )}

      {/* flange */}
      <path
        d="M-11,2 L11,2 L11,5 L-11,5 Z"
        fill={burnt ? '#3A3230' : c.body}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={0.5}
      />
      {/* body: circle with a flat on the cathode side */}
      <path
        d="M-10,-4 A10,10 0 0,1 10,-4 L10,2 L-10,2 Z"
        fill={burnt ? '#3A3230' : c.body}
        opacity={0.95}
      />
      <circle
        cx={0}
        cy={-4}
        r={10}
        fill={burnt ? '#2A2422' : c.body}
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.6}
      />
      {/* flat cathode edge */}
      <path d="M7.2,-11 L7.2,3 L10.5,3 L10.5,-11 Z" fill="rgba(0,0,0,0.14)" />
      {/* lens highlight */}
      <ellipse cx={-3} cy={-7.5} rx={3.6} ry={2.6} fill="#FFFFFF" opacity={burnt ? 0.1 : 0.5} />
      {brightness > 0.01 && !burnt && (
        <circle cx={0} cy={-4} r={7} fill={c.glow} opacity={0.55 + 0.45 * brightness} />
      )}
      {burnt && (
        <path
          d="M-6,-10 L-2,-4 L-6,2 M6,-10 L2,-4 L6,2"
          stroke="#171717"
          strokeWidth={1.4}
          fill="none"
        />
      )}
    </g>
  );
}

const clamp01 = (n: number) => (isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

export const Led = definePart<LedProps>({
  id: 'led',
  name: 'LED',
  category: 'output',
  keywords: ['light', 'diode', 'lamp', 'indicator'],
  basic: true,
  size: { w: 30, h: 46 },
  origin: { x: 15, y: 18 },
  socketable: true,
  model: 'led',
  terminals: [
    { name: 'cathode', type: 'breadboard_male', x: 5, y: 14, dir: [0, 1] },
    { name: 'anode', type: 'breadboard_male', x: -5, y: 22, dir: [0, 1] },
  ],
  props: [{ key: 'color', label: 'Colour', kind: 'color', options: COLOR_OPTIONS }],
  defaults: { color: 'red' },
  Art: LedArt,
});

/** 10 mm variant — same model, larger art. */
export const LedLarge = definePart<LedProps>({
  id: 'led-10mm',
  name: 'LED (10mm)',
  category: 'output',
  keywords: ['light', 'diode', 'big', 'indicator'],
  size: { w: 46, h: 58 },
  origin: { x: 23, y: 24 },
  socketable: true,
  model: 'led',
  terminals: [
    { name: 'cathode', type: 'breadboard_male', x: 5, y: 20, dir: [0, 1] },
    { name: 'anode', type: 'breadboard_male', x: -5, y: 30, dir: [0, 1] },
  ],
  props: [{ key: 'color', label: 'Colour', kind: 'color', options: COLOR_OPTIONS }],
  defaults: { color: 'green' },
  Art: (p: ArtProps<LedProps>) => (
    <g transform="scale(1.5)">
      <LedArt {...p} />
    </g>
  ),
});

// ─── RGB LED ─────────────────────────────────────────────────────────────────

interface RgbProps extends Record<string, string | number> {
  common: string;
}

function RgbLedArt({ state }: ArtProps<RgbProps>) {
  const r = clamp01(Number(state?.r ?? 0));
  const g = clamp01(Number(state?.g ?? 0));
  const b = clamp01(Number(state?.b ?? 0));
  const lit = Math.max(r, g, b);
  const hex = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  return (
    <g>
      <Leg x1={-15} y1={4} x2={-15} y2={18} />
      <Leg x1={-5} y1={4} x2={-5} y2={26} />
      <Leg x1={5} y1={4} x2={5} y2={18} />
      <Leg x1={15} y1={4} x2={15} y2={18} />
      {lit > 0.01 && (
        <>
          <circle cx={0} cy={-4} r={28} fill={hex} opacity={0.18 * lit} />
          <circle cx={0} cy={-4} r={18} fill={hex} opacity={0.32 * lit} />
        </>
      )}
      <path d="M-12,2 L12,2 L12,5 L-12,5 Z" fill="#E4E4E4" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      <circle cx={0} cy={-4} r={11} fill="#EDEDED" stroke="rgba(0,0,0,0.2)" strokeWidth={0.6} opacity={0.9} />
      {lit > 0.01 && <circle cx={0} cy={-4} r={7.5} fill={hex} opacity={0.6 + 0.4 * lit} />}
      <ellipse cx={-3.5} cy={-8} rx={3.6} ry={2.6} fill="#FFFFFF" opacity={0.55} />
    </g>
  );
}

export const RgbLed = definePart<RgbProps>({
  id: 'led-rgb',
  name: 'RGB LED',
  category: 'output',
  keywords: ['rgb', 'colour', 'tricolor', 'multicolour'],
  basic: true,
  size: { w: 46, h: 52 },
  origin: { x: 23, y: 20 },
  socketable: true,
  model: 'led-rgb',
  terminals: [
    { name: 'red', type: 'breadboard_male', x: -15, y: 18, dir: [0, 1] },
    { name: 'common', type: 'breadboard_male', x: -5, y: 26, dir: [0, 1] },
    { name: 'green', type: 'breadboard_male', x: 5, y: 18, dir: [0, 1] },
    { name: 'blue', type: 'breadboard_male', x: 15, y: 18, dir: [0, 1] },
  ],
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
  ],
  defaults: { common: 'cathode' },
  Art: RgbLedArt,
});

// Common-anode variant. Mirror art shape, but the long lead now sits on the
// anode side and the channel pins are labelled R/G/B like real CA parts.
interface RgbCaProps extends Record<string, string | number | boolean> {
  commonAnode: boolean;
}

function RgbLedCaArt({ state }: ArtProps<RgbCaProps>) {
  const r = clamp01(Number(state?.r ?? 0));
  const g = clamp01(Number(state?.g ?? 0));
  const b = clamp01(Number(state?.b ?? 0));
  const lit = Math.max(r, g, b);
  const hex = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  return (
    <g>
      {/* Anode is the long leg (second from the left on a CA part). */}
      <Leg x1={-15} y1={4} x2={-15} y2={18} />
      <Leg x1={-5} y1={4} x2={-5} y2={26} />
      <Leg x1={5} y1={4} x2={5} y2={18} />
      <Leg x1={15} y1={4} x2={15} y2={18} />
      {lit > 0.01 && (
        <>
          <circle cx={0} cy={-4} r={28} fill={hex} opacity={0.18 * lit} />
          <circle cx={0} cy={-4} r={18} fill={hex} opacity={0.32 * lit} />
        </>
      )}
      <path d="M-12,2 L12,2 L12,5 L-12,5 Z" fill="#E4E4E4" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      <circle cx={0} cy={-4} r={11} fill="#EDEDED" stroke="rgba(0,0,0,0.2)" strokeWidth={0.6} opacity={0.9} />
      {lit > 0.01 && <circle cx={0} cy={-4} r={7.5} fill={hex} opacity={0.6 + 0.4 * lit} />}
      <ellipse cx={-3.5} cy={-8} rx={3.6} ry={2.6} fill="#FFFFFF" opacity={0.55} />
    </g>
  );
}

export const RgbLedCa = definePart<RgbCaProps>({
  id: 'led-rgb-ca',
  name: 'RGB LED (Common Anode)',
  category: 'output',
  keywords: ['rgb', 'colour', 'tricolor', 'anode', 'common anode', 'ca'],
  size: { w: 46, h: 52 },
  origin: { x: 23, y: 20 },
  socketable: true,
  model: 'led-rgb',
  terminals: [
    { name: 'R', type: 'breadboard_male', x: -15, y: 18, dir: [0, 1] },
    { name: 'anode', type: 'breadboard_male', x: -5, y: 26, dir: [0, 1], role: 'power' },
    { name: 'G', type: 'breadboard_male', x: 5, y: 18, dir: [0, 1] },
    { name: 'B', type: 'breadboard_male', x: 15, y: 18, dir: [0, 1] },
  ],
  props: [],
  defaults: { commonAnode: true },
  Art: RgbLedCaArt,
});

export const LEDS: PartDef<never>[] = [Led, LedLarge, RgbLed, RgbLedCa] as unknown as PartDef<never>[];
