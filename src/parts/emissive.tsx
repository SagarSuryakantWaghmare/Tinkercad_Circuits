import { LED_COLORS } from '@/lib/tokens';

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/**
 * Shared lighting response for every part that emits.
 *
 * The catalogue used to write its own `0.45 + 0.55 * v` by hand at each lit
 * part, with no two agreeing. Worse, those floors spent most of the visible
 * range on the first sliver of brightness: an LED's core went 55 % of its way
 * from unlit to fully lit the instant any current at all flowed, so a dim LED
 * could not read as dim and a bright one could not read as bright.
 *
 * The brightness handed in is already perceptual — the device models take a
 * square root of the current ratio, which is within about a tenth of the
 * sRGB gamma — so these curves shape presentation only.
 */

/** Alpha of the halo thrown onto the board. Starts at nothing, so off is off. */
export const haloAlpha = (e: number) => 0.9 * Math.pow(clamp01(e), 1.5);

/** Alpha of the emitting surface itself, over its own unlit colour. */
export const litAlpha = (e: number) => 0.25 + 0.6 * clamp01(e);

/** How blown out the centre is. Nothing until the top half of the range. */
export const bloom = (e: number) => Math.pow(Math.max(0, (clamp01(e) - 0.55) / 0.45), 1.5);

/**
 * The colour an emitter of this mix would appear, independent of how hard it
 * is driven. Channel values are intensities, not paint: used directly as a
 * fill they make a dim emitter *darker* than an unlit one, since `rgb(5,0,0)`
 * is nearly black. Normalising to full scale keeps the hue and lets alpha
 * carry the intensity, which is how light actually composites.
 */
export function emissionHue(r: number, g: number, b: number): string {
  const lit = Math.max(r, g, b);
  if (!(lit > 0)) return '#FFFFFF';
  const up = (v: number) => Math.round(clamp01(v / lit) * 255);
  return `rgb(${up(r)},${up(g)},${up(b)})`;
}

export const glowId = (colour: string) => `cl-glow-${colour in LED_COLORS ? colour : 'red'}`;
export const HOT_GLOW = 'cl-glow-hot';

/**
 * The glow ramps, defined once per scene.
 *
 * These live inside the scene group rather than a top-level `<defs>` because
 * the SVG and PNG exporters clone only that group — anything outside it is
 * dropped and every `url(#…)` reference in the export would resolve to
 * nothing. Gradients are used rather than filters or masks deliberately: a
 * gradient is one cached ramp painted as an ordinary fill, while each filter
 * or mask costs an offscreen buffer per element, which a NeoPixel ring of 24
 * would multiply out of hand.
 */
export function GlowDefs() {
  return (
    <defs>
      {Object.entries(LED_COLORS).map(([name, c]) => (
        <radialGradient key={name} id={glowId(name)}>
          <stop offset="0%" stopColor={c.glow} stopOpacity={1} />
          <stop offset="25%" stopColor={c.glow} stopOpacity={0.85} />
          <stop offset="45%" stopColor={c.glow} stopOpacity={0.45} />
          <stop offset="70%" stopColor={c.glow} stopOpacity={0.14} />
          <stop offset="100%" stopColor={c.glow} stopOpacity={0} />
        </radialGradient>
      ))}
      <radialGradient id={HOT_GLOW}>
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
        <stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.35} />
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
      </radialGradient>
    </defs>
  );
}
