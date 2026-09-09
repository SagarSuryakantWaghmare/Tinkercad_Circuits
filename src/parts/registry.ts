import type { CategoryId, PartDef, PropValue } from './types';

const registry = new Map<string, PartDef<never>>();

export function definePart<P extends Record<string, PropValue>>(def: PartDef<P>): PartDef<P> {
  // Re-registration is normal under HMR, so replace rather than throw. A real
  // id collision between two different modules shows up in the build check
  // below, where the module graph is evaluated exactly once.
  if (registry.has(def.id) && process.env.NODE_ENV === 'production') {
    throw new Error(`Duplicate part id: ${def.id}`);
  }
  registry.set(def.id, def as unknown as PartDef<never>);
  return def;
}

export function registerParts(defs: PartDef<never>[]) {
  for (const d of defs) if (!registry.has(d.id)) registry.set(d.id, d);
}

export function getPartDef(id: string): PartDef<never> | undefined {
  return registry.get(id);
}

export function allParts(): PartDef<never>[] {
  return [...registry.values()];
}

export function partsInCategory(cat: CategoryId): PartDef<never>[] {
  return allParts().filter((p) => p.category === cat);
}

/**
 * What a beginner sees before opening "All components", in the order shown.
 *
 * Kept as one list rather than a flag on each part because "is this a starting
 * component?" is a judgement about the whole palette, not about any single
 * part, and it was previously spread over a dozen files — which is how ours
 * ended up offering a 555 timer and a shift register but no motor, no servo
 * and one breadboard.
 *
 * Deliberately discrete parts and boards only: no timers, no logic, no shift
 * registers. Everything else is one dropdown away.
 */
export const BASIC_PART_IDS: readonly string[] = [
  'resistor',
  'led',
  'pushbutton',
  'potentiometer',
  'capacitor',
  'slideswitch',
  'battery-9v',
  'battery-coin',
  'battery-aa',
  'breadboard',
  'microbit',
  'uno-r3',
  'vibration-motor',
  'dc-motor',
  'micro-servo',
  'gearmotor',
  'npn-transistor',
  'led-rgb',
  'diode',
  'photoresistor',
  'soil-moisture',
  'ultrasonic-4pin',
  'pir-sensor',
  'piezo',
  'temperature-sensor',
  'multimeter',
];

export function basicParts(): PartDef<never>[] {
  const out: PartDef<never>[] = [];
  for (const id of BASIC_PART_IDS) {
    const def = registry.get(id);
    if (def) out.push(def);
  }
  return out;
}

/** Ids in BASIC_PART_IDS that no part actually defines. Empty is the goal. */
export function missingBasicParts(): string[] {
  return BASIC_PART_IDS.filter((id) => !registry.has(id));
}

/** Substring search over name + keywords + category, ranked by match position. */
export function searchParts(query: string, pool = allParts()): PartDef<never>[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  const scored: { p: PartDef<never>; s: number }[] = [];
  for (const p of pool) {
    const name = p.name.toLowerCase();
    let s = -1;
    if (name.startsWith(q)) s = 0;
    else if (name.includes(q)) s = 1;
    else if (p.keywords?.some((k) => k.toLowerCase().includes(q))) s = 2;
    else if (p.id.includes(q)) s = 3;
    if (s >= 0) scored.push({ p, s });
  }
  scored.sort((a, b) => a.s - b.s || a.p.name.localeCompare(b.p.name));
  return scored.map((x) => x.p);
}

/** Fresh props object for a new instance — never share the defaults reference. */
export function defaultProps(id: string): Record<string, PropValue> {
  const def = registry.get(id);
  return def ? { ...(def.defaults as Record<string, PropValue>) } : {};
}
