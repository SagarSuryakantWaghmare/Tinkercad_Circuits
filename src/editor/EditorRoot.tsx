'use client';

import { useEffect, useRef, useState } from 'react';
import '@/parts'; // registers the component library

import { CanvasRoot } from '@/canvas/CanvasRoot';
import { TopBar } from './topbar/TopBar';
import { Toolbar } from './toolbar/Toolbar';
import { ComponentPanel } from './dock/ComponentPanel';
import { Inspector } from './inspector/Inspector';
import { CodePanel } from './code/CodePanel';
import { contentBounds, useHotkeys } from './useHotkeys';
import { ShortcutsDialog } from './ShortcutsDialog';
import { useSimulation } from '@/sim/useSimulation';
import { useEditorStore } from '@/state/editorStore';
import { useDesignStore } from '@/state/designStore';
import { allParts, getPartDef } from '@/parts/registry';
import { snapPlacement } from '@/canvas/snapping';
import { useSimStore } from '@/state/simStore';
import { buildNetlist } from '@/sim/net/buildNetlist';
import { useAutosave } from '@/persist/useAutosave';
import { loadDesign, saveDesign } from '@/persist/store';
import { emptyDesign } from '@/state/design';
import { STARTERS } from '@/starters';
import { IconFit, IconMinus, IconPlus } from './icons';

export function EditorRoot({ designId }: { designId?: string }) {
  useHotkeys();

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    const open = () => setShortcutsOpen(true);
    window.addEventListener('circuitlab:shortcuts', open);
    return () => window.removeEventListener('circuitlab:shortcuts', open);
  }, []);
  const sim = useSimulation();
  const stageRef = useRef<HTMLDivElement>(null);
  const pendingPart = useEditorStore((s) => s.pendingPart);
  const [ready, setReady] = useState(!designId);

  // Open the requested design, creating it if this is a fresh id.
  useEffect(() => {
    if (!designId) return;
    let cancelled = false;
    (async () => {
      const existing = await loadDesign(designId).catch(() => undefined);
      if (cancelled) return;
      const design = existing ?? emptyDesign(designId);
      useDesignStore.getState().load(design);
      if (!existing) void saveDesign(design).catch(() => {});
      setReady(true);
      setTimeout(() => useEditorStore.getState().fitTo(contentBounds()), 60);
    })();
    return () => {
      cancelled = true;
    };
  }, [designId]);

  useAutosave(ready);

  // Dev-only handles so the editor can be driven and inspected from a console
  // or a headless browser without going through pointer events.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as unknown as Record<string, unknown>).__cl = {
      design: useDesignStore,
      editor: useEditorStore,
      sim: useSimStore,
      parts: { allParts, getPartDef },
      starters: STARTERS,
      buildNetlist,
      snapPlacement,
    };
  }, []);

  // Centre the empty canvas on first paint.
  useEffect(() => {
    const t = setTimeout(() => useEditorStore.getState().fitTo(contentBounds()), 60);
    return () => clearTimeout(t);
  }, []);

  // Drag-and-drop from the components panel.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/part') || useEditorStore.getState().pendingPart;
    if (!type || !getPartDef(type)) return;
    const rect = stageRef.current!.getBoundingClientRect();
    const at = useEditorStore
      .getState()
      .toWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    const ds = useDesignStore.getState();
    let created = '';
    ds.transact('Add component', (d) => {
      const def = getPartDef(type)!;
      const id = `p_${Math.random().toString(36).slice(2, 10)}`;
      let z = 0;
      for (const k in d.parts) z = Math.max(z, d.parts[k].z);
      const inst = {
        id,
        type,
        x: at.x,
        y: at.y,
        rotation: 0,
        mirrored: false,
        props: { ...(def.defaults as Record<string, never>) },
        z: z + 1,
      };
      const snapped = snapPlacement(d, inst, at, new Set([id]));
      inst.x = snapped.x;
      inst.y = snapped.y;
      d.parts[id] = inst;
      created = id;
    });
    useEditorStore.getState().select({ parts: [created] });
    useEditorStore.getState().setPendingPart(null);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-100 text-neutral-900">
      <TopBar />
      <Toolbar />

      <div className="flex min-h-0 flex-1">
        <main
          ref={stageRef}
          className="relative min-w-0 flex-1"
          aria-label="Circuit canvas"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={onDrop}
        >
          <CanvasRoot />

          {/* Zoom rail, docked bottom-right the way Tinkercad does. */}
          <div className="pointer-events-auto absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full border border-neutral-200 bg-white/95 p-0.5 shadow-sm backdrop-blur">
            <ZoomBtn title="Zoom out" onClick={() => useEditorStore.getState().zoomBy(0.8)}>
              <IconMinus width={16} height={16} />
            </ZoomBtn>
            <ZoomReadoutPill />
            <ZoomBtn title="Zoom in" onClick={() => useEditorStore.getState().zoomBy(1.25)}>
              <IconPlus width={16} height={16} />
            </ZoomBtn>
            <span className="mx-0.5 h-4 w-px bg-neutral-200" />
            <ZoomBtn
              title="Zoom to fit (F)"
              onClick={() => useEditorStore.getState().fitTo(contentBounds())}
            >
              <IconFit width={16} height={16} />
            </ZoomBtn>
          </div>

          {pendingPart && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-neutral-900/85 px-3 py-1.5 text-[12px] font-medium text-white">
              Click the workspace to place · Esc to cancel
            </div>
          )}

          {/* floating inspector */}
          <div className="pointer-events-none absolute right-3 top-3">
            <Inspector />
          </div>

          <ZoomReadout />
          <Toast />
          {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}
        </main>

        <ComponentPanel />
      </div>

      <CodePanel
        onSendSerial={(text) => sim.current?.sendSerial(text)}
        onSetBreakpoints={(lines) => sim.current?.setBreakpoints(lines)}
        onResume={() => sim.current?.resumeFromBreakpoint()}
        onStepOver={() => sim.current?.stepOver()}
      />
    </div>
  );
}

function ZoomBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded-full p-1.5 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </button>
  );
}

/** Inline zoom percent between the − and + buttons, as the reference product shows. */
function ZoomReadoutPill() {
  const zoom = useEditorStore((s) => s.zoom);
  return (
    <span className="min-w-[42px] text-center text-[11.5px] font-semibold tabular-nums text-neutral-600">
      {Math.round(zoom * 100)}%
    </span>
  );
}

/** Transient status message, cleared automatically. */
function Toast() {
  const toast = useEditorStore((s) => s.toast);
  const setToast = useEditorStore((s) => s.setToast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast, setToast]);
  if (!toast) return null;
  const tone =
    toast.kind === 'error'
      ? 'bg-red-600'
      : toast.kind === 'warn'
        ? 'bg-amber-500'
        : 'bg-neutral-900';
  return (
    <div
      className={`pointer-events-auto absolute bottom-4 left-1/2 z-20 max-w-md -translate-x-1/2 rounded-lg px-3.5 py-2 text-[12.5px] font-medium text-white shadow-lg ${tone}`}
      onClick={() => setToast(null)}
      role="status"
      aria-live="polite"
    >
      {toast.text}
    </div>
  );
}

function ZoomReadout() {
  // Bottom-left status bar: no longer carries the zoom % (that moved into the
  // zoom rail), but still shows the piece counts and, while running, the
  // simulated clock — which is where Tinkercad keeps its status too.
  const parts = useDesignStore((s) => Object.keys(s.design.parts).length);
  const wires = useDesignStore((s) => Object.keys(s.design.wires).length);
  const running = useSimStore((s) => s.runState !== 'idle');
  const elapsed = useSimStore((s) => s.elapsed);
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-md bg-white/85 px-2.5 py-1 text-[11px] font-medium text-neutral-500 shadow-sm backdrop-blur">
      <span>
        {parts} component{parts === 1 ? '' : 's'}
      </span>
      <span>
        {wires} wire{wires === 1 ? '' : 's'}
      </span>
      {running && (
        <span className="tabular-nums text-emerald-700">{formatElapsed(elapsed)} simulated</span>
      )}
    </div>
  );
}

/** Elapsed simulated time, in the largest unit that stays readable. */
function formatElapsed(seconds: number) {
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)} ms`;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${(seconds - m * 60).toFixed(1)}s`;
}
