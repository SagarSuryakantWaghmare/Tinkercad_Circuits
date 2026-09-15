import { audio } from '../audio';
import { clamp, defineDevice, num, type Device } from './types';

/**
 * Bench instruments.
 *
 * Each is a real circuit element, not an overlay: the multimeter's ammeter
 * range really is a shunt in series, its voltmeter range really is 10 MΩ across
 * the probes, and the ohmmeter really injects a test current. Wiring one in the
 * wrong configuration therefore misbehaves the way the bench version does.
 */

// ─── Multimeter ──────────────────────────────────────────────────────────────

const SHUNT = 0.01;
const V_INPUT_R = 1e7;
const OHM_TEST_I = 1e-4;

defineDevice('multimeter', (): Device => ({
  stamp(c, ctx) {
    const mode = String(ctx.props.mode ?? 'voltage');
    const a = ctx.node('positive');
    const b = ctx.node('negative');

    switch (mode) {
      case 'current':
        c.stampResistance(a, b, SHUNT);
        break;
      case 'resistance':
      case 'continuity':
        // Source a known current and measure the voltage it develops.
        c.stampResistance(a, b, 1e9);
        c.stampCurrentSource(b, a, OHM_TEST_I);
        break;
      default:
        c.stampResistance(a, b, V_INPUT_R);
    }
  },
  commit(c, ctx) {
    const mode = String(ctx.props.mode ?? 'voltage');
    const v = c.v(ctx.node('positive')) - c.v(ctx.node('negative'));
    let reading = 0;
    if (mode === 'current') reading = v / SHUNT;
    else if (mode === 'resistance' || mode === 'continuity') reading = v / OHM_TEST_I;
    else reading = v;

    // Light damping so the display does not flicker on a noisy node.
    const prev = ctx.s.reading ?? reading;
    ctx.s.reading = prev + (reading - prev) * Math.min(1, ctx.dt * 40);
    ctx.s.raw = reading;

    if (mode === 'continuity') {
      const closed = Math.abs(reading) < 50;
      ctx.s.beep = closed ? 1 : 0;
      if (closed) audio.play(`dmm:${ctx.partId}`, 2000, 0.35, 'sine');
      else audio.stop(`dmm:${ctx.partId}`);
    } else {
      audio.stop(`dmm:${ctx.partId}`);
      ctx.s.beep = 0;
    }
  },
  output(_, ctx) {
    return {
      reading: ctx.s.reading ?? 0,
      mode: String(ctx.props.mode ?? 'voltage'),
      beep: ctx.s.beep === 1,
    };
  },
}));

// ─── Function generator ──────────────────────────────────────────────────────

/**
 * Sample a periodic waveform at a given phase in [0,1). A square wave gets
 * a tiny slew at each edge so that the fixed-step solver samples a
 * transitioning voltage instead of a discontinuity, which is what causes
 * the ringing/glitches on the scope trace.
 */
function fgSample(shape: string, phase: number, edge: number): number {
  switch (shape) {
    case 'square': {
      // Ramp across `edge` (in phase units) at each transition.
      const e = Math.max(1e-3, Math.min(0.05, edge));
      if (phase < e) return -1 + (phase / e) * 2;
      if (phase < 0.5 - e) return 1;
      if (phase < 0.5 + e) return 1 - ((phase - (0.5 - e)) / (2 * e)) * 2;
      if (phase < 1 - e) return -1;
      return -1 + ((phase - (1 - e)) / e) * 2;
    }
    case 'triangle':
      return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    case 'sawtooth': {
      // A tiny drop at the wrap keeps the wave continuous for the solver.
      const e = Math.max(1e-3, Math.min(0.05, edge));
      if (phase < 1 - e) return 2 * phase - 1;
      return 1 - ((phase - (1 - e)) / e) * 2;
    }
    default:
      return Math.sin(phase * Math.PI * 2);
  }
}

defineDevice('function-generator', (): Device => ({
  needsFineStep: true,
  stamp(c, ctx) {
    const shape = String(ctx.props.wave ?? 'sine');
    const amp = num(ctx.props.amplitude, 5);
    const freq = Math.max(0.01, num(ctx.props.frequency, 100));
    const offset = num(ctx.props.offset, 0);

    const phase = ((ctx.t * freq) % 1 + 1) % 1;
    // Slew the discontinuity across a few solver steps so the scope trace
    // draws clean edges instead of aliased spikes.
    const edge = Math.min(0.05, ctx.dt * freq * 2);
    const v = offset + amp * fgSample(shape, phase, edge);

    // 50 Ω output impedance, like a bench generator.
    const g = 1 / 50;
    c.stampConductance(ctx.node('positive'), ctx.node('negative'), g);
    c.stampCurrentSource(ctx.node('negative'), ctx.node('positive'), v * g);
    ctx.s.v = v;
  },
  output(_, ctx) {
    return { voltage: ctx.s.v ?? 0 };
  },
}));

// ─── Oscilloscope ────────────────────────────────────────────────────────────

/** Samples per trace shown on screen. */
const SCOPE_POINTS = 400;
/** Deep ring so a slow time-base still has enough history to draw the full
 *  display window without wrapping into stale data. */
const SCOPE_CAP = 8192;

