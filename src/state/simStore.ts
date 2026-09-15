'use client';

import { create } from 'zustand';
import type { DeviceOut } from '@/parts/types';

/**
 * An immutable frame of simulation output. Built off the React render path by
 * the solver and swapped in atomically once per animation frame; part art reads
 * `parts[id]` by reference so an unchanged device does not re-render.
 */
export interface SimSnapshot {
  /** Simulated seconds since Start Simulation. */
  t: number;
  parts: Record<string, DeviceOut>;
  /** Solved voltage per net index. */
  netV: Float64Array;
  /** Net index for a `${partId}:${terminal}` key. */
  terminalNet: Record<string, number>;
  serial: string[];
  /** Non-fatal issues raised this frame (over-current, no convergence…). */
  warnings: { partId?: string; message: string }[];
}

export const EMPTY_SNAPSHOT: SimSnapshot = {
  t: 0,
  parts: {},
  netV: new Float64Array(0),
  terminalNet: {},
  serial: [],
  warnings: [],
};

export type RunState = 'idle' | 'starting' | 'running' | 'paused' | 'error';

interface SimStore {
  runState: RunState;
  snapshot: SimSnapshot;
  /** Real seconds of wall clock the run has been going. */
  elapsed: number;
  /** Set when the sketch hits a breakpoint. */
  paused: { line: number; scope: Record<string, unknown> } | null;
  errors: { line?: number; message: string }[];
  serialInput: string;
  baud: number;

  setRunState: (s: RunState) => void;
  publish: (snap: SimSnapshot) => void;
  setPaused: (p: SimStore['paused']) => void;
  setErrors: (e: SimStore['errors']) => void;
  setSerialInput: (s: string) => void;
  setBaud: (b: number) => void;
  reset: () => void;
}

export const useSimStore = create<SimStore>((set) => ({
  runState: 'idle',
  snapshot: EMPTY_SNAPSHOT,
  elapsed: 0,
  paused: null,
  errors: [],
  serialInput: '',
  baud: 9600,

  setRunState: (runState) => set({ runState }),
  publish: (snapshot) => set({ snapshot, elapsed: snapshot.t }),
  setPaused: (paused) => set({ paused }),
  setErrors: (errors) => set({ errors }),
  setSerialInput: (serialInput) => set({ serialInput }),
  setBaud: (baud) => set({ baud }),
  reset: () =>
    set({
      runState: 'idle',
      snapshot: EMPTY_SNAPSHOT,
      elapsed: 0,
      paused: null,
      errors: [],
    }),
}));

/** Read a part's live state, or null when idle. */
export const usePartState = (id: string): DeviceOut | null =>
  useSimStore((s) => (s.runState === 'running' || s.runState === 'paused' ? s.snapshot.parts[id] ?? null : null));
