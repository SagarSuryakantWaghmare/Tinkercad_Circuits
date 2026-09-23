import { produce } from 'immer';
import { describe, expect, it } from 'vitest';

import { pickTerminal, worldTerminals } from '../terminals';
import { PITCH, SOCKET_HIT_R, TERMINAL_HIT_R } from '@/lib/units';
import '@/parts'; // registers the real catalogue
import type { Design, PartInstance } from '@/state/design';

/** The radius the canvas actually passes when hit-testing a press. */
const R = TERMINAL_HIT_R * 1.6;

const part = (id: string, type: string, x: number, y: number): PartInstance =>
  ({ id, type, x, y, rotation: 0, mirrored: false, props: {}, z: 0 }) as PartInstance;

/**
 * A real breadboard with a real resistor whose left leg is seated in one of
 * its holes, so the hole pitch and leg spacing under test are the ones the
 * app ships rather than numbers invented for the test. Positions are read
 * back off the parts instead of hard-coded, since the art moves around.
 */
function scene() {
  const board = part('board', 'breadboard-small', 0, 0);
  const hole = worldTerminals(board).find((t) => t.def.type === 'breadboard_female')!;

  // Seat the resistor's 'a' leg exactly in that hole.
  const probe = part('res', 'resistor', 0, 0);
  const legA = worldTerminals(probe).find((t) => t.def.name === 'a')!;
  const res = part('res', 'resistor', hole.pos.x - legA.pos.x, hole.pos.y - legA.pos.y);

  const design = {
    parts: { board, res },
    wires: {},
    notes: {},
  } as unknown as Design;
  return { design, hole: hole.pos };
}

describe('pickTerminal', () => {
  it('leaves board between the holes to grab, so a breadboard can be dragged', () => {
    // The centre of a cell is the furthest any point can be from a hole.
    // The hit radius used to exceed that distance, so every point on a board
    // counted as a terminal and the board could not be picked up at all.
    expect(Math.hypot(PITCH / 2, PITCH / 2)).toBeGreaterThan(SOCKET_HIT_R);

    const { design, hole } = scene();
    expect(pickTerminal(design, hole, R, { only: 'board' })).not.toBeNull();

    const gap = { x: hole.x + PITCH / 2, y: hole.y + PITCH / 2 };
    expect(pickTerminal(design, gap, R, { only: 'board' })).toBeNull();
  });

  it('still finds a hole pressed dead on', () => {
    const { design, hole } = scene();
    expect(pickTerminal(design, hole, R, { only: 'board' })?.def.type).toBe('breadboard_female');
  });

  it('never returns another part when the search is scoped to one', () => {
    const { design, hole } = scene();
    // A leg and a hole share this exact point, so only scoping can separate them.
    expect(pickTerminal(design, hole, R, { only: 'board' })?.partId).toBe('board');
    expect(pickTerminal(design, hole, R, { only: 'res' })?.partId).toBe('res');
  });

  it('prefers a component pin over the board hole it is plugged into', () => {
    const { design, hole } = scene();
    expect(pickTerminal(design, hole, R)?.partId).toBe('res');
  });

  it('does not reach past the hole under the cursor to a leg in the next column', () => {
    // Columns are separate nets. A leg seated one column over is PITCH away,
    // which is inside the generous radius a component pin gets, so preferring
    // pins unconditionally would wire to that component instead of to the
    // hole being pointed at — a different net, and a silently wrong circuit.
    const { design, hole } = scene();
    const board = design.parts.board;
    const neighbour = worldTerminals(board).find(
      (t) =>
        t.def.type === 'breadboard_female' &&
        t.def.group !== undefined &&
        Math.abs(t.pos.x - (hole.x + PITCH)) < 0.01 &&
        Math.abs(t.pos.y - hole.y) < 0.01,
    )!;
    expect(neighbour).toBeDefined();

    const seated = worldTerminals(design.parts.res).find((t) => t.def.name === 'a')!;
    expect(Math.hypot(seated.pos.x - hole.x, seated.pos.y - hole.y)).toBeLessThan(0.01);
    expect(Math.hypot(seated.pos.x - neighbour.pos.x, seated.pos.y - neighbour.pos.y)).toBe(PITCH);

    const hit = pickTerminal(design, neighbour.pos, R);
    expect(hit?.partId).toBe('board');
    expect(hit?.def.group).toBe(neighbour.def.group);
  });

  it('excludes the terminal a wire is already being drawn from', () => {
    const { design, hole } = scene();
    const first = pickTerminal(design, hole, R, { only: 'res' })!;
    const again = pickTerminal(design, hole, R, {
      only: 'res',
      exclude: { partId: 'res', terminal: first.def.name },
    });
    expect(again?.def.name).not.toBe(first.def.name);
  });

  it('gives a free-standing pin a more generous radius than a socket', () => {
    const { design, hole } = scene();
    const off = SOCKET_HIT_R + 2;

    // A pin stays reachable past the socket radius...
    const leg = pickTerminal(design, hole, R, { only: 'res' })!;
    expect(
      pickTerminal(design, { x: leg.pos.x, y: leg.pos.y + off }, R, { only: 'res' })?.def.name,
    ).toBe(leg.def.name);

    // ...while a hole the same distance off is already out of range, which is
    // what stops neighbouring holes from claiming the same point.
    expect(
      pickTerminal(design, { x: hole.x, y: hole.y + off }, R, { only: 'board' }),
    ).toBeNull();
  });
});

describe('worldTerminals caching', () => {
  it('serves a part that did not move from cache', () => {
    // Every edit goes through immer, which leaves an untouched part at its
    // existing identity. That is what makes the cache work at all: dragging a
    // component must not re-place all 830 holes of the board behind it.
    const { design } = scene();
    const before = worldTerminals(design.parts.board);

    const next = produce(design, (d) => {
      d.parts.res.x += 5;
    });

    expect(next.parts.board).toBe(design.parts.board);
    expect(worldTerminals(next.parts.board)).toBe(before);
  });

  it('recomputes a part that did move', () => {
    const { design } = scene();
    const before = worldTerminals(design.parts.res);
    const beforeX = before.find((t) => t.def.name === 'a')!.pos.x;

    const next = produce(design, (d) => {
      d.parts.res.x += 5;
    });

    const after = worldTerminals(next.parts.res);
    expect(after).not.toBe(before);
    expect(after.find((t) => t.def.name === 'a')!.pos.x).toBe(beforeX + 5);
  });
});
