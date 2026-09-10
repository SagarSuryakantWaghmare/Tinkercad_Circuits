'use client';

import { create } from 'zustand';
import type { Vec2, Rect } from '@/lib/geometry';
import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '@/lib/units';

/** What the pointer is currently doing on the canvas. */
export type CanvasMode =
  | { kind: 'idle' }
  | { kind: 'pan'; last: Vec2 }
  | { kind: 'dragParts'; origin: Vec2; moved: boolean }
  | { kind: 'dragNewPart'; partType: string; at: Vec2; valid: boolean }
  | { kind: 'drawWire'; from: WireAnchor; points: Vec2[]; cursor: Vec2; toward: WireAnchor | null }
  | { kind: 'marquee'; from: Vec2; to: Vec2; additive: boolean }
  | { kind: 'dragWaypoint'; wireId: string; index: number };

export interface WireAnchor {
  partId: string;
  terminal: string;
  /** World position of the terminal at anchor time. */
  pos: Vec2;
  dir: [number, number];
}

export type ComponentView = 'top' | 'wires' | 'schematic';
export type PanelView = 'basic' | 'all' | 'starters';

interface EditorStore {
  // viewport ────────────────────────────────────────────────────────────────
  /** Pan is stored in world units; the scene uses scale(z) translate(pan). */
  pan: Vec2;
  zoom: number;
  /** Live canvas pixel size, kept for fit-to-content and screen↔world maths. */
  viewport: { w: number; h: number };
  setViewport: (w: number, h: number) => void;
  setPan: (p: Vec2) => void;
  panBy: (dxScreen: number, dyScreen: number) => void;
  setZoom: (z: number, anchorScreen?: Vec2) => void;
  zoomBy: (factor: number, anchorScreen?: Vec2) => void;
  fitTo: (bounds: Rect | null) => void;

  toWorld: (screen: Vec2) => Vec2;
  toScreen: (world: Vec2) => Vec2;

  // selection ───────────────────────────────────────────────────────────────
  selectedParts: string[];
  selectedWires: string[];
  selectedNotes: string[];
  select: (sel: {
    parts?: string[];
    wires?: string[];
    notes?: string[];
    additive?: boolean;
  }) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;

  // hover ───────────────────────────────────────────────────────────────────
  hoverTerminal: { partId: string; terminal: string } | null;
  setHoverTerminal: (t: { partId: string; terminal: string } | null) => void;
  hoverPart: string | null;
  setHoverPart: (id: string | null) => void;

  // pointer state machine ───────────────────────────────────────────────────
  mode: CanvasMode;
  setMode: (m: CanvasMode) => void;

  // panels & view ───────────────────────────────────────────────────────────
  codeOpen: boolean;
  /** Stop components being destroyed; report what would have happened instead. */
  protectComponents: boolean;
  setProtectComponents: (v: boolean) => void;
  setCodeOpen: (v: boolean) => void;
  panelView: PanelView;
  setPanelView: (v: PanelView) => void;
  panelCategory: string;
  setPanelCategory: (v: string) => void;
  panelSearch: string;
  setPanelSearch: (v: string) => void;
  componentView: ComponentView;
  setComponentView: (v: ComponentView) => void;
  notesVisible: boolean;
  toggleNotes: () => void;
  setNotesVisible: (v: boolean) => void;
  /** Colour applied to the next drawn wire. */
  wireColor: string;
  setWireColor: (c: string) => void;
  /** Part chosen in the panel, awaiting a click on the canvas. */
  pendingPart: string | null;
  setPendingPart: (id: string | null) => void;

  toast: { text: string; kind: 'info' | 'warn' | 'error' } | null;
  setToast: (t: EditorStore['toast']) => void;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  pan: { x: 0, y: 0 },
  zoom: ZOOM_DEFAULT,
  viewport: { w: 1200, h: 800 },

  setViewport: (w, h) => set({ viewport: { w, h } }),
  setPan: (p) => set({ pan: p }),

