import { localToWorld, rotate, type Vec2 } from '@/lib/geometry';
import { getPartDef } from '@/parts/registry';
import { terminalsOf } from '@/parts/types';
import { PITCH, SNAP, snap } from '@/lib/units';
import type { Design, PartInstance } from '@/state/design';
import { worldTerminals } from './terminals';

/** How close a leg must be to a hole before it drops in, in world units. */
const SOCKET_RADIUS = PITCH * 0.62;

/**
 * How far a leg may sit from a hole and still count as plugged into it.
 *
 * snapPlacement drops a leg exactly onto a hole, but parts placed by a starter
 * or carried through a rotation can end up a fraction of a unit out, so the
 * test has to be a tolerance. Every caller shares it: deciding which parts a
 * breadboard carries when it is dragged has to agree with deciding which legs
 * are electrically in a row, or a component lights up in the circuit yet gets
 * left behind when the board moves.
 */
const SOCKET_FIT_TOL = 1.5;

const fitsSocket = (a: Vec2, b: Vec2) =>
  Math.abs(a.x - b.x) < SOCKET_FIT_TOL && Math.abs(a.y - b.y) < SOCKET_FIT_TOL;

export interface SnapResult {
  x: number;
  y: number;
  /** True when the part locked into a breadboard/header socket. */
  socketed: boolean;
}

/**
 * Position a part being dragged.
 *
 * Free parts land on the 5-unit grid. Socketable parts additionally look for a
 * female terminal under any of their legs and, if one is close enough, shift so
 * that leg sits exactly in the hole — which is what makes components click into
 * a breadboard the way they do in the product.
 */
export function snapPlacement(
  design: Design,
  inst: PartInstance,
  proposed: Vec2,
  ignoreIds: Set<string> = new Set(),
  prebuiltSockets?: Vec2[],
): SnapResult {
  const def = getPartDef(inst.type);
  const gridded = { x: snap(proposed.x, SNAP), y: snap(proposed.y, SNAP) };
  if (!def?.socketable) return { ...gridded, socketed: false };

  const sockets =
    prebuiltSockets ??
    collectSockets(design, ignoreIds.size ? ignoreIds : new Set([inst.id]));
  if (sockets.length === 0) return { ...gridded, socketed: false };

  const legs = terminalsOf(def, inst.props as never).filter(
    (t) => t.type === 'breadboard_male',
  );
  if (legs.length === 0) return { ...gridded, socketed: false };

  let best: { dx: number; dy: number; d: number } | null = null;

  for (const leg of legs) {
    // Where this leg would land at the proposed (unsnapped) position.
    const legWorld = localToWorld(
      { x: leg.x, y: leg.y },
      proposed,
      inst.rotation,
      inst.mirrored,
    );
    for (const s of sockets) {
      const dx = s.x - legWorld.x;
      const dy = s.y - legWorld.y;
      const d = Math.hypot(dx, dy);
      if (d <= SOCKET_RADIUS && (!best || d < best.d)) best = { dx, dy, d };
    }
  }

  if (!best) return { ...gridded, socketed: false };
  return {
    x: round(proposed.x + best.dx),
    y: round(proposed.y + best.dy),
    socketed: true,
  };
}

/**
 * All female terminals in the design, as bare world points.
 *
 * A full breadboard carries 830 of them, and a drag frame needs the same list
 * for both the snap and the target-hole preview — so callers on the drag path
 * build it once and hand it to both rather than paying for it twice.
 */
export function collectSockets(design: Design, exclude: Set<string>): Vec2[] {
  const out: Vec2[] = [];
  for (const id in design.parts) {
    if (exclude.has(id)) continue;
    const inst = design.parts[id];
    const def = getPartDef(inst.type);
    if (!def) continue;
    // Goes through worldTerminals rather than placing the points here, so a
    // board that has not moved this frame is served from its cache.
    for (const t of worldTerminals(inst)) {
      if (t.def.type !== 'breadboard_female') continue;
      out.push(t.pos);
    }
  }
  return out;
}

/**
 * Which socket each of a part's legs is sitting in. Used by the netlist builder
 * to short a leg to the breadboard row it occupies.
 */