defineDevice('oscilloscope', (): Device => {
  const ch1 = new Float32Array(SCOPE_CAP);
  const ch2 = new Float32Array(SCOPE_CAP);
  // Float64 so timestamps keep sub-microsecond precision across long runs.
  const ts = new Float64Array(SCOPE_CAP);
  let head = 0;
  let count = 0;
  let lastT = 0;

  return {
    needsFineStep: true,
    stamp(c, ctx) {
      // Probes are high impedance so they do not load the circuit.
      c.stampResistance(ctx.node('CH1+'), ctx.node('CH1-'), 1e7);
      c.stampResistance(ctx.node('CH2+'), ctx.node('CH2-'), 1e7);
    },
    commit(c, ctx) {
      // Sim restart: t rewound, drop stale ring so trace doesn't mix runs.
      if (ctx.t < lastT) {
        head = 0;
        count = 0;
      }
      lastT = ctx.t;
      // Every solver step is a sample. Storing time along with the sample
      // means the display can lay the trace out on real elapsed time
      // rather than assuming a uniform interval that never matches the
      // solver's actual step size.
      const v1 = c.v(ctx.node('CH1+')) - c.v(ctx.node('CH1-'));
      const v2 = c.v(ctx.node('CH2+')) - c.v(ctx.node('CH2-'));
      // A floating probe returns NaN; store 0 so the ring stays usable.
      ch1[head] = Number.isFinite(v1) ? v1 : 0;
      ch2[head] = Number.isFinite(v2) ? v2 : 0;
      ts[head] = ctx.t;
      head = (head + 1) % SCOPE_CAP;
      if (count < SCOPE_CAP) count++;
    },
    output(_, ctx) {
      if (count < 2) {
        return {
          ch1: [] as number[],
          ch2: [] as number[],
          vpp1: 0,
          vpp2: 0,
          timePerDiv: num(ctx.props.timePerDiv, 0.001),
          voltsPerDiv: num(ctx.props.voltsPerDiv, 1),
        };
      }
      const span = num(ctx.props.timePerDiv, 0.001) * 10;
      const newest = (head - 1 + SCOPE_CAP) % SCOPE_CAP;
      const tNow = ts[newest];
      const oldestNeeded = (head - count + SCOPE_CAP) % SCOPE_CAP;
      const tOldest = ts[oldestNeeded];
      // If the requested window predates our history, start at the oldest
      // sample instead of clamping every column to it (which draws a long
      // flat leader before the real trace).
      const tStart = Math.max(tNow - span, tOldest);
      const visibleSpan = tNow - tStart || span;

      // Resample the ring onto SCOPE_POINTS evenly spaced along the display
      // window. Target time sweeps left-to-right; the previous implementation
      // only walked cursor backwards, so once cursor crossed the target it
      // never advanced and every column right of that collapsed to the same
      // pair of samples. Walk cursor forward each iteration until ts[cursor]
      // straddles target, giving the true nearest-sample-after semantic.
      const a: number[] = new Array(SCOPE_POINTS);
      const b: number[] = new Array(SCOPE_POINTS);
      let cursor = oldestNeeded;
      for (let i = 0; i < SCOPE_POINTS; i++) {
        const target = tStart + (i / (SCOPE_POINTS - 1)) * visibleSpan;
        // Advance cursor while the next-newer sample is still ≤ target.
        while (cursor !== newest) {
          const next = (cursor + 1) % SCOPE_CAP;
          if (ts[next] > target) break;
          cursor = next;
        }
        // Interpolate between cursor (t0) and cursor+1 (t1) for a smoother trace.
        const nextIdx = cursor === newest ? cursor : (cursor + 1) % SCOPE_CAP;
        const t0 = ts[cursor];
        const t1 = ts[nextIdx];
        const dt = t1 - t0 || 1;
        const f = Math.max(0, Math.min(1, (target - t0) / dt));
        a[i] = ch1[cursor] + (ch1[nextIdx] - ch1[cursor]) * f;
        b[i] = ch2[cursor] + (ch2[nextIdx] - ch2[cursor]) * f;
      }

      let a1 = -Infinity, b1 = Infinity, a2 = -Infinity, b2 = Infinity;
      for (let i = 0; i < SCOPE_POINTS; i++) {
        if (a[i] > a1) a1 = a[i];
        if (a[i] < b1) b1 = a[i];
        if (b[i] > a2) a2 = b[i];
        if (b[i] < b2) b2 = b[i];
      }
      return {
        ch1: a,
        ch2: b,
        vpp1: Math.max(0, a1 - b1),
        vpp2: Math.max(0, a2 - b2),
        timePerDiv: num(ctx.props.timePerDiv, 0.001),
        voltsPerDiv: num(ctx.props.voltsPerDiv, 1),
      };
    },
  };
});

// ─── Solar panel illumination control lives with the sources ─────────────────

defineDevice('vcc-symbol', (): Device => ({
  stamp(c, ctx) {
    const v = num(ctx.props.voltage, 5);
    const g = 1 / 0.05;
    c.stampConductance(ctx.node('out'), -1, g);
    c.stampCurrentSource(-1, ctx.node('out'), v * g);
  },
  output(c, ctx) {
    return { voltage: c.v(ctx.node('out')) };
  },
}));

defineDevice('gnd-symbol', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(ctx.node('out'), -1, 1e-3);
  },
  output() {
    return {};
  },
}));

export { clamp };
