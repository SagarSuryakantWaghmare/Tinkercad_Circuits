import { definePart } from '../registry';
import type { ArtProps, PartDef } from '../types';
import { LED_COLORS } from '@/lib/tokens';
import { HOT_GLOW, bloom, emissionHue, glowId, haloAlpha, litAlpha } from '../emissive';
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
  const key = String(props.color) in LED_COLORS ? String(props.color) : 'red';
  const c = LED_COLORS[key];
  const e = clamp01(Number(state?.brightness ?? 0));
  const burnt = !!state?.burnt;
  const lit = e > 0.004 && !burnt;

  // The halo grows as well as brightens; a bright LED washes further across
  // the board than a dim one rather than just being a denser disc.
  const haloR = 13 + 24 * e;
  const hot = bloom(e);

  return (
    <g>
      {/* leads: anode is the long one. The tips are PITCH apart in y so both
          legs can reach holes on the same board lattice. */}
      <Leg x1={-5} y1={4} x2={-5} y2={24} />
      <Leg x1={5} y1={4} x2={5} y2={14} />

      {/* Bloom onto the board, under the package. One smooth ramp rather than
          a pair of flat discs, which showed their own edges as two rings and
          never got past a pale wash however hard the LED was driven. */}
      {lit && (
        <>
          <circle cx={0} cy={-4} r={haloR} fill={`url(#${glowId(key)})`} opacity={haloAlpha(e)} />
          <circle cx={0} cy={-4} r={haloR * 0.45} fill={`url(#${HOT_GLOW})`} opacity={0.55 * hot} />
        </>
      )}

      {/* flange */}
      <path
        d="M-11,2 L11,2 L11,5 L-11,5 Z"
        fill={burnt ? '#3A3230' : c.body}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={0.5}
      />
      {/*
        The lens, as a D: a 5 mm LED's cathode side is a chord cut out of the
        dome. It used to be a full circle with a grey tab laid over the top
        right, which sat entirely outside the circle at every height and read
        as a chip broken off the package.
      */}
      <path
        d="M8,-10 A10,10 0 1,0 8,2 Z"
        fill={burnt ? '#2A2422' : c.body}
        stroke="rgba(0,0,0,0.22)"
        strokeWidth={0.6}
      />

      {/* Emission across the whole lens, not a disc inside it — a smaller
          disc left a ring of unlit body between the lit centre and the halo. */}
      {lit && (
        <>
          <circle cx={0} cy={-4} r={10} fill={c.glow} opacity={litAlpha(e)} />
          <circle cx={0} cy={-4} r={9} fill={`url(#${glowId(key)})`} opacity={e} />
        </>
      )}

      {/* Glass specular, over the emission rather than under it: drawn first
          it was painted out by the lit lens, so a fully lit LED lost the one
          cue that it was a rounded dome and read as a flat sticker. */}
      <ellipse
        cx={-3}
        cy={-7.5}
        rx={3.6}
        ry={2.6}
        fill="#FFFFFF"
        opacity={burnt ? 0.1 : 0.42 + 0.3 * hot}
      />

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
    // 24, not 22: the gap to the cathode has to be a whole PITCH or only one
    // of the two legs can ever sit in a hole.
    { name: 'anode', type: 'breadboard_male', x: -5, y: 24, dir: [0, 1] },
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
  // The channel values are intensities, not paint. Used as a fill directly a
  // dim mix is nearly black, so turning the part on at 2 % dropped the lens
  // from near-white to dark grey — brighter reading as darker. The hue is
  // normalised and the intensity carried by alpha, the way light composites.
  const hue = emissionHue(r, g, b);
  const on = lit > 0.004;
  const hot = bloom(lit);
  const haloR = 14 + 22 * lit;
  return (
    <g>
      <Leg x1={-15} y1={4} x2={-15} y2={18} />
      {/* 28, a whole pitch below the others, so all four legs reach holes. */}
      <Leg x1={-5} y1={4} x2={-5} y2={28} />
      <Leg x1={5} y1={4} x2={5} y2={18} />
      <Leg x1={15} y1={4} x2={15} y2={18} />
      {on && (
        <>
          <circle cx={0} cy={-4} r={haloR} fill={hue} opacity={0.10 * haloAlpha(lit)} />
          <circle cx={0} cy={-4} r={haloR * 0.72} fill={hue} opacity={0.16 * haloAlpha(lit)} />
          <circle cx={0} cy={-4} r={haloR * 0.46} fill={hue} opacity={0.22 * haloAlpha(lit)} />
        </>
      )}
      <path d="M-12,2 L12,2 L12,5 L-12,5 Z" fill="#E4E4E4" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      <circle cx={0} cy={-4} r={11} fill="#EDEDED" stroke="rgba(0,0,0,0.2)" strokeWidth={0.6} opacity={0.9} />
      {on && (
        <>
          <circle cx={0} cy={-4} r={11} fill={hue} opacity={litAlpha(lit)} />
          <circle cx={0} cy={-4} r={5.5} fill={`url(#${HOT_GLOW})`} opacity={0.8 * hot} />
        </>
      )}
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
    { name: 'common', type: 'breadboard_male', x: -5, y: 28, dir: [0, 1] },
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
  // The channel values are intensities, not paint. Used as a fill directly a
  // dim mix is nearly black, so turning the part on at 2 % dropped the lens
  // from near-white to dark grey — brighter reading as darker. The hue is
  // normalised and the intensity carried by alpha, the way light composites.
  const hue = emissionHue(r, g, b);
  const on = lit > 0.004;
  const hot = bloom(lit);
  const haloR = 14 + 22 * lit;
  return (
    <g>
      {/* Anode is the long leg (second from the left on a CA part). */}
      <Leg x1={-15} y1={4} x2={-15} y2={18} />
      {/* 28, a whole pitch below the others, so all four legs reach holes. */}
      <Leg x1={-5} y1={4} x2={-5} y2={28} />
      <Leg x1={5} y1={4} x2={5} y2={18} />
      <Leg x1={15} y1={4} x2={15} y2={18} />
      {on && (
        <>
          <circle cx={0} cy={-4} r={haloR} fill={hue} opacity={0.10 * haloAlpha(lit)} />
          <circle cx={0} cy={-4} r={haloR * 0.72} fill={hue} opacity={0.16 * haloAlpha(lit)} />
          <circle cx={0} cy={-4} r={haloR * 0.46} fill={hue} opacity={0.22 * haloAlpha(lit)} />
        </>
      )}
      <path d="M-12,2 L12,2 L12,5 L-12,5 Z" fill="#E4E4E4" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      <circle cx={0} cy={-4} r={11} fill="#EDEDED" stroke="rgba(0,0,0,0.2)" strokeWidth={0.6} opacity={0.9} />
      {on && (
        <>
          <circle cx={0} cy={-4} r={11} fill={hue} opacity={litAlpha(lit)} />
          <circle cx={0} cy={-4} r={5.5} fill={`url(#${HOT_GLOW})`} opacity={0.8 * hot} />
        </>
      )}
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
    { name: 'anode', type: 'breadboard_male', x: -5, y: 28, dir: [0, 1], role: 'power' },
    { name: 'G', type: 'breadboard_male', x: 5, y: 18, dir: [0, 1] },
    { name: 'B', type: 'breadboard_male', x: 15, y: 18, dir: [0, 1] },
  ],
  props: [],
  defaults: { commonAnode: true },
  Art: RgbLedCaArt,
});

export const LEDS: PartDef<never>[] = [Led, LedLarge, RgbLed, RgbLedCa] as unknown as PartDef<never>[];
