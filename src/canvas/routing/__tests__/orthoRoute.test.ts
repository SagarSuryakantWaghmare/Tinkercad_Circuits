import { describe, expect, it } from 'vitest';

import { roundedPath } from '../orthoRoute';

/** Every `A rx,ry ...` command in a path, as [rx, ry] pairs. */
function arcRadii(d: string): [number, number][] {
  return [...d.matchAll(/A([\d.-]+),([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

/** The point an `A` command sweeps to, and the `L` point it starts from. */
function arcChord(d: string): number {
  const m = d.match(/L([\d.-]+),([\d.-]+)A[\d.-]+,[\d.-]+ 0 0,[01] ([\d.-]+),([\d.-]+)/)!;
  const [, x1, y1, x2, y2] = m.map(Number);
  return Math.hypot(x2 - x1, y2 - y1);
}

describe('roundedPath', () => {
  it('rounds a corner with the full radius when both legs are long', () => {
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      10,
    );
    expect(arcRadii(d)).toEqual([[10, 10]]);
  });

  it('emits the radius it actually drew with when a leg is too short for it', () => {
    // The corner is 6 from the end, so the arc has to be cut back to 3. An arc
    // command still naming 10 makes the renderer sweep a radius-10 circle
    // through points only 3*sqrt(2) apart — about 24 degrees of turn where 90
    // is wanted, which shows up as a kink in the elbow rather than a curve.
    // Breadboard pitch is 10, so short legs are the normal case, not the edge.
    const d = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 6 },
      ],
      10,
    );

    const [[rx, ry]] = arcRadii(d);
    expect(rx).toBe(3);
    expect(ry).toBe(3);

    // The chord and the radius must agree on a quarter turn.
    const chord = arcChord(d);
    expect(chord).toBeCloseTo(3 * Math.SQRT2, 5);
    const swept = 2 * Math.asin(chord / (2 * rx));
    expect((swept * 180) / Math.PI).toBeCloseTo(90, 5);
  });
});
