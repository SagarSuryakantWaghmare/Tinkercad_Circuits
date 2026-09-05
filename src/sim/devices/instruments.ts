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

defineDevice('function-generator', (): Device => ({
  needsFineStep: true,
  stamp(c, ctx) {
    const shape = String(ctx.props.wave ?? 'sine');
    const amp = num(ctx.props.amplitude, 5);
    const freq = Math.max(0.01, num(ctx.props.frequency, 100));
    const offset = num(ctx.props.offset, 0);

    const phase = ((ctx.t * freq) % 1 + 1) % 1;
    let s: number;
    switch (shape) {
      case 'square':
        s = phase < 0.5 ? 1 : -1;
        break;
      case 'triangle':
        s = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
        break;
      case 'sawtooth':
        s = 2 * phase - 1;
        break;
      default:
        s = Math.sin(phase * Math.PI * 2);
    }
    const v = offset + amp * s;

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

defineDevice('oscilloscope', (): Device => {
  const ch1 = new Float32Array(SCOPE_POINTS);
  const ch2 = new Float32Array(SCOPE_POINTS);
  let head = 0;
  let acc = 0;

  return {
    needsFineStep: true,
    stamp(c, ctx) {
      // Probes are high impedance so they do not load the circuit.
      c.stampResistance(ctx.node('CH1+'), ctx.node('CH1-'), 1e7);
      c.stampResistance(ctx.node('CH2+'), ctx.node('CH2-'), 1e7);
    },
    commit(c, ctx) {
      // One sample per (timePerDiv × 10 ÷ points) of simulated time.
      const span = num(ctx.props.timePerDiv, 0.001) * 10;
      const interval = span / SCOPE_POINTS;
      acc += ctx.dt;
      if (acc < interval) return;
      acc = 0;
      ch1[head] = c.v(ctx.node('CH1+')) - c.v(ctx.node('CH1-'));
      ch2[head] = c.v(ctx.node('CH2+')) - c.v(ctx.node('CH2-'));
      head = (head + 1) % SCOPE_POINTS;
      ctx.s.head = head;
    },
    output(_, ctx) {
      // Unroll the ring so the oldest sample is first.
      const h = head;
      const a: number[] = [];
      const b: number[] = [];
      for (let i = 0; i < SCOPE_POINTS; i++) {
        const j = (h + i) % SCOPE_POINTS;
        a.push(ch1[j]);
        b.push(ch2[j]);
      }
      const peak = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
      return {
        ch1: a,
        ch2: b,
        vpp1: peak(a),
        vpp2: peak(b),
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
