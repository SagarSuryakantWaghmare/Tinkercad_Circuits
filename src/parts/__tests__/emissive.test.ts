import { describe, expect, it } from 'vitest';

import { bloom, emissionHue, haloAlpha, litAlpha } from '../emissive';

describe('emissionHue', () => {
  it('keeps a faint emitter its own colour rather than nearly black', () => {
    // The bug this exists to prevent: channel values are intensities, so
    // painting rgb(5,0,0) over a light lens made a barely-lit RGB LED darker
    // than an unlit one. Normalised, a faint red is still full red and only
    // the alpha is small.
    expect(emissionHue(0.02, 0, 0)).toBe('rgb(255,0,0)');
    expect(emissionHue(1, 0, 0)).toBe('rgb(255,0,0)');
  });

  it('keeps the ratio between channels', () => {
    expect(emissionHue(0.1, 0.05, 0)).toBe('rgb(255,128,0)');
    expect(emissionHue(0.4, 0.4, 0.4)).toBe('rgb(255,255,255)');
  });

  it('falls back to white when nothing is lit', () => {
    expect(emissionHue(0, 0, 0)).toBe('#FFFFFF');
    expect(emissionHue(NaN, 0, 0)).toBe('#FFFFFF');
  });
});

describe('emission curves', () => {
  it('spends most of its range where the eye can use it', () => {
    // The old core alpha was 0.55 + 0.45*b, which jumped 55% of the way to
    // fully lit the instant any current flowed. A curve is only useful if a
    // dim part reads dim, so the first percent must stay near the floor.
    const travel = litAlpha(1) - litAlpha(0);
    expect((litAlpha(0.01) - litAlpha(0)) / travel).toBeLessThan(0.02);
  });

  it('starts the halo at nothing, so off is off', () => {
    expect(haloAlpha(0)).toBe(0);
    expect(haloAlpha(0.01)).toBeLessThan(0.002);
    expect(haloAlpha(1)).toBeCloseTo(0.9, 5);
  });

  it('holds the blow-out back for the top of the range', () => {
    expect(bloom(0.5)).toBe(0);
    expect(bloom(0.55)).toBe(0);
    expect(bloom(1)).toBeCloseTo(1, 10);
    expect(bloom(0.8)).toBeGreaterThan(0);
    expect(bloom(0.8)).toBeLessThan(0.5);
  });

  it('clamps anything the solver throws at it', () => {
    for (const bad of [NaN, Infinity, -1, 5]) {
      expect(litAlpha(bad)).toBeGreaterThanOrEqual(0.25);
      expect(litAlpha(bad)).toBeLessThanOrEqual(0.85);
      expect(haloAlpha(bad)).toBeGreaterThanOrEqual(0);
      expect(haloAlpha(bad)).toBeLessThanOrEqual(0.9);
    }
  });
});
