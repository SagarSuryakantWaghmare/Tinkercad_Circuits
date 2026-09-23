import { audio } from '../audio';
import type { LcdState, NeoState } from '../mcu/runtime';
import { diodeStamp, ledParams, LED_I_RATED } from './passive';
import { findPeripheral, mcuHandle, mcuPinOf } from './resolve';
import { MICROBIT_KEY, type MicrobitHandle } from './microbit';
import { clamp, defineDevice, num, R_OPEN, type Device, type DeviceCtx } from './types';
import type { Circuit } from '../mna/Circuit';

const brightnessOf = (i: number) => clamp(Math.sqrt(Math.max(0, i) / LED_I_RATED), 0, 1);

/** Stamp one LED segment and return the brightness it should render at. */
function segment(
  c: Circuit,
  ctx: DeviceCtx,
  anode: number,
  cathode: number,
  key: string,
  colour = 'red',
): number {
  const p = ledParams(colour);
  const { i } = diodeStamp(c, ctx, anode, cathode, p, key);
  return brightnessOf(i);
}

// ─── Seven-segment display ───────────────────────────────────────────────────

const SEG_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];

defineDevice('seven-segment', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    const anodeCommon = String(ctx.props.common) === 'anode';
    const com = ctx.node('COM1');
    const colour = String(ctx.props.color ?? 'red');
    SEG_NAMES.forEach((s, i) => {
      const pin = ctx.node(s);
      const a = anodeCommon ? com : pin;
      const k = anodeCommon ? pin : com;
      ctx.s[`b${i}`] = segment(c, ctx, a, k, `vd${i}`, colour);
    });
  },
  output(_, ctx) {
    return { segments: SEG_NAMES.map((_, i) => ctx.s[`b${i}`] ?? 0) };
  },
}));

// ─── LED bar graph ───────────────────────────────────────────────────────────

defineDevice('bar-graph', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    for (let i = 0; i < 10; i++) {
      ctx.s[`b${i}`] = segment(c, ctx, ctx.node(`A${i + 1}`), ctx.node(`K${i + 1}`), `vd${i}`);
    }
  },
  output(_, ctx) {
    return { segments: Array.from({ length: 10 }, (_, i) => ctx.s[`b${i}`] ?? 0) };
  },
}));

// ─── 8×8 matrix ──────────────────────────────────────────────────────────────

defineDevice('led-matrix', (): Device => ({
  nonlinear: true,
  stamp(c, ctx) {
    for (let r = 0; r < 8; r++) {
      const row = ctx.node(`ROW${r + 1}`);
      for (let col = 0; col < 8; col++) {
        const i = r * 8 + col;
        ctx.s[`g${i}`] = segment(c, ctx, row, ctx.node(`COL${col + 1}`), `vd${i}`);
      }
    }
  },
  output(_, ctx) {
    // Persist a short afterglow so a multiplexed display does not flicker to
    // black between refresh passes, exactly as the eye integrates it.
    const grid: number[] = [];
    for (let i = 0; i < 64; i++) {
      const now = ctx.s[`g${i}`] ?? 0;
      const held = Math.max(now, (ctx.s[`h${i}`] ?? 0) * 0.86);
      ctx.s[`h${i}`] = held;
      grid.push(held);
    }
    return { grid };
  },
}));

// ─── DC motor ────────────────────────────────────────────────────────────────

defineDevice('dc-motor', (): Device => ({
  needsFineStep: false,
  stamp(c, ctx) {
    const a = ctx.node('terminal1');
    const b = ctx.node('terminal2');
    const ra = 8;
    const g = 1 / ra;
    // Winding resistance in series with the back-EMF of the spinning rotor.
    const ke = keOf(ctx);
    const emf = ke * (ctx.s.rpm ?? 0);
    c.stampConductance(a, b, g);
    c.stampCurrentSource(b, a, emf * g);
  },
  commit(c, ctx) {
    const ke = keOf(ctx);
    const ra = 8;
    const rpm = ctx.s.rpm ?? 0;
    const v = c.v(ctx.node('terminal1')) - c.v(ctx.node('terminal2'));
    const current = (v - ke * rpm) / ra;

    // A rotor needs a driving current to hold its speed. When the switch is
    // opened the winding sees no external path, so the terminal current is
    // effectively zero and the rotor must coast down — otherwise the internal
    // emf/winding loop wedges at target = rpm and the motor spins forever.
    const drive = Math.abs(current) > 1e-4;

    // Accel time constant when driven, coast-down time constant when idle.
    const tauDrive = 0.12;
    const tauCoast = 0.35;

    let next: number;
    if (drive) {
      const target = v / ke;
      next = rpm + ((target - rpm) * ctx.dt) / tauDrive;
    } else {
      // Frictional decay: no motor is truly frictionless, so an open circuit
      // brings the rotor to rest in a bit over one second.
      next = rpm * Math.exp(-ctx.dt / tauCoast);
    }

    ctx.s.rpm = Math.abs(next) < 1 ? 0 : next;
    ctx.s.current = drive ? current : 0;
    ctx.s.angle = ((ctx.s.angle ?? 0) + (ctx.s.rpm * 360 * ctx.dt) / 60) % 360;
  },
  output(_, ctx) {
    return {
      rpm: ctx.s.rpm ?? 0,
      angle: ctx.s.angle ?? 0,
      current: ctx.s.current ?? 0,
    };
  },
}));

