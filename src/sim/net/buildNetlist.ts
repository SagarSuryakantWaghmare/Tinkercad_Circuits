import { getPartDef } from '@/parts/registry';
import { terminalsOf } from '@/parts/types';
import type { Design } from '@/state/design';
import { worldTerminals } from '@/canvas/terminals';
import { PITCH } from '@/lib/units';

/** Union-Find over terminal keys. */
class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p !== x) {
      p = this.find(p);
      this.parent.set(x, p);
    }
    return p;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export interface Netlist {
  /** Net index for each `${partId}:${terminal}` key. −1 is ground. */
  terminalNet: Map<string, number>;
  /** Number of non-ground nets. */
  netCount: number;
  /** Terminal keys per net index, for debugging and probe readouts. */
  members: string[][];
  /** Part instances that carry an electrical model, in stamp order. */
  devices: { partId: string; model: string }[];
  groundKey: string | null;
}

const key = (partId: string, terminal: string) => `${partId}:${terminal}`;

/**
 * Turn a placed design into a netlist.
 *
 * Terminals are joined by three mechanisms: a part's own internal groups
 * (breadboard rows and rails, tied IC pins), explicit wires, and geometric
 * socketing — a component leg sitting in a breadboard hole. Nets that end up
 * with no device attached are dropped so an empty breadboard costs nothing.
 */
export function buildNetlist(design: Design): Netlist {
  const uf = new UnionFind();
  const deviceTerminals = new Set<string>();
  const devices: { partId: string; model: string }[] = [];

  // Pass 1 — register terminals and internal groups.
  const groupRep = new Map<string, string>(); // `${partId}#${group}` → first key
  for (const partId in design.parts) {
    const inst = design.parts[partId];
    const def = getPartDef(inst.type);
    if (!def) continue;
    if (def.model) {
      devices.push({ partId, model: def.model });
    }
    for (const t of terminalsOf(def, inst.props as never)) {
      const k = key(partId, t.name);
      uf.find(k);
      if (def.model) deviceTerminals.add(k);
      if (t.group) {
        const g = `${partId}#${t.group}`;
        const rep = groupRep.get(g);
        if (rep === undefined) groupRep.set(g, k);
        else uf.union(rep, k);
      }
    }
  }

  // Pass 2 — wires.
  for (const wid in design.wires) {
    const w = design.wires[wid];
    if (w.a.kind !== 'terminal' || w.b.kind !== 'terminal') continue;
    const ka = key(w.a.partId, w.a.terminal);
    const kb = key(w.b.partId, w.b.terminal);
    uf.union(ka, kb);
  }

  // Pass 3 — socketing. A leg is connected to the hole it physically occupies.
  const holes = new Map<string, string>(); // "x,y" → terminal key
  for (const partId in design.parts) {
    const inst = design.parts[partId];
    const def = getPartDef(inst.type);
    if (!def) continue;
    for (const t of worldTerminals(inst)) {
      if (t.def.type !== 'breadboard_female') continue;
      holes.set(cellKey(t.pos.x, t.pos.y), key(partId, t.def.name));
    }
  }
  for (const partId in design.parts) {
    const inst = design.parts[partId];
    const def = getPartDef(inst.type);
    if (!def?.socketable) continue;
    for (const t of worldTerminals(inst)) {
      if (t.def.type !== 'breadboard_male') continue;
      const hole = holes.get(cellKey(t.pos.x, t.pos.y));
      if (hole) uf.union(key(partId, t.def.name), hole);
    }
  }

  // Pick ground: an explicit GND-role terminal on a device, else the net with
  // the most device terminals, so a battery-only circuit still has a reference.
  let groundKey: string | null = null;
  outer: for (const partId in design.parts) {
    const inst = design.parts[partId];
    const def = getPartDef(inst.type);
    if (!def?.model) continue;
    for (const t of terminalsOf(def, inst.props as never)) {
      if (t.role === 'gnd') {
        groundKey = key(partId, t.name);
        break outer;
      }
    }
  }

  const groundRoot = groundKey ? uf.find(groundKey) : null;

  // Assign indices, keeping only nets that a device actually touches.
  const rootToNet = new Map<string, number>();
  const members: string[][] = [];
  const terminalNet = new Map<string, number>();

  const liveRoots = new Set<string>();
  for (const k of deviceTerminals) liveRoots.add(uf.find(k));

  for (const partId in design.parts) {
    const inst = design.parts[partId];
    const def = getPartDef(inst.type);
    if (!def) continue;
    for (const t of terminalsOf(def, inst.props as never)) {
      const k = key(partId, t.name);
      const root = uf.find(k);
      if (!liveRoots.has(root)) continue;
      if (root === groundRoot) {
        terminalNet.set(k, -1);
        continue;
      }
      let idx = rootToNet.get(root);
      if (idx === undefined) {
        idx = members.length;
        rootToNet.set(root, idx);
        members.push([]);
      }
      terminalNet.set(k, idx);
      members[idx].push(k);
    }
  }

  return {
    terminalNet,
    netCount: members.length,
    members,
    devices,
    groundKey,
  };
}

/** Quantise a world point to the hole lattice so tiny float drift still matches. */
function cellKey(x: number, y: number) {
  return `${Math.round(x / (PITCH / 10))},${Math.round(y / (PITCH / 10))}`;
}
