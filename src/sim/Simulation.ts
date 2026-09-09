import { getPartDef } from '@/parts/registry';
import type { DeviceOut, PropValue } from '@/parts/types';
import type { Design } from '@/state/design';
import { Circuit } from './mna/Circuit';
import { buildNetlist, type Netlist } from './net/buildNetlist';
import {
  makeDevice,
  type Device,
  type DeviceCtx,
  type FailureReport,
} from './devices/types';
import { simBus } from './bus';
import type { SimSnapshot } from '@/state/simStore';
import { MCU_KEY, type McuHandle } from './devices/mcu';
import { MICROBIT_KEY, type MicrobitHandle } from './devices/microbit';

import './devices/passive';
import './devices/sources';
import './devices/mcu';
import './devices/output';
import './devices/semiconductors';
import './devices/digital';
import './devices/sensors';
import './devices/extras';
import './devices/instruments';
import './devices/microbit';

interface Bound {
  partId: string;
  model: string;
  device: Device;
  ctx: DeviceCtx;
}

/** Fine step for circuits with reactive parts; coarse otherwise. */
const DT_FINE = 1e-4;
const DT_COARSE = 1e-3;
const MAX_SIM_PER_FRAME = 0.05;
const NR_MAX = 120;
const NR_TOL = 1e-7;

export interface SimulationCallbacks {
  onSnapshot(s: SimSnapshot): void;
  onDiagnostics(errors: { line?: number; message: string }[]): void;
}

/**
 * Owns the electrical solve and the MCU. Runs entirely off the React render
 * path: it mutates its own arrays each tick and hands the UI one frozen
 * snapshot per animation frame.
 */
export class Simulation {
  private design: Design;
  private cb: SimulationCallbacks;
  private netlist!: Netlist;
  private circuit!: Circuit;
  private bound: Bound[] = [];
  private shared = new Map<string, unknown>();
  private raf = 0;
  private lastWall = 0;
  private t = 0;
  private dt = DT_COARSE;
  private warnings: { partId?: string; message: string }[] = [];
  private convergenceFailures = 0;
  private gminBoost = 0;
  private failures: FailureReport[] = [];
  private failureKeys = new Set<string>();
  private breakpointLines: number[] = [];
  private breakpointsPending = false;
  private running = false;
  private serialCursor = 0;

  readonly diag = {
    iterations: 0,
    converged: false,
    delta: 0,
    limited: false,
    singular: false,
  };

  constructor(design: Design, cb: SimulationCallbacks) {
    this.design = design;
    this.cb = cb;
  }

