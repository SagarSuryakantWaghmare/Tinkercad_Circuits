import { mcuHandle, mcuPinOf } from './resolve';
import { clamp, defineDevice, num, R_CLOSED, R_OPEN, type Device, type DeviceCtx } from './types';

/**
 * Sensors fall into three shapes and are built from three factories rather
 * than written out one by one: a two-terminal variable resistance, a
 * three-pin module whose OUT pin the sensor itself drives, and a switch that
 * opens or closes. In every case the physical quantity is whatever the user
 * has dragged the on-canvas control to.
 */

interface Ranged {
  key: string;
  min: number;
  max: number;
  initial: number;
  /** Screen pixels per unit while dragging. */
  scale?: number;
  log?: boolean;
}

function interactRange(r: Ranged) {
  return (event: string, value: number | boolean | undefined, ctx: DeviceCtx) => {
    const cur = ctx.s[r.key] ?? r.initial;
    if (event === 'set') ctx.s[r.key] = clamp(Number(value), r.min, r.max);
    if (event === 'delta') ctx.s[r.key] = clamp(cur + Number(value) * (r.scale ?? 1), r.min, r.max);
    if (event === 'deltaLog') {
      ctx.s[r.key] = clamp(cur * Math.pow(10, Number(value)), r.min, r.max);
    }
    if (event === 'toggle') ctx.s[r.key] = cur > (r.min + r.max) / 2 ? r.min : r.max;
  };
}

/** Two-terminal sensor whose resistance tracks the dragged quantity. */
function resistiveSensor(
  r: Ranged,
  resistance: (v: number) => number,
  terminals: [string, string] = ['terminal1', 'terminal2'],
): Device {
  return {
    stamp(c, ctx) {
      const v = ctx.s[r.key] ?? r.initial;
      c.stampResistance(ctx.node(terminals[0]), ctx.node(terminals[1]), resistance(v));
    },
    interact: interactRange(r),
    output(_, ctx) {
      const v = ctx.s[r.key] ?? r.initial;
      return { value: v, resistance: resistance(v) };
    },
  };
}

/**
 * Three-pin module: it takes power from VCC/GND and drives its own OUT pin,
 * either as a logic level or as an analog voltage.
 */
function moduleSensor(
  r: Ranged,
  outputVoltage: (v: number, supply: number) => number,
  opts: { digital?: boolean; pins?: { vcc: string; gnd: string; out: string } } = {},
): Device {
  const pins = opts.pins ?? { vcc: 'VCC', gnd: 'GND', out: 'OUT' };
  return {
    stamp(c, ctx) {
      const vcc = ctx.node(pins.vcc);
      const gnd = ctx.node(pins.gnd);
      const supply = c.v(vcc) - c.v(gnd);
      const value = ctx.s[r.key] ?? r.initial;
      const out = clamp(outputVoltage(value, supply <= 0.5 ? 5 : supply), 0, Math.max(supply, 0));

      // Quiescent current draw.
      c.stampResistance(vcc, gnd, 4000);
      // Push-pull output stage.
      const g = 1 / (opts.digital ? 60 : 400);
      c.stampConductance(ctx.node(pins.out), gnd, g);
      c.stampCurrentSource(gnd, ctx.node(pins.out), out * g);
      ctx.s.__out = out;
      ctx.s.__supply = supply;
    },
    interact: interactRange(r),
    output(_, ctx) {
      return {
        value: ctx.s[r.key] ?? r.initial,
        out: ctx.s.__out ?? 0,
        powered: (ctx.s.__supply ?? 0) > 2.5,
      };
    },
  };
}

/** A mechanical contact that the user opens and closes. */
function contactSensor(terminals: [string, string], normallyOpen = true): Device {
  return {
    stamp(c, ctx) {
      const closed = (ctx.s.closed ?? (normallyOpen ? 0 : 1)) === 1;
      c.stampResistance(ctx.node(terminals[0]), ctx.node(terminals[1]), closed ? R_CLOSED : R_OPEN);
    },
    interact(event, value, ctx) {
      if (event === 'press') ctx.s.closed = value ? 1 : 0;
      if (event === 'toggle') ctx.s.closed = ctx.s.closed === 1 ? 0 : 1;
    },
    output(_, ctx) {
      return { closed: ctx.s.closed === 1 };
    },
  };
}

// ─── Resistive sensors ───────────────────────────────────────────────────────

