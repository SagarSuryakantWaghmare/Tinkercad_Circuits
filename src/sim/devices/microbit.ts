import { audio } from '../audio';
import {
  MB_EDGE_PINS,
  MB_VCC,
  MicrobitBoard,
  mbPinTerminal,
} from '../mcu/microbit/board';
import { installMicrobitRuntime } from '../mcu/microbit/runtime';
import { PY_CPU_HZ, PyInterpreter } from '../mcu/python/Interpreter';
import { clamp, defineDevice, formatScope, type Device } from './types';

/**
 * Shared handle so the editor can reach the board — serial, breakpoints and
 * the paused scope — without the code panel knowing which board is on the
 * canvas.
 */
export interface MicrobitHandle {
  board: MicrobitBoard;
  interp: PyInterpreter;
  netToPin: Map<number, number>;
}

export const MICROBIT_KEY = 'microbit';

/**
 * micro:bit v2.
 *
 * The board runs MicroPython rather than the Arduino interpreter, so it has
 * its own engine; everything else — how pins meet the solver, how the program
 * is paced against simulated time — mirrors the Arduino side exactly.
 */
defineDevice('microbit', (): Device => {
  const board = new MicrobitBoard();
  const interp = new PyInterpreter();
  installMicrobitRuntime(interp, board);
  let loadedSource: string | null = null;
  const netToPin = new Map<number, number>();

  return {
    stamp(c, ctx) {
      const handle: MicrobitHandle = { board, interp, netToPin };
      ctx.shared.set(MICROBIT_KEY, handle);

      const source = String(ctx.props.__python ?? '');
      if (source !== loadedSource) {
        loadedSource = source;
        board.reset();
        interp.reset();
        interp.load(source);
      }

      const gnd = ctx.node('GND');

      // On-board regulator feeding the 3 V pad.
      const g = 1 / 2;
      c.stampConductance(ctx.node('3V'), gnd, g);
      c.stampCurrentSource(gnd, ctx.node('3V'), MB_VCC * g);

      netToPin.clear();
      for (const pin of MB_EDGE_PINS) {
        const name = mbPinTerminal(pin);
        if (!name) continue;
        const node = ctx.node(name);
        // Only register pins with an actual net; otherwise -1 → pin pollutes
        // the map.
        if (node === -1) continue;
        netToPin.set(node, pin);

        const d = board.drive(pin);
        if (d) {
          const gp = 1 / d.r;
          c.stampConductance(node, gnd, gp);
          c.stampCurrentSource(gnd, node, d.v * gp);
        } else {
          // High-impedance input with the leak every real pin has.
          c.stampResistance(node, gnd, 1e7);
        }
      }
    },

    commit(c, ctx) {
      const gnd = ctx.node('GND');
      const vgnd = c.v(gnd);
      for (const pin of MB_EDGE_PINS) {
        const name = mbPinTerminal(pin);
        if (!name) continue;
        board.sensed[pin] = c.v(ctx.node(name)) - vgnd;
      }

      board.time += ctx.dt;
      if (board.tone && board.time > board.tone.until) {
        board.tone = null;
        audio.stop('microbit-music');
      }

      // Only run when the board is actually powered.
      const powered = c.v(ctx.node('3V')) - vgnd > 2;
      if (powered && !interp.parseErrors.length) {
        interp.run(Math.round(ctx.dt * PY_CPU_HZ));
      }
    },

    output(c, ctx) {
      const powered = c.v(ctx.node('3V')) - c.v(ctx.node('GND')) > 2;
      return {
        grid: powered ? board.frame() : new Array(25).fill(0),
        buttonA: board.buttonA.pressed,
        buttonB: board.buttonB.pressed,
        tiltX: ctx.s.tiltX ?? 0,
        tiltY: ctx.s.tiltY ?? 0,
        gesture: board.gesture,
        powered,
        running: !interp.finished && !interp.parseErrors.length,
        error: interp.runtimeError ? interp.runtimeError.message : '',
        errorLine: interp.runtimeError ? interp.runtimeError.line : 0,
        line: interp.currentLine,
        paused: !!interp.paused,
        pausedScope: interp.paused ? formatScope(interp.paused.scope) : [],
        toneHz: board.tone ? board.tone.frequency : 0,
      };
    },

    interact(event, value, ctx) {
      switch (event) {
        case 'buttonA':
          board.press('a', !!value);
          break;
        case 'buttonB':
          board.press('b', !!value);
          break;
        case 'logo':
          board.logoTouched = !!value;
          break;
        case 'shake':
          board.shake();
          break;
        case 'tilt': {
          // The art sends a screen-space delta; x rolls, y pitches.
          ctx.s.tiltX = clamp((ctx.s.tiltX ?? 0) + Number(value), -90, 90);
          board.setTilt(ctx.s.tiltX, ctx.s.tiltY ?? 0);
          break;
        }
        case 'tiltY': {
          ctx.s.tiltY = clamp((ctx.s.tiltY ?? 0) + Number(value), -90, 90);
          board.setTilt(ctx.s.tiltX ?? 0, ctx.s.tiltY);
          break;
        }
        case 'reset':
          board.reset();
          interp.reset();
          break;
        case 'serial':
          if (typeof value === 'string') board.feedRx(value);
          break;
      }
    },
  };
});