function keOf(ctx: DeviceCtx) {
  const rated = Math.max(num(ctx.props.ratedVoltage, 6), 0.5);
  const rpmMax = rated * 1500; // a small hobby can, roughly 9000 rpm at 6 V
  return rated / rpmMax;
}

// ─── Servo ───────────────────────────────────────────────────────────────────

defineDevice('servo', (): Device => ({
  stamp(c, ctx) {
    // The signal line is a light load; the motor draws from the supply.
    c.stampResistance(ctx.node('signal'), ctx.node('gnd'), 12_000);
    c.stampResistance(ctx.node('power'), ctx.node('gnd'), 120);
  },
  commit(c, ctx) {
    const supply = c.v(ctx.node('power')) - c.v(ctx.node('gnd'));
    const powered = supply > 1.8;
    if (!powered) return;

    const continuous = String(ctx.props.kind) === 'continuous';
    let target = ctx.s.target ?? 90;
    const pin = mcuPinOf(ctx, 'signal');
    const h = mcuHandle(ctx);
    const commanded = pin !== null ? h?.board.servos.get(pin) : undefined;

    if (commanded?.attached) {
      target = commanded.angle;
    } else {
      // Check if driven by micro:bit
      const mb = ctx.shared.get(MICROBIT_KEY) as MicrobitHandle | undefined;
      if (mb) {
        const sigNode = ctx.node('signal');
        if (sigNode !== -1) {
          const mbPin = mb.netToPin.get(sigNode);
          if (mbPin !== undefined) {
            const outVal = mb.board.outputs[mbPin];
            if (outVal >= 20 && outVal <= 145) {
              target = Math.max(0, Math.min(180, ((outVal - 26) / (128 - 26)) * 180));
            } else if (outVal > 0 && outVal <= 180) {
              // Direct angle written (0..180)
              target = outVal;
            } else if (outVal > 180) {
              target = (outVal / 1023) * 180;
            }
          }
        }
      }
    }

    ctx.s.target = target;
    // Servos slew at roughly 0.12 s per 60°.
    const rate = 500; // degrees per second
    const angle = ctx.s.angle ?? 90;
    const delta = target - angle;
    const step = Math.sign(delta) * Math.min(Math.abs(delta), rate * ctx.dt);
    ctx.s.angle = angle + step;

    if (continuous) {
      // 90 is stop; either side is proportional speed.
      const speed = ((ctx.s.angle - 90) / 90) * 100;
      ctx.s.speed = speed;
      ctx.s.hornAngle = ((ctx.s.hornAngle ?? 0) + speed * 1.8 * ctx.dt) % 360;
    }
  },
  output(_, ctx) {
    return {
      angle: ctx.s.angle ?? 90,
      speed: ctx.s.speed ?? 0,
      hornAngle: ctx.s.hornAngle ?? 0,
    };
  },
}));

// ─── Stepper ─────────────────────────────────────────────────────────────────

defineDevice('stepper', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(ctx.node('A+'), ctx.node('A-'), 50);
    c.stampResistance(ctx.node('B+'), ctx.node('B-'), 50);
  },
  commit(_, ctx) {
    const st = findPeripheral<{ pins: number[]; position: number; steps: number }>(
      ctx,
      'stepper:',
      ['A+', 'A-', 'B+', 'B-'],
    );
    if (st) {
      const target = (st.position / Math.max(1, st.steps)) * 360;
      const angle = ctx.s.angle ?? 0;
      ctx.s.angle = angle + (target - angle) * Math.min(1, ctx.dt * 8);
    }
  },
  output(_, ctx) {
    return { angle: ctx.s.angle ?? 0 };
  },
}));

// ─── Solenoid ────────────────────────────────────────────────────────────────

defineDevice('solenoid', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(ctx.node('terminal1'), ctx.node('terminal2'), 20);
  },
  commit(c, ctx) {
    const v = Math.abs(c.v(ctx.node('terminal1')) - c.v(ctx.node('terminal2')));
    const want = v > 3 ? 1 : 0;
    const cur = ctx.s.engaged ?? 0;
    ctx.s.engaged = cur + (want - cur) * Math.min(1, ctx.dt * 25);
  },
  output(_, ctx) {
    return { engaged: ctx.s.engaged ?? 0 };
  },
}));

