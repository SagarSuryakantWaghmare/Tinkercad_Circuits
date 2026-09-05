import { localToWorld, rotate, type Vec2 } from '@/lib/geometry';
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

/** All terminals of one placed part, in world space. */
export function worldTerminals(inst: PartInstance): WorldTerminal[] {
  const def = getPartDef(inst.type);
  if (!def) return [];
  const list = terminalsOf(def, inst.props as never);
  return list.map((t) => {
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

/**
 * Nearest connectable terminal to a world point, within `radius`.
 * Substrate parts (breadboards) lose ties so a leg sitting in a hole still
 * prefers the leg when both are under the cursor.
 */
export function pickTerminal(
  design: Design,
  at: Vec2,
  radius: number,
  exclude?: { partId: string; terminal: string },
): WorldTerminal | null {
  let best: WorldTerminal | null = null;
  let bestScore = Infinity;

  for (const id in design.parts) {
    const inst = design.parts[id];
    const def = getPartDef(inst.type);
    if (!def) continue;
    for (const t of worldTerminals(inst)) {
      if (exclude && exclude.partId === id && exclude.terminal === t.def.name) continue;
      const d = Math.hypot(t.pos.x - at.x, t.pos.y - at.y);
      if (d > radius) continue;
      const score = d + (def.substrate ? 2 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
  }
  return best;
}

const round = (n: number) => (Math.abs(n) < 1e-9 ? 0 : Math.round(n * 1e6) / 1e6);
