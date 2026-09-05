import { Board, PIN_COUNT, pinTerminal, R_OUTPUT, R_PULLUP, VCC } from '../mcu/board';
import { CPU_HZ, Interpreter } from '../mcu/Interpreter';
import { installRuntime } from '../mcu/runtime';
import { clamp, defineDevice, formatScope, type Device } from './types';

/**
 * Shared handle the rest of the device models use to find the board: a servo
 * or a NeoPixel strip knows which net its signal wire lands on, not which
 * Arduino pin, so the MCU publishes the net → pin mapping here.
 */
export interface McuHandle {
  board: Board;
  interp: Interpreter;
  /** Net index → Arduino pin number for every pin that is wired to something. */
  netToPin: Map<number, number>;
}

export const MCU_KEY = 'mcu';

function makeMcu(): Device {
  const board = new Board();
  const interp = new Interpreter();
  installRuntime(interp, board);
  let loadedSource: string | null = null;
  const netToPin = new Map<number, number>();

  return {
    // The MCU itself is linear; nonlinearity comes from what it drives.
    stamp(c, ctx) {
      const shared = ctx.shared;
      const handle: McuHandle = { board, interp, netToPin };
      shared.set(MCU_KEY, handle);

      // Load or reload the sketch when the source changes.
      const source = String(ctx.props.__source ?? '');
      if (source !== loadedSource) {
        loadedSource = source;
        board.reset();
        interp.reset();
        interp.load(source);
      }

      const gnd = ctx.node('GND');

      // On-board regulators.
      stampSupply(c, ctx.node('5V'), gnd, VCC, 0.5);
      stampSupply(c, ctx.node('3.3V'), gnd, 3.3, 2);
      // IOREF mirrors the logic rail.
      stampSupply(c, ctx.node('IOREF'), gnd, VCC, 200);

      netToPin.clear();
      for (let pin = 0; pin < PIN_COUNT; pin++) {
        const name = pinTerminal(pin);
        if (!name) continue;
        const node = ctx.node(name);
        if (node !== -1 || gnd !== -1) netToPin.set(node, pin);

        const d = board.drive(pin);
        if (d) {
          // A driven pin is a Thevenin source; as a Norton pair it also keeps
          // the matrix well conditioned when the pin is shorted to a rail.
          const g = 1 / d.r;
          c.stampConductance(node, gnd, g);
          c.stampCurrentSource(gnd, node, d.v * g);
        } else {
          // High-impedance input: a very large leak so the node stays defined.
          c.stampResistance(node, gnd, 1e8);
        }
      }
    },

    commit(c, ctx) {
      // Feed solved pin voltages back to the sketch.
      const gnd = ctx.node('GND');
      const vgnd = c.v(gnd);
      for (let pin = 0; pin < PIN_COUNT; pin++) {
        const name = pinTerminal(pin);
        if (!name) continue;
        board.sensed[pin] = c.v(ctx.node(name)) - vgnd;
      }

      board.time += ctx.dt;
      if (board.tone && board.time > board.tone.until) board.tone = null;

      // Give the sketch exactly the cycles this timestep is worth, so sketch
      // time and circuit time advance together.
      if (!interp.parseErrors.length) interp.run(Math.round(ctx.dt * CPU_HZ));
    },

    output(c, ctx) {
      const d13 = board.drive(13);
      const serialTx = board.serialTx;
      return {
        led13: d13 ? clamp(d13.v / VCC, 0, 1) : 0,
        ledTx: board.serialOpen && serialTx.length ? 1 : 0,
        ledRx: board.serialRx.length ? 1 : 0,
        powered: c.v(ctx.node('5V')) > 4 ? 1 : 0,
        serialLines: serialTx.length,
        error: interp.runtimeError ? interp.runtimeError.message : '',
        errorLine: interp.runtimeError ? interp.runtimeError.line : 0,
        line: interp.currentLine,
        paused: !!interp.paused,
        pausedScope: interp.paused ? formatScope(interp.paused.scope) : [],
      };
    },

    interact(event, value) {
      if (event === 'reset') {
        board.reset();
        interp.reset();
      }
      if (event === 'serial' && typeof value === 'string') board.feedRx(value);
    },
  };
}

function stampSupply(
  c: Parameters<Device['stamp']>[0],
  node: number,
  gnd: number,
  volts: number,
  r: number,
) {
  if (node === -1) return;
  const g = 1 / r;
  c.stampConductance(node, gnd, g);
  c.stampCurrentSource(gnd, node, volts * g);
}

defineDevice('mcu-atmega328p', makeMcu);
defineDevice('mcu-attiny85', makeMcu);

export { R_OUTPUT, R_PULLUP };