// ─── Sounders ────────────────────────────────────────────────────────────────

/**
 * A buzzer sounds when its terminals see an alternating drive. The frequency
 * comes from the MCU's own `tone()` when one is running on a connected pin;
 * otherwise it is measured from the square wave the sketch is toggling, so a
 * hand-written `digitalWrite` loop makes a noise too.
 */
function sounder(impedance: number, wave: OscillatorType): Device {
  return {
    needsFineStep: true,
    stamp(c, ctx) {
      c.stampResistance(ctx.node('terminal1'), ctx.node('terminal2'), impedance);
    },
    commit(c, ctx) {
      const v = c.v(ctx.node('terminal1')) - c.v(ctx.node('terminal2'));
      const high = v > 1.5;
      const wasHigh = ctx.s.high === 1;

      // Measure the drive frequency from edge to edge.
      if (high !== wasHigh) {
        const last = ctx.s.lastEdge ?? 0;
        const period = (ctx.t - last) * 2;
        if (period > 1 / 20000 && period < 1 / 20) {
          ctx.s.measured = 1 / period;
        }
        ctx.s.lastEdge = ctx.t;
        ctx.s.high = high ? 1 : 0;
        ctx.s.silence = 0;
      } else {
        ctx.s.silence = (ctx.s.silence ?? 0) + ctx.dt;
      }

      const h = mcuHandle(ctx);
      let freq = 0;
      let amp = 0;

      if (h?.board.tone) {
        const tonePin = h.board.tone.pin;
        const onNet =
          mcuPinOf(ctx, 'terminal1') === tonePin || mcuPinOf(ctx, 'terminal2') === tonePin;
        if (onNet) {
          freq = h.board.tone.frequency;
          amp = 1;
        }
      }
      if (!freq && (ctx.s.silence ?? 0) < 0.05) {
        freq = ctx.s.measured ?? 0;
        amp = clamp(Math.abs(v) / 5, 0, 1);
      }

      ctx.s.frequency = freq;
      ctx.s.level = freq > 0 ? amp : 0;

      const id = `snd:${ctx.partId}`;
      if (freq > 0 && amp > 0.05) audio.play(id, freq, amp * 0.8, wave);
      else audio.stop(id);
    },
    output(_, ctx) {
      return { frequency: ctx.s.frequency ?? 0, level: ctx.s.level ?? 0 };
    },
  };
}

defineDevice('piezo', () => sounder(1200, 'square'));
defineDevice('speaker', () => sounder(8, 'triangle'));

// ─── Character LCD ───────────────────────────────────────────────────────────

function lcd(dataTerminals: string[]): Device {
  return {
    stamp(c, ctx) {
      // ctx.node() returns -1 for an unconnected terminal, so the previous
      // `>= -1` guard was always true and the fallback to VCC/GND was dead.
      // Use the VDD/VSS pair when present, otherwise the VCC/GND names some
      // LCD footprints use.
      const supply = ctx.node('VDD') !== -1 ? ctx.node('VDD') : ctx.node('VCC');
      const ground = ctx.node('VSS') !== -1 ? ctx.node('VSS') : ctx.node('GND');
      c.stampResistance(supply, ground, 220);
      for (const t of dataTerminals) c.stampResistance(ctx.node(t), -1, R_OPEN);
    },
    output(_, ctx) {
      const st = findPeripheral<LcdState>(ctx, 'lcd:', dataTerminals);
      if (!st) return { lines: [], backlight: true };
      return {
        lines: st.buffer.map((l) => l.padEnd(st.cols, ' ')),
        backlight: st.backlight && st.display,
      };
    },
  };
}

defineDevice('lcd', () => lcd(['RS', 'E', 'DB4', 'DB5', 'DB6', 'DB7', 'DB0', 'DB1', 'DB2', 'DB3']));
defineDevice('lcd-i2c', () => lcd(['SDA', 'SCL']));

// ─── NeoPixel ────────────────────────────────────────────────────────────────

defineDevice('neopixel', (): Device => ({
  stamp(c, ctx) {
    c.stampResistance(ctx.node('VDD'), ctx.node('VSS'), 400);
    c.stampResistance(ctx.node('DIN'), ctx.node('VSS'), 1e6);
  },
  output(_, ctx) {
    const st = findPeripheral<NeoState & { pins: number[] }>(ctx, 'neopixel:', ['DIN']);
    if (!st) return { pixels: [] };
    const scale = (st.brightness ?? 255) / 255;
    return {
      pixels: st.pixels.map((p) => {
        const r = Math.round((((p >> 16) & 0xff) * scale));
        const g = Math.round((((p >> 8) & 0xff) * scale));
        const b = Math.round(((p & 0xff) * scale));
        return (r << 16) | (g << 8) | b;
      }),
    };
  },
}));
