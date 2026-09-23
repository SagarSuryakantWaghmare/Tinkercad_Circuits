import type { ComponentType } from 'react';
import type { Vec2 } from '@/lib/geometry';

// ─────────────────────────────────────────────────────────────────────────────
// Categories — the eleven the product ships, in its own order.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  { id: 'general', label: 'General' },
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'power', label: 'Power' },
  { id: 'breadboards', label: 'Breadboards' },
  { id: 'microcontrollers', label: 'Microcontrollers' },
  { id: 'instruments', label: 'Instruments' },
  { id: 'ics', label: 'Integrated Circuits' },
  { id: 'powercontrol', label: 'Power Control' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'logic', label: 'Logic' },
  { id: 'networking', label: 'Networking' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

// ─────────────────────────────────────────────────────────────────────────────
// Terminals
//
// Mirrors the descriptor model observed in the live product, where every
// terminal carries a name, a type, an optional internal-short group, and a
// direction line giving the vector a wire leaves along.
// ─────────────────────────────────────────────────────────────────────────────

export type TerminalType =
  /** A component leg that plugs into a breadboard hole. */
  | 'breadboard_male'
  /** A socket that accepts a leg (breadboard holes, female headers). */
  | 'breadboard_female'
  /** Wire-only tie point — no mechanical socketing. */
  | 'wire'
  /** An instrument probe lead. */
  | 'probe';

export type TerminalRole =
  | 'power'
  | 'gnd'
  | 'analog'
  | 'digital'
  | 'pwm'
  | 'passive';

export interface TerminalDef {
  /** Unique within the part. Shown on hover. e.g. "D13", "ae1", "anode". */
  name: string;
  type: TerminalType;
  /** Local coordinates, world units. */
  x: number;
  y: number;
  /** Unit vector a wire runs along when leaving this terminal. */
  dir: [number, number];
  /**
   * Terminals of one instance sharing a group are internally shorted. This is
   * what makes breadboard rails and rows work with no special-casing, and how
   * an IC declares internally-tied pins.
   */
  group?: string;
  role?: TerminalRole;
  /** Hidden from the terminal overlay (e.g. a breadboard's 400 holes at low zoom). */
  quiet?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inspector property schema — declarative, so one generic Inspector renders
// every part and no part ships bespoke UI.
// ─────────────────────────────────────────────────────────────────────────────

export type PropValue = string | number | boolean;

interface PropBase {
  key: string;
  label: string;
  /** Only show this field when the predicate passes. */
  when?: (props: Record<string, PropValue>) => boolean;
  help?: string;
}

export type PropSchema =
  | (PropBase & {
      kind: 'number';
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
    })
  | (PropBase & {
      /** A magnitude + SI-prefix pair, as the product shows for R, C, L. */
      kind: 'unit';
      unit: string;
      prefixes: string[];
      min?: number;
      max?: number;
    })
  | (PropBase & {
      kind: 'select';
      options: { value: string; label: string }[];
    })
  | (PropBase & { kind: 'color'; options: { value: string; label: string }[] })
  | (PropBase & { kind: 'toggle' })
  | (PropBase & { kind: 'text'; placeholder?: string })
  | (PropBase & {
      kind: 'slider';
      min: number;
      max: number;
      step?: number;
      unit?: string;
    });

// ─────────────────────────────────────────────────────────────────────────────
// Part art
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-instance simulation output handed to a part's art so it can render live
 * state declaratively (LED glow, servo angle, LCD text) with no imperative DOM.
 */
export interface DeviceOut {
  [k: string]: number | string | boolean | number[] | string[] | undefined;
}

export interface ArtProps<P = Record<string, PropValue>> {
  props: P;
  /** This instance's slice of the current simulation snapshot; null when idle. */
  state: DeviceOut | null;
  selected: boolean;
  simulating: boolean;
  /** Called by interactive art (buttons, pot knobs, target coordinates) during simulation. */
  interact?: (event: string, value?: number | boolean | Record<string, unknown>) => void;
  /**
   * Change one of this instance's properties from its own art. Some controls
   * belong on the part rather than in the inspector — a meter's range buttons,
   * a bench supply's knobs — and those settings have to persist, so they write
   * the document rather than transient simulation state.
   */
  setProp?: (key: string, value: PropValue) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// PartDef
// ─────────────────────────────────────────────────────────────────────────────

export interface PartDef<P extends Record<string, PropValue> = Record<string, PropValue>> {
  id: string;
  name: string;
  category: CategoryId;
  /**
   * Additional sections this part should appear in. Tinkercad files each
   * 74xx chip under Logic; our library keeps a physical-chip copy in the
   * IC section too. Listing altCategories lets one PartDef show up in every
   * relevant section without duplicating the entry.
   */
  altCategories?: CategoryId[];
  /** Extra search terms beyond the name. */
  keywords?: string[];
  /** Appears in the default "Basic" view of the components panel. */
  basic?: boolean;

  /** Bounding size in world units, used for the hit area and marquee. */
  size: { w: number; h: number };
  /** Rotation centre in local coordinates. */
  origin: Vec2;

  /** Static list, or a function of props for parts whose pin count varies. */
  terminals: TerminalDef[] | ((props: P) => TerminalDef[]);

  props?: PropSchema[];
  defaults: P;

  Art: ComponentType<ArtProps<P>>;
  /** Panel thumbnail; falls back to Art scaled to fit. */
  Thumb?: ComponentType;

  /** Legs snap into breadboard holes. */
  socketable?: boolean;
  /** Free parts rotate in 30° steps like the product; socketed ones in 90°. */
  rotationStep?: 30 | 90;
  /** Sits under everything else (breadboards, boards). */
  substrate?: boolean;

  /** Identifier used to look up the electrical model in sim/devices. */
  model?: string;

  /**
   * Short human-readable summary shown in the inspector, one or two lines.
   * Every part can carry one; the microcontrollers use theirs to give a
   * gentle intro before students touch code.
   */
  summary?: string;

  /**
   * Structured "learn" copy shown under the inspector. Each section becomes
   * a labelled block; sections stay concise so the whole thing is glanceable
   * from the side rail rather than a modal.
   */
  learn?: {
    /** Section heading, e.g. "Pins", "Getting started". */
    title: string;
    /** Body text. Line breaks are preserved. */
    body: string;
  }[];
}

export function terminalsOf<P extends Record<string, PropValue>>(
  def: PartDef<P>,
  props: P,
): TerminalDef[] {
  return typeof def.terminals === 'function' ? def.terminals(props) : def.terminals;
}