defineDevice('flex-sensor', () =>
  resistiveSensor(
    { key: 'bend', min: 0, max: 90, initial: 0, scale: 0.5 },
    // Flat ≈ 25 kΩ, fully bent ≈ 100 kΩ.
    (deg) => 25000 + (deg / 90) * 75000,
  ),
);

defineDevice('force-sensor', () =>
  resistiveSensor(
    { key: 'force', min: 0, max: 100, initial: 0, scale: 0.6 },
    // An FSR falls from megohms untouched to a few hundred ohms under load.
    (f) => (f < 0.5 ? 5e6 : clamp(30000 / Math.pow(f / 10 + 0.1, 1.3), 250, 5e6)),
  ),
);

defineDevice('thermistor', () =>
  resistiveSensor(
    { key: 'tempC', min: -40, max: 125, initial: 25, scale: 0.4 },
    // 10 k NTC, β = 3950, referenced to 25 °C.
    (t) => 10000 * Math.exp(3950 * (1 / (t + 273.15) - 1 / 298.15)),
  ),
);

defineDevice('phototransistor', () =>
  resistiveSensor(
    { key: 'lux', min: 0.05, max: 100000, initial: 100, scale: 1 },
    (lux) => clamp(2e6 / Math.pow(Math.max(lux, 0.05), 1.1), 120, 5e7),
    ['collector', 'emitter'],
  ),
);

defineDevice('photodiode', () =>
  resistiveSensor(
    { key: 'lux', min: 0.05, max: 100000, initial: 100, scale: 1 },
    (lux) => clamp(1e7 / Math.pow(Math.max(lux, 0.05), 0.9), 500, 1e8),
    ['cathode', 'anode'],
  ),
);

defineDevice('slide-pot', (): Device => ({
  stamp(c, ctx) {
    const total = Math.max(num(ctx.props.resistance, 10000), 1);
    const f = clamp(ctx.s.wiper ?? 0.5, 0, 1);
    c.stampResistance(ctx.node('terminal1'), ctx.node('wiper'), Math.max(total * f, 1));
    c.stampResistance(ctx.node('wiper'), ctx.node('terminal2'), Math.max(total * (1 - f), 1));
  },
  interact(event, value, ctx) {
    if (event === 'set') ctx.s.wiper = clamp(Number(value), 0, 1);
    if (event === 'delta') ctx.s.wiper = clamp((ctx.s.wiper ?? 0.5) + Number(value), 0, 1);
  },
  output(_, ctx) {
    return { wiper: ctx.s.wiper ?? 0.5 };
  },
}));

// ─── Module sensors ──────────────────────────────────────────────────────────

defineDevice('pir-sensor', () =>
  moduleSensor(
    { key: 'motion', min: 0, max: 1, initial: 0 },
    (v, supply) => (v > 0.5 ? supply : 0),
    { digital: true },
  ),
);

defineDevice('gas-sensor', () =>
  moduleSensor(
    { key: 'ppm', min: 0, max: 1000, initial: 20, scale: 4 },
    // MQ-series output rises with concentration.
    (ppm, supply) => clamp((ppm / 1000) * supply * 0.9 + 0.15, 0, supply),
  ),
);

defineDevice('flame-sensor', () =>
  moduleSensor(
    { key: 'flame', min: 0, max: 100, initial: 0, scale: 0.6 },
    // Active-low: the output falls as the flame gets closer.
    (f, supply) => clamp(supply * (1 - f / 100), 0, supply),
  ),
);

defineDevice('soil-moisture', () =>
  moduleSensor(
    { key: 'moisture', min: 0, max: 100, initial: 30, scale: 0.6 },
    (m, supply) => clamp((m / 100) * supply, 0, supply),
  ),
);

defineDevice('water-level', () =>
  moduleSensor(
    { key: 'level', min: 0, max: 100, initial: 0, scale: 0.6 },
    (l, supply) => clamp((l / 100) * supply * 0.85, 0, supply),
  ),
);

defineDevice('sound-sensor', () =>
  moduleSensor(
    { key: 'db', min: 30, max: 110, initial: 40, scale: 0.5 },
    (db, supply) => clamp(((db - 30) / 80) * supply, 0, supply),
  ),
);

defineDevice('hall-sensor', () =>
  moduleSensor(
    { key: 'field', min: 0, max: 1, initial: 0 },
    // Active-low output, like a common A3144.
    (f, supply) => (f > 0.5 ? 0.2 : supply),
    { digital: true },
  ),
);