  start() {
    // Damage does not survive a restart: a run begins with undamaged parts and
    // an empty log, which is what makes "try it again" a useful instruction.
    this.failures = [];
    this.failureKeys.clear();
    this.build();
    this.running = true;
    this.lastWall = performance.now();
    this.t = 0;
    this.serialCursor = 0;
    simBus.clear();
    // One step so the first published frame already has a solved circuit.
    this.step(this.dt);
    this.reportDiagnostics();
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /**
   * Re-extract the netlist after the document changed mid-run, carrying every
   * device over so a wiring tweak — or a keystroke in the code editor — does
   * not restart the sketch or lose a knob position.
   */
  rebuild(design: Design) {
    const carry = new Map(this.bound.map((b) => [`${b.partId}:${b.model}`, b]));
    this.design = design;
    this.build(carry);
    this.reportDiagnostics();
  }

  private build(carry?: Map<string, Bound>) {
    this.netlist = buildNetlist(this.design);
    const next: Bound[] = [];
    this.warnings = [];

    let branchCursor = 0;
    for (const d of this.netlist.devices) {
      const inst = this.design.parts[d.partId];
      if (!inst) continue;

      const key = `${d.partId}:${d.model}`;
      const previous = carry?.get(key);
      const device = previous?.device ?? makeDevice(d.model);
      if (!device) continue;

      const branch0 = branchCursor;
      branchCursor += device.branches ?? 0;

      const nodeCache = new Map<string, number>();
      const ctx: DeviceCtx = {
        partId: d.partId,
        props: this.propsFor(inst.type, inst.props),
        s: previous?.ctx.s ?? {},
        shared: this.shared,
        branch0,
        dt: this.dt,
        t: this.t,
        report: (r) => this.noteFailureReport(d.partId, r),
        node: (terminal: string) => {
          let n = nodeCache.get(terminal);
          if (n === undefined) {
            n = this.netlist.terminalNet.get(`${d.partId}:${terminal}`) ?? -1;
            nodeCache.set(terminal, n);
          }
          return n;
        },
      };
      next.push({ partId: d.partId, model: d.model, device, ctx });
    }

    this.bound = next;
    this.circuit = new Circuit(this.netlist.netCount, branchCursor);
    this.dt = this.bound.some((b) => b.device.needsFineStep) ? DT_FINE : DT_COARSE;

    // Breakpoints live in the document, so a design reopened with them still
    // stops where its author left the marks — not only when the gutter is
    // clicked in this session.
    this.setBreakpoints(this.design.code.breakpoints);
  }

  /** Device-visible props, with the program folded in for whichever board. */
  private propsFor(type: string, props: Record<string, PropValue>) {
    const def = getPartDef(type);
    if (def?.model?.startsWith('mcu-')) {
      return { ...props, __source: this.design.code.text };
    }
    if (def?.model === 'microbit') {
      return { ...props, __python: this.design.code.python };
    }
    return props;
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();
    const wall = Math.min((now - this.lastWall) / 1000, MAX_SIM_PER_FRAME);
    this.lastWall = now;

    this.applyInteractions();

    const steps = Math.max(1, Math.min(Math.round(wall / this.dt), 600));
    for (let i = 0; i < steps; i++) this.step(this.dt);

    this.publish();
    this.raf = requestAnimationFrame(this.loop);
  };

  private applyInteractions() {
    const events = simBus.drain();
    if (!events.length) return;
    for (const e of events) {
      const b = this.bound.find((x) => x.partId === e.partId);
      b?.device.interact?.(e.event, e.value, b.ctx);
    }
  }

  /** Send text typed in the serial monitor to whichever board is present. */
  sendSerial(text: string) {
    this.mcu()?.board.feedRx(text);
    this.microbit()?.board.feedRx(text);
  }

  setBreakpoints(lines: number[]) {
    const set = new Set(lines);
    const mcu = this.mcu();
    if (mcu) mcu.interp.breakpoints = set;
    const mb = this.microbit();
    if (mb) mb.interp.breakpoints = new Set(lines);
  }

  resumeFromBreakpoint() {
    this.mcu()?.interp.resume();
    this.microbit()?.interp.resume();
  }

  /** Advance a paused sketch by one statement. */
  stepOver() {
    this.mcu()?.interp.step();
    this.microbit()?.interp.step();
  }

  private mcu(): McuHandle | undefined {
    return this.shared.get(MCU_KEY) as McuHandle | undefined;
  }

  private microbit(): MicrobitHandle | undefined {
    return this.shared.get(MICROBIT_KEY) as MicrobitHandle | undefined;
  }

  private step(dt: number) {
    const c = this.circuit;
    if (c.size === 0) return;

    for (const b of this.bound) {
      b.ctx.dt = dt;
      b.ctx.t = this.t;
    }

    const nonlinear = this.bound.some((b) => b.device.nonlinear);
    let converged = false;
    const prev = new Float64Array(c.size);

    for (let iter = 0; iter < (nonlinear ? NR_MAX : 1); iter++) {
      prev.set(c.solution);
      c.reset();
      // Gmin keeps every node referenced even when part of the circuit is
      // momentarily floating; it is raised after a failure to help a stiff
      // circuit find its operating point, then relaxed.
      const gmin = this.gminBoost > 0 ? this.gminBoost : 1e-12;
      for (let n = 0; n < c.nodeCount; n++) c.matrix.add(n, n, gmin);
      for (const b of this.bound) b.device.stamp(c, b.ctx);

      this.diag.iterations = iter + 1;
      if (!c.solve()) {
        this.diag.singular = true;
        c.solution.set(prev);
        this.noteFailure(
          'This circuit could not be solved. Check for a short or a missing connection.',
        );
        return;
      }
      this.diag.singular = false;

      if (!nonlinear) {
        converged = true;
        break;
      }
      let delta = 0;
      for (let i = 0; i < c.size; i++) {
        delta = Math.max(delta, Math.abs(c.solution[i] - prev[i]));
      }
      this.diag.delta = delta;
      this.diag.limited = c.limited;
      // Node voltages can sit still while a junction's limiting is still
      // ramping, so both conditions must hold before Newton is done.
      if (delta < NR_TOL && !c.limited) {
        converged = true;
        break;
      }
    }

    this.diag.converged = converged;
    if (!converged && nonlinear) {
      this.gminBoost = this.gminBoost === 0 ? 1e-3 : Math.max(this.gminBoost / 10, 1e-12);
      this.noteFailure('Simulation did not converge — check for a short or a loop.');
    } else {
      this.convergenceFailures = 0;
      this.gminBoost = 0;
    }

    for (const b of this.bound) b.device.commit?.(c, b.ctx);
    this.t += dt;
  }

  private noteFailure(message: string) {
    if (++this.convergenceFailures === 20) this.warnings.push({ message });
  }

  /**
   * Record a part failing. A model calls this on every timestep the fault
   * persists, so the same event is folded into one entry — otherwise a shorted
   * LED would file a thousand identical reports a second.
   */
  private noteFailureReport(partId: string, r: Omit<FailureReport, 'partId' | 't'>) {
    const key = `${partId}|${r.severity}|${r.title}`;
    if (this.failureKeys.has(key)) return;
    this.failureKeys.add(key);
    this.failures.push({ ...r, partId, t: this.t });
    // A run that destroys a hundred parts has one underlying cause; keep the
    // first of them, which is the one that explains the rest.
    if (this.failures.length > 50) this.failures.length = 50;
  }

  private publish() {
    const parts: Record<string, DeviceOut> = {};
    for (const b of this.bound) {
      const out = b.device.output?.(this.circuit, b.ctx);
      if (out) parts[b.partId] = out;
    }

    const netV = new Float64Array(this.circuit.nodeCount);
    for (let i = 0; i < this.circuit.nodeCount; i++) netV[i] = this.circuit.v(i);

    const terminalNet: Record<string, number> = {};
    this.netlist.terminalNet.forEach((v, k) => (terminalNet[k] = v));

    const h = this.mcu();
    if (h?.interp.runtimeError) {
      const e = h.interp.runtimeError;
      this.cb.onDiagnostics([{ line: e.line, message: e.message }]);
    }

    this.cb.onSnapshot({
      t: this.t,
      parts,
      netV,
      terminalNet,
      serial: h ? h.board.serialTx : [],
      warnings: this.warnings.slice(-4),
      failures: this.failures,
    });
  }

  private reportDiagnostics() {
    const h = this.mcu();
    if (!h) return this.cb.onDiagnostics([]);
    this.cb.onDiagnostics(
      h.interp.parseErrors.map((e) => ({ line: e.line, message: e.message })),
    );
  }

  /** How much serial output is new since the last call. */
  drainSerial(): string[] {
    const h = this.mcu();
    if (!h) return [];
    const lines = h.board.serialTx.slice(this.serialCursor);
    this.serialCursor = h.board.serialTx.length;
    return lines;
  }

  /** Diagnostics for tests and the dev console. */
  debugNets() {
    const h = this.mcu();
    return {
      diag: { ...this.diag },
      dt: this.dt,
      t: this.t,
      state: Object.fromEntries(this.bound.map((b) => [b.partId, { ...b.ctx.s }])),
      count: this.netlist.netCount,
      members: this.netlist.members,
      ground: this.netlist.groundKey,
      serial: h?.board.serialTx.slice(-20) ?? [],
      parseErrors: h?.interp.parseErrors ?? [],
      runtimeError: h?.interp.runtimeError ?? null,
      pins: h
        ? Array.from({ length: 20 }, (_, p) => ({
            pin: p,
            mode: h.board.modes[p],
            duty: h.board.duty[p],
            v: +h.board.sensed[p].toFixed(3),
          })).filter((x) => x.mode !== 'input' || x.v !== 0)
        : [],
      devices: this.bound.map((b) => ({
        partId: b.partId,
        model: b.model,
        name: getPartDef(this.design.parts[b.partId]?.type ?? '')?.name,
      })),
    };
  }
}
