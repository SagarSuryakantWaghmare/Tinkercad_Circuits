'use client';

import { create } from 'zustand';
import { produce, enableMapSet } from 'immer';
import {
  emptyDesign,
  migrateDesign,
  type Design,
  type Note,
  type PartInstance,
  type Wire,
} from './design';
import { newDesignId } from '@/lib/ids';

enableMapSet();

const HISTORY_LIMIT = 120;

interface HistoryEntry {
  design: Design;
  label: string;
}

interface DesignStore {
  design: Design;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Open transaction depth — nested transacts collapse into one history entry. */
  txDepth: number;
  txLabel: string | null;
  txSnapshot: Design | null;
  /** Bumped on every committed mutation; cheap dependency for memoised derivations. */
  revision: number;

  /**
   * Apply a mutation. Recorded as a single undo step unless already inside a
   * transaction, in which case it folds into the enclosing one.
   */
  transact: (label: string, fn: (d: Design) => void) => void;
  /** Begin a coalescing transaction (pointerdown → pointerup drags). */
  begin: (label: string) => void;
  /** Commit the open transaction. Discards it if nothing actually changed. */
  commit: () => void;
  /** Abandon the open transaction, restoring the pre-transaction state. */
  rollback: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Replace the document wholesale (load / import / new). Clears history. */
  load: (design: Design) => void;
  reset: () => void;
  rename: (name: string) => void;
}

export const useDesignStore = create<DesignStore>((set, get) => ({
  design: emptyDesign(newDesignId()),
  past: [],
  future: [],
  txDepth: 0,
  txLabel: null,
  txSnapshot: null,
  revision: 0,

  transact: (label, fn) => {
    const s = get();
    if (s.txDepth > 0) {
      // Inside an open transaction: mutate without touching history.
      set({
        design: produce(s.design, fn),
        revision: s.revision + 1,
      });
      return;
    }
    const next = produce(s.design, (d) => {
      fn(d);
      d.updatedAt = Date.now();
    });
    if (next === s.design) return;
    set({
      design: next,
      past: [...s.past, { design: s.design, label }].slice(-HISTORY_LIMIT),
      future: [],
      revision: s.revision + 1,
    });
  },

  begin: (label) => {
    const s = get();
    if (s.txDepth > 0) {
      set({ txDepth: s.txDepth + 1 });
      return;
    }
    set({ txDepth: 1, txLabel: label, txSnapshot: s.design });
  },

  commit: () => {
    const s = get();
    if (s.txDepth === 0) return;
    if (s.txDepth > 1) {
      set({ txDepth: s.txDepth - 1 });
      return;
    }
    const before = s.txSnapshot!;
    const changed = before !== s.design;
    set({
      txDepth: 0,
      txLabel: null,
      txSnapshot: null,
      past: changed
        ? [...s.past, { design: before, label: s.txLabel ?? 'Edit' }].slice(-HISTORY_LIMIT)
        : s.past,
      future: changed ? [] : s.future,
      design: changed
        ? produce(s.design, (d) => {
            d.updatedAt = Date.now();
          })
        : s.design,
    });
  },

  rollback: () => {
    const s = get();
    if (s.txDepth === 0) return;
    set({
      design: s.txSnapshot ?? s.design,
      txDepth: 0,
      txLabel: null,
      txSnapshot: null,
      revision: s.revision + 1,
    });
  },

  undo: () => {
    const s = get();
    if (s.txDepth > 0) return;
    const prev = s.past[s.past.length - 1];
    if (!prev) return;
    set({
      design: prev.design,
      past: s.past.slice(0, -1),
      future: [{ design: s.design, label: prev.label }, ...s.future].slice(0, HISTORY_LIMIT),
      revision: s.revision + 1,
    });
  },

  redo: () => {
    const s = get();
    if (s.txDepth > 0) return;
    const next = s.future[0];
    if (!next) return;
    set({
      design: next.design,
      past: [...s.past, { design: s.design, label: next.label }].slice(-HISTORY_LIMIT),
      future: s.future.slice(1),
      revision: s.revision + 1,
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  load: (design) =>
    set((s) => ({
      design: migrateDesign(design),
      past: [],
      future: [],
      txDepth: 0,
      txLabel: null,
      txSnapshot: null,
      revision: s.revision + 1,
    })),

  reset: () =>
    set((s) => ({
      design: emptyDesign(newDesignId()),
      past: [],
      future: [],
      txDepth: 0,
      txLabel: null,
      txSnapshot: null,
      revision: s.revision + 1,
    })),

  rename: (name) => get().transact('Rename', (d) => void (d.name = name)),
}));

// ── selectors ────────────────────────────────────────────────────────────────

export const selectParts = (s: DesignStore) => s.design.parts;
export const selectWires = (s: DesignStore) => s.design.wires;
export const selectNotes = (s: DesignStore) => s.design.notes;

export const getPart = (id: string): PartInstance | undefined =>
  useDesignStore.getState().design.parts[id];
export const getWire = (id: string): Wire | undefined =>
  useDesignStore.getState().design.wires[id];
export const getNote = (id: string): Note | undefined =>
  useDesignStore.getState().design.notes[id];

/** Next paint order for a newly placed part. */
export function nextZ(): number {
  const parts = useDesignStore.getState().design.parts;
  let max = 0;
  for (const k in parts) max = Math.max(max, parts[k].z);
  return max + 1;
}