  panBy: (dxScreen, dyScreen) => {
    const { pan, zoom } = get();
    set({ pan: { x: pan.x + dxScreen / zoom, y: pan.y + dyScreen / zoom } });
  },

  setZoom: (z, anchorScreen) => {
    const s = get();
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    if (!anchorScreen) return set({ zoom: next });
    // Keep the world point under the cursor pinned across the zoom change.
    const wx = anchorScreen.x / s.zoom - s.pan.x;
    const wy = anchorScreen.y / s.zoom - s.pan.y;
    set({
      zoom: next,
      pan: { x: anchorScreen.x / next - wx, y: anchorScreen.y / next - wy },
    });
  },

  zoomBy: (factor, anchorScreen) => get().setZoom(get().zoom * factor, anchorScreen),

  fitTo: (bounds) => {
    const { viewport } = get();
    if (!bounds || bounds.w <= 0 || bounds.h <= 0) {
      return set({ zoom: ZOOM_DEFAULT, pan: { x: viewport.w / 2, y: viewport.h / 2 } });
    }
    const pad = 80;
    const z = Math.max(
      ZOOM_MIN,
      Math.min(
        ZOOM_MAX,
        Math.min(
          (viewport.w - pad * 2) / bounds.w,
          (viewport.h - pad * 2) / bounds.h,
        ),
      ),
    );
    set({
      zoom: z,
      pan: {
        x: viewport.w / (2 * z) - (bounds.x + bounds.w / 2),
        y: viewport.h / (2 * z) - (bounds.y + bounds.h / 2),
      },
    });
  },

  toWorld: (screen) => {
    const { pan, zoom } = get();
    return { x: screen.x / zoom - pan.x, y: screen.y / zoom - pan.y };
  },

  toScreen: (world) => {
    const { pan, zoom } = get();
    return { x: (world.x + pan.x) * zoom, y: (world.y + pan.y) * zoom };
  },

  selectedParts: [],
  selectedWires: [],
  selectedNotes: [],

  select: ({ parts = [], wires = [], notes = [], additive = false }) =>
    set((s) =>
      additive
        ? {
            selectedParts: [...new Set([...s.selectedParts, ...parts])],
            selectedWires: [...new Set([...s.selectedWires, ...wires])],
            selectedNotes: [...new Set([...s.selectedNotes, ...notes])],
          }
        : { selectedParts: parts, selectedWires: wires, selectedNotes: notes },
    ),

  clearSelection: () =>
    set({ selectedParts: [], selectedWires: [], selectedNotes: [] }),

  isSelected: (id) => {
    const s = get();
    return (
      s.selectedParts.includes(id) ||
      s.selectedWires.includes(id) ||
      s.selectedNotes.includes(id)
    );
  },

  hoverTerminal: null,
  setHoverTerminal: (t) => set({ hoverTerminal: t }),
  hoverPart: null,
  setHoverPart: (id) => set({ hoverPart: id }),

  mode: { kind: 'idle' },
  setMode: (m) => set({ mode: m }),

  codeOpen: false,
  protectComponents: false,
  setProtectComponents: (protectComponents) => set({ protectComponents }),
  setCodeOpen: (v) => set({ codeOpen: v }),
  panelView: 'basic',
  setPanelView: (v) => set({ panelView: v }),
  panelCategory: 'all',
  setPanelCategory: (v) => set({ panelCategory: v }),
  panelSearch: '',
  setPanelSearch: (v) => set({ panelSearch: v }),
  componentView: 'top',
  setComponentView: (v) => set({ componentView: v }),
  notesVisible: true,
  toggleNotes: () => set((s) => ({ notesVisible: !s.notesVisible })),
  setNotesVisible: (notesVisible) => set({ notesVisible }),
  wireColor: '0',
  setWireColor: (c) => set({ wireColor: c }),
  pendingPart: null,
  setPendingPart: (id) => set({ pendingPart: id }),

  toast: null,
  setToast: (t) => set({ toast: t }),
}));