/**
 * A demodulating receiver idles high and pulls low while a carrier is present.
 * Either the on-part toggle or an IR handset elsewhere in the design can
 * supply that carrier, so the two are OR-ed together.
 */
defineDevice('ir-receiver', () => {
  const base = moduleSensor(
    { key: 'code', min: 0, max: 1, initial: 0 },
    (v, supply) => (v > 0.5 ? 0.2 : supply),
    { digital: true, pins: { vcc: 'VCC', gnd: 'GND', out: 'OUT' } },
  );
  return {
    ...base,
    stamp(c, ctx) {
      const bus = ctx.shared.get('ir:bus') as { code: number | null } | undefined;
      ctx.s.remote = bus && bus.code !== null ? 1 : 0;
      ctx.s.remoteCode = bus && bus.code !== null ? bus.code : -1;
      const manual = ctx.s.code ?? 0;
      const saved = manual;
      if (ctx.s.remote === 1) ctx.s.code = 1;
      base.stamp(c, ctx);
      ctx.s.code = saved;
    },
    output(c, ctx) {
      const out = base.output ? base.output(c, ctx) : {};
      const code = ctx.s.remoteCode ?? -1;
      return {
        ...out,
        value: ctx.s.remote === 1 ? 1 : (ctx.s.code ?? 0),
        code,
        codeHex: code >= 0 ? '0x' + code.toString(16).toUpperCase() : '',
      };
    },
  };
});

defineDevice('rtc', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(ctx.node('VCC'), ctx.node('GND'), 20000);
    c.stampResistance(ctx.node('SDA'), ctx.node('GND'), 1e7);
    c.stampResistance(ctx.node('SCL'), ctx.node('GND'), 1e7);
  },
  output(_, ctx) {
    const now = new Date(Date.now() + (ctx.s.offset ?? 0) * 1000);
    return {
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      date: now.toLocaleDateString(),
    };
  },
}));

// ─── Contacts ────────────────────────────────────────────────────────────────

defineDevice('tilt-sensor', () => contactSensor(['terminal1', 'terminal2']));
defineDevice('vibration-sensor', () => contactSensor(['terminal1', 'terminal2']));
defineDevice('reed-switch', () => contactSensor(['terminal1', 'terminal2']));
defineDevice('limit-switch', () => contactSensor(['COM', 'NO']));
defineDevice('toggle-switch', () => contactSensor(['terminal1', 'terminal2'], false));

// ─── DIP switch ──────────────────────────────────────────────────────────────

defineDevice('dip-switch', (): Device => ({
  stamp(c, ctx) {
    const n = Math.max(1, num(ctx.props.ways, 4));
    for (let i = 1; i <= n; i++) {
      const on = ctx.s[`s${i}`] === 1;
      c.stampResistance(ctx.node(`A${i}`), ctx.node(`B${i}`), on ? R_CLOSED : R_OPEN);
    }
  },
  interact(event, value, ctx) {
    // The art sends the switch index as the value.
    if (event === 'toggle' && typeof value === 'number') {
      const k = `s${value}`;
      ctx.s[k] = ctx.s[k] === 1 ? 0 : 1;
    }
  },
  output(_, ctx) {
    const n = Math.max(1, num(ctx.props.ways, 4));
    return { states: Array.from({ length: n }, (_, i) => ctx.s[`s${i + 1}`] ?? 0) };
  },
}));

// ─── Ultrasonic distance sensors ─────────────────────────────────────────────

/**
 * HC-SR04. It answers a trigger pulse with an echo whose width encodes the
 * distance; the sketch measures it with `pulseIn`, so the reply is parked where
 * the runtime's `pulseIn` looks for it. Sound travels 1 cm in 29.1 µs each way.
 */
