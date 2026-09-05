/**
 * World-unit conventions.
 *
 * 1 world unit = 0.01 inch = 0.254 mm.
 * These values were measured from the live product's DOM, not invented — see
 * docs/PRD.md §2. Everything in the app (part art, terminals, wires, snapping)
 * is authored directly in these units; there are no per-part scale factors.
 */

/** Breadboard hole / header pin pitch. 0.1 inch. */
export const PITCH = 10;

/** Drag snap increment — half pitch, matching the product. */
export const SNAP = 5;

/** Radius of the rounded corner on a wire's right-angle bend. */
export const WIRE_CORNER_R = 10;

/** Painted width of a wire's coloured core stroke. */
export const WIRE_CORE_W = 2.5;

/** Painted width of the halo/shadow stroke drawn under every wire. */
export const WIRE_HALO_W = 5;

/** How far a wire runs straight out of a terminal before it may turn. */
export const TERMINAL_STUB = 25;

/** Radius of a terminal's invisible hit target. */
export const TERMINAL_HIT_R = 7;

export const ZOOM_MIN = 0.08;
export const ZOOM_MAX = 6;
export const ZOOM_DEFAULT = 1;

/** Below this zoom the dot grid and terminal dots stop drawing. */
export const GRID_VISIBLE_ZOOM = 0.45;

/** Above this many placed parts, decorative layers switch off. */
export const HEAVY_SCENE_PARTS = 300;

export const snap = (v: number, step: number = SNAP) => Math.round(v / step) * step;
export const snapPitch = (v: number) => Math.round(v / PITCH) * PITCH;