export function socketedConnections(
  design: Design,
  inst: PartInstance,
): { leg: string; partId: string; terminal: string }[] {
  const def = getPartDef(inst.type);
  if (!def?.socketable) return [];
  const out: { leg: string; partId: string; terminal: string }[] = [];

  const legs = worldTerminals(inst).filter((t) => t.def.type === 'breadboard_male');
  if (legs.length === 0) return out;

  for (const otherId in design.parts) {
    if (otherId === inst.id) continue;
    const other = design.parts[otherId];
    const odef = getPartDef(other.type);
    if (!odef) continue;
    const holes = worldTerminals(other).filter(
      (t) => t.def.type === 'breadboard_female',
    );
    if (holes.length === 0) continue;
    for (const leg of legs) {
      for (const hole of holes) {
        if (fitsSocket(hole.pos, leg.pos)) {
          out.push({ leg: leg.def.name, partId: otherId, terminal: hole.def.name });
        }
      }
    }
  }
  return out;
}

/**
 * Which socketable parts have a leg currently sitting in one of the given
 * hosts' holes. This is the reverse of {@link socketedConnections} and is
 * what lets a breadboard drag its passengers along: at drag start we snapshot
 * which parts are riding each host, then move them by the same delta.
 */
export function partsRidingHosts(design: Design, hostIds: Set<string>): Set<string> {
  const out = new Set<string>();
  // Holes bucketed by a coarse grid, so a leg only tests the handful of holes
  // that could possibly be within tolerance instead of all 300 on a board.
  const holes = new Map<string, Vec2[]>();

  for (const id of hostIds) {
    const inst = design.parts[id];
    const def = inst && getPartDef(inst.type);
    if (!def) continue;
    for (const t of terminalsOf(def, inst.props as never)) {
      if (t.type !== 'breadboard_female') continue;
      const p = localToWorld({ x: t.x, y: t.y }, { x: inst.x, y: inst.y }, inst.rotation, inst.mirrored);
      const key = bucketKey(p.x, p.y);
      const bucket = holes.get(key);
      if (bucket) bucket.push(p);
      else holes.set(key, [p]);
    }
  }
  if (holes.size === 0) return out;

  for (const partId in design.parts) {
    if (hostIds.has(partId)) continue;
    const inst = design.parts[partId];
    const def = getPartDef(inst.type);
    if (!def?.socketable) continue;
    for (const t of terminalsOf(def, inst.props as never)) {
      if (t.type !== 'breadboard_male') continue;
      const p = localToWorld({ x: t.x, y: t.y }, { x: inst.x, y: inst.y }, inst.rotation, inst.mirrored);
      if (anyHoleNear(holes, p)) {
        out.add(partId);
        break;
      }
    }
  }
  return out;
}

/**
 * For a part being dragged, return the world positions of every host hole
 * where one of its legs would drop in at the current position. Used to draw
 * the target-hole highlight so the snap is visible before release.
 */
export function targetHoles(
  design: Design,
  inst: PartInstance,
  proposed: Vec2,
  ignoreIds: Set<string>,
  prebuiltSockets?: Vec2[],
): Vec2[] {
  const def = getPartDef(inst.type);
  if (!def?.socketable) return [];
  const sockets = prebuiltSockets ?? collectSockets(design, ignoreIds);
  if (sockets.length === 0) return [];
  const legs = terminalsOf(def, inst.props as never).filter((t) => t.type === 'breadboard_male');
  const out: Vec2[] = [];
  for (const leg of legs) {
    const legWorld = localToWorld({ x: leg.x, y: leg.y }, proposed, inst.rotation, inst.mirrored);
    let best: { s: Vec2; d: number } | null = null;
    for (const s of sockets) {
      const d = Math.hypot(s.x - legWorld.x, s.y - legWorld.y);
      if (d <= SOCKET_RADIUS && (!best || d < best.d)) best = { s, d };
    }
    if (best) out.push(best.s);
  }
  return out;
}

/**
 * Bucket edge for the hole index. Anything at least twice the fit tolerance
 * works, because then a matching hole can only ever be one bucket away.
 */
const BUCKET = 4;

const bucketKey = (x: number, y: number) =>
  `${Math.floor(x / BUCKET)}|${Math.floor(y / BUCKET)}`;

function anyHoleNear(holes: Map<string, Vec2[]>, p: Vec2): boolean {
  const bx = Math.floor(p.x / BUCKET);
  const by = Math.floor(p.y / BUCKET);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const bucket = holes.get(`${bx + dx}|${by + dy}`);
      if (!bucket) continue;
      for (const hole of bucket) if (fitsSocket(hole, p)) return true;
    }
  }
  return false;
}

/** Rotation step for a part: 90° once it can socket, 30° otherwise. */
export function rotationStepFor(inst: PartInstance): number {
  const def = getPartDef(inst.type);
  return def?.rotationStep ?? (def?.socketable ? 90 : 30);
}

export function rotatePoint(p: Vec2, deg: number): Vec2 {
  return rotate(p, deg);
}

const round = (n: number) => Math.round(n * 1000) / 1000;
