import { describe, expect, it } from 'vitest';

import '@/parts';
import { allParts } from '@/parts/registry';
import { terminalsOf } from '@/parts/types';
import { PITCH } from '@/lib/units';

/**
 * Every hole on a breadboard sits on a PITCH lattice. snapPlacement seats one
 * leg of a part exactly in a hole, so the rest make contact only where their
 * offsets from that leg are whole multiples of PITCH on both axes.
 *
 * A part that fails this looks plugged in and is not: the circuit is dead,
 * with nothing on screen to say why. led-10mm, whose legs are PITCH apart on
 * both axes, is the shape the rest should match.
 */

/**
 * Parts known not to fit yet. Each one is a real defect — plugging it into a
 * board silently half-connects it — kept here so the rule can be enforced for
 * everything else while they are fixed one at a time. Shrink this list; never
 * add to it.
 */
const KNOWN_UNFITTED = new Set([
  'slide-switch-mini', // legs on an 8 pitch
  'rocker-switch', // terminals 28 apart
  'pushbutton-30mm', // 68 x 72 between corners
  'seven-segment-4', // rows 96 apart; every board row gap is a multiple of 10
  'seven-segment-clock',
]);

const offLattice = (v: number) => {
  const m = Math.abs(v % PITCH);
  return Math.min(m, PITCH - m) > 1e-6;
};

describe('socketable parts fit the breadboard lattice', () => {
  for (const def of allParts()) {
    if (!def.socketable) continue;
    const legs = terminalsOf(def, {} as never).filter((t) => t.type === 'breadboard_male');
    if (legs.length < 2) continue;

    const known = KNOWN_UNFITTED.has(def.id);
    it(`${def.id} seats every leg in a hole${known ? ' (known bad)' : ''}`, () => {
      const [first, ...rest] = legs;
      const strays = rest
        .filter((t) => offLattice(t.x - first.x) || offLattice(t.y - first.y))
        .map((t) => `${t.name} sits (${t.x - first.x},${t.y - first.y}) from ${first.name}`);

      if (known) {
        // Pinned so the list cannot rot: fixing a part fails here until it is
        // taken off KNOWN_UNFITTED.
        expect(strays.length).toBeGreaterThan(0);
        return;
      }
      expect(strays).toEqual([]);
    });
  }
});
