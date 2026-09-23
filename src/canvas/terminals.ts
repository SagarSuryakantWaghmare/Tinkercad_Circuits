import { localToWorld, rotate, type Vec2 } from '@/lib/geometry';
import { SOCKET_HIT_R } from '@/lib/units';
import { getPartDef } from '@/parts/registry';
import { terminalsOf, type TerminalDef } from '@/parts/types';
import type { Design, PartInstance } from '@/state/design';

export interface WorldTerminal {
  partId: string;
  def: TerminalDef;
  /** World position. */
  pos: Vec2;
  /** Terminal direction rotated into world space. */
  dir: [number, number];
}

/**
 * Placing a part's terminals in world space costs a rotate and a translate
 * each, and a full breadboard carries 830 of them. Every edit runs through
 * immer, which leaves untouched parts at their existing identity, so a part
 * that did not move can be keyed on directly: dragging a component across a
 * board now re-places only the component's own legs per frame instead of
 * every hole on the board as well.
 */
const worldCache = new WeakMap<PartInstance, WorldTerminal[]>();

/** All terminals of one placed part, in world space. */
export function worldTerminals(inst: PartInstance): WorldTerminal[] {
  const cached = worldCache.get(inst);
  if (cached) return cached;
  const def = getPartDef(inst.type);
  if (!def) return [];
  const list = terminalsOf(def, inst.props as never);
  const placed = list.map((t) => {
    const pos = localToWorld(
      { x: t.x, y: t.y },
      { x: inst.x, y: inst.y },
      inst.rotation,
      inst.mirrored,
    );
    const dv = inst.mirrored ? { x: -t.dir[0], y: t.dir[1] } : { x: t.dir[0], y: t.dir[1] };
    const r = rotate(dv, inst.rotation);
    return {
      partId: inst.id,
      def: t,
      pos,
      dir: [round(r.x), round(r.y)] as [number, number],
    };
  });
  worldCache.set(inst, placed);
  return placed;
}

/** One named terminal of a placed part, in world space. */
export function worldTerminal(
  inst: PartInstance,
  name: string,
): WorldTerminal | undefined {
  return worldTerminals(inst).find((t) => t.def.name === name);
}

/**
 * Index every terminal in the design by `${partId}:${terminal}`.
 * Callers memoise this on the design revision.
 */
export function indexTerminals(design: Design): Map<string, WorldTerminal> {
  const map = new Map<string, WorldTerminal>();
  for (const id in design.parts) {
    for (const t of worldTerminals(design.parts[id])) {
      map.set(`${id}:${t.def.name}`, t);
    }
  }
  return map;
}

export const terminalKey = (partId: string, terminal: string) =>
  `${partId}:${terminal}`;

export interface PickTerminalOptions {
  /** Skip this terminal — the end a wire is already being drawn from. */
  exclude?: { partId: string; terminal: string };
  /**
   * Restrict the search to one part. Pass the part under the cursor so a
   * press on its body can never start a wire from a neighbour, or from the
   * board it is plugged into.
   */
  only?: string;
}

/**
 * How much further from the cursor a board hole is allowed to be, in world
 * units, before a component pin is preferred to it.
 *
 * A leg seated in a hole sits exactly on top of it, and there the leg is what
 * the user means — so holes need to lose that tie. But the bias has to stay
 * small: a hole being pointed at directly must still beat a leg a whole pitch
 * away in the next column, because that column is a different net and wiring
 * to it instead would be silently wrong.
 */
const SUBSTRATE_BIAS = 2;

/**
 * Nearest connectable terminal to a world point, or null.
 *
 * Two rules keep this predictable on a crowded board. Sockets are matched
 * against the tighter {@link SOCKET_HIT_R} so neighbouring holes cannot both
 * claim the same point, and board holes carry {@link SUBSTRATE_BIAS} so a leg
 * sitting in one wins the tie without letting a distant leg win outright.
 */
export function pickTerminal(
  design: Design,
  at: Vec2,
  radius: number,
  options: PickTerminalOptions = {},
): WorldTerminal | null {
  const { exclude, only } = options;
  let best: WorldTerminal | null = null;
  let bestScore = Infinity;

  for (const id in design.parts) {
    if (only !== undefined && id !== only) continue;
    const inst = design.parts[id];
    const def = getPartDef(inst.type);
    if (!def) continue;
    const bias = def.substrate ? SUBSTRATE_BIAS : 0;
    for (const t of worldTerminals(inst)) {
      if (exclude && exclude.partId === id && exclude.terminal === t.def.name) continue;
      const limit =
        t.def.type === 'breadboard_female' ? Math.min(radius, SOCKET_HIT_R) : radius;
      const d = Math.hypot(t.pos.x - at.x, t.pos.y - at.y);
      if (d > limit) continue;
      const score = d + bias;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
  }
  return best;
}

const round = (n: number) => (Math.abs(n) < 1e-9 ? 0 : Math.round(n * 1e6) / 1e6);
