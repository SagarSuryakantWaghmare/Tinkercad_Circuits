import { describe, expect, it } from 'vitest';

import { findTrigger } from '../instruments';

const CAP = 8192;
const STEP = 1e-4; // the solver's fine step, which is what the scope forces
const FREQ = 100;

/** A ring of `n` sine samples taken at the solver's step. */
function sineRing(n: number, shape: (t: number) => number = (t) => Math.sin(2 * Math.PI * FREQ * t)) {
  const ch = new Float32Array(CAP);
  const ts = new Float64Array(CAP);
  for (let i = 0; i < n; i++) {
    const t = i * STEP;
    ch[i % CAP] = shape(t);
    ts[i % CAP] = t;
  }
  const head = n % CAP;
  return { ch, ts, head, count: Math.min(n, CAP), tNow: (n - 1) * STEP };
}

describe('findTrigger', () => {
  it('locks every frame to the same phase, though the frames do not overlap', () => {
    // A frame of wall time advances ~16.7 ms of sim, while 1 ms/div is a
    // 10 ms window — so successive frames share no samples at all. Anchoring
    // to the newest sample therefore showed a different slice each time and
    // the trace read as noise. The trigger has to make them agree.
    const span = 0.01;
    const phases: number[] = [];

    for (let frame = 0; frame < 6; frame++) {
      const { ch, ts, head, count, tNow } = sineRing(2000 + frame * 167);
      const trig = findTrigger(ch, ts, head, count, CAP, tNow - span);
      expect(trig).not.toBeNull();
      phases.push(((trig! * FREQ) % 1) + (trig! < 0 ? 1 : 0));
    }

    // A rising zero crossing of this sine is at a whole multiple of 1/FREQ,
    // so every frame should land on phase 0 give or take one sample.
    for (const p of phases) {
      expect(Math.min(p, 1 - p)).toBeLessThan(STEP * FREQ * 1.5);
    }
  });

  it('leaves a whole window of samples after the trigger', () => {
    const span = 0.01;
    const { ch, ts, head, count, tNow } = sineRing(3000);
    const trig = findTrigger(ch, ts, head, count, CAP, tNow - span)!;
    expect(trig).not.toBeNull();
    expect(tNow - trig).toBeGreaterThanOrEqual(span);
  });

  it('fires on a rising edge, not a falling one', () => {
    const span = 0.01;
    const { ch, ts, head, count, tNow } = sineRing(3000);
    const trig = findTrigger(ch, ts, head, count, CAP, tNow - span)!;
    // Just after a rising crossing the sine is climbing.
    const i = Math.round(trig / STEP);
    expect(ch[i + 1]).toBeGreaterThan(ch[i - 1]);
  });

  it('gives up on a flat trace so the caller can free-run', () => {
    const { ch, ts, head, count, tNow } = sineRing(3000, () => 5);
    expect(findTrigger(ch, ts, head, count, CAP, tNow - 0.01)).toBeNull();
  });

  it('is not fooled by ripple sitting on the trigger level', () => {
    // A slow square with a little noise on it: the hysteresis band should stop
    // every wobble near the midpoint counting as a fresh edge.
    const { ch, ts, head, count, tNow } = sineRing(3000, (t) => {
      const square = Math.sin(2 * Math.PI * 50 * t) >= 0 ? 1 : -1;
      return square + Math.sin(2 * Math.PI * 4000 * t) * 0.02;
    });
    const trig = findTrigger(ch, ts, head, count, CAP, tNow - 0.01)!;
    expect(trig).not.toBeNull();
    // Edges of a 50 Hz square are 20 ms apart; the trigger must be on one.
    const phase = (trig * 50) % 1;
    expect(Math.min(phase, 1 - phase)).toBeLessThan(0.02);
  });
});
