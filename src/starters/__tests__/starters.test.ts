import { describe, expect, it } from 'vitest';

import '@/parts';
import { getPartDef } from '@/parts/registry';
import { terminalsOf } from '@/parts/types';
import { STARTERS } from '../index';

/**
 * A starter is built from aliases and terminal names written by hand. Nothing
 * at runtime complains when one is wrong: the builder drops an unknown part
 * silently, and a wire naming a terminal the part does not have is unioned
 * into a net that the final pass then discards — so the circuit loads, looks
 * right, and is simply dead. Across 84 starters and several hundred wire
 * endpoints, nobody can check that by eye.
 */
describe('starter circuits', () => {
  const built = STARTERS.map((s) => ({ starter: s, content: s.build() }));

  it('gives every starter a unique id', () => {
    const ids = STARTERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds every starter with parts and wires', () => {
    const empty = built
      .filter(({ content }) => content.parts.length === 0)
      .map(({ starter }) => starter.id);
    expect(empty).toEqual([]);
  });

  it('only places parts that exist in the catalogue', () => {
    const unknown: string[] = [];
    for (const { starter, content } of built) {
      for (const p of content.parts) {
        if (!getPartDef(p.type)) unknown.push(`${starter.id}: ${p.type}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('wires only terminals that the part actually has', () => {
    const bad: string[] = [];
    for (const { starter, content } of built) {
      const byId = new Map(content.parts.map((p) => [p.id, p]));
      const namesOf = (partId: string) => {
        const inst = byId.get(partId);
        const def = inst && getPartDef(inst.type);
        if (!inst || !def) return null;
        return new Set(terminalsOf(def, inst.props as never).map((t) => t.name));
      };
      for (const w of content.wires) {
        for (const end of [w.a, w.b]) {
          if (end.kind !== 'terminal') continue;
          const names = namesOf(end.partId);
          if (!names) {
            bad.push(`${starter.id}: wire to missing part ${end.partId}`);
          } else if (!names.has(end.terminal)) {
            const inst = byId.get(end.partId)!;
            bad.push(`${starter.id}: ${inst.type} has no terminal "${end.terminal}"`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