function ultrasonic(threePin: boolean): Device {
  return {
    stamp(c, ctx) {
      c.stampResistance(ctx.node('VCC'), ctx.node('GND'), 3000);
      const sig = threePin ? 'SIG' : 'ECHO';
      c.stampResistance(ctx.node(sig), ctx.node('GND'), 1e7);
      if (!threePin) c.stampResistance(ctx.node('TRIG'), ctx.node('GND'), 1e7);
    },
    commit(_, ctx) {
      const cm = clamp(ctx.s.distance ?? 100, 2, 400);
      const micros = Math.round(cm * 58.2);
      const h = mcuHandle(ctx);
      if (!h) return;
      const pin = mcuPinOf(ctx, threePin ? 'SIG' : 'ECHO');
      if (pin !== null) h.board.peripherals.set(`pulse:${pin}`, micros);
    },
    interact(event, value, ctx) {
      const cur = ctx.s.distance ?? 100;
      if (event === 'set') ctx.s.distance = clamp(Number(value), 2, 400);
      if (event === 'delta') ctx.s.distance = clamp(cur + Number(value), 2, 400);
    },
    output(_, ctx) {
      return { distance: ctx.s.distance ?? 100 };
    },
  };
}

defineDevice('ultrasonic-4pin', () => ultrasonic(false));
defineDevice('ultrasonic-3pin', () => ultrasonic(true));

// ─── Rotary encoder ──────────────────────────────────────────────────────────

defineDevice('rotary-encoder', (): Device => ({
  stamp(c, ctx) {
    // Quadrature: two contacts 90° out of phase as the shaft turns.
    const pos = ctx.s.position ?? 0;
    const phase = ((pos % 4) + 4) % 4;
    const a = phase === 0 || phase === 1;
    const b = phase === 1 || phase === 2;
    c.stampResistance(ctx.node('A'), ctx.node('C'), a ? R_CLOSED : R_OPEN);
    c.stampResistance(ctx.node('B'), ctx.node('C'), b ? R_CLOSED : R_OPEN);
    c.stampResistance(ctx.node('SW1'), ctx.node('SW2'), ctx.s.pressed === 1 ? R_CLOSED : R_OPEN);
  },
  interact(event, value, ctx) {
    if (event === 'delta') ctx.s.position = (ctx.s.position ?? 0) + Math.sign(Number(value));
    if (event === 'press') ctx.s.pressed = value ? 1 : 0;
  },
  output(_, ctx) {
    return { position: ctx.s.position ?? 0, pressed: ctx.s.pressed === 1 };
  },
}));

// ─── Keypad ──────────────────────────────────────────────────────────────────

defineDevice('keypad-4x4', (): Device => ({
  stamp(c, ctx) {
    const key = ctx.s.key ?? -1;
    for (let r = 0; r < 4; r++) {
      for (let col = 0; col < 4; col++) {
        const pressed = key === r * 4 + col;
        c.stampResistance(
          ctx.node(`ROW${r + 1}`),
          ctx.node(`COL${col + 1}`),
          pressed ? R_CLOSED : R_OPEN,
        );
      }
    }
  },
  interact(event, value, ctx) {
    if (event === 'press') ctx.s.key = Number(value);
    if (event === 'release') ctx.s.key = -1;
  },
  output(_, ctx) {
    return { key: ctx.s.key ?? -1 };
  },
}));

// ─── Joystick ────────────────────────────────────────────────────────────────

defineDevice('joystick', (): Device => ({
  stamp(c, ctx) {
    const vcc = ctx.node('VCC');
    const gnd = ctx.node('GND');
    const x = clamp(ctx.s.x ?? 0.5, 0, 1);
    const y = clamp(ctx.s.y ?? 0.5, 0, 1);
    // Two 10 k pots across the supply.
    c.stampResistance(vcc, ctx.node('VRx'), Math.max(10000 * (1 - x), 1));
    c.stampResistance(ctx.node('VRx'), gnd, Math.max(10000 * x, 1));
    c.stampResistance(vcc, ctx.node('VRy'), Math.max(10000 * (1 - y), 1));
    c.stampResistance(ctx.node('VRy'), gnd, Math.max(10000 * y, 1));
    c.stampResistance(ctx.node('SW'), gnd, ctx.s.pressed === 1 ? R_CLOSED : R_OPEN);
  },
  interact(event, value, ctx) {
    if (event === 'x') ctx.s.x = clamp(Number(value), 0, 1);
    if (event === 'y') ctx.s.y = clamp(Number(value), 0, 1);
    if (event === 'press') ctx.s.pressed = value ? 1 : 0;
    if (event === 'release') {
      ctx.s.x = 0.5;
      ctx.s.y = 0.5;
    }
  },
  output(_, ctx) {
    return { x: ctx.s.x ?? 0.5, y: ctx.s.y ?? 0.5, pressed: ctx.s.pressed === 1 };
  },
}));
