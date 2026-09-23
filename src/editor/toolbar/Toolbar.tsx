'use client';

import { useDesignStore } from '@/state/designStore';
import { rotationStepFor } from '@/canvas/snapping';
import { useEditorStore } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import { WIRE_COLORS } from '@/lib/tokens';
import {
  IconCursor,
  IconEye,
  IconEyeOff,
  IconHand,
  IconKeyboard,
  IconMirror,
  IconNote,
  IconRedo,
  IconRotate,
  IconTrash,
  IconUndo,
} from '../icons';

export function Toolbar() {
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const past = useDesignStore((s) => s.past.length);
  const future = useDesignStore((s) => s.future.length);
  const transact = useDesignStore((s) => s.transact);

  // Narrow selectors, not the whole store: editorStore also holds pan, zoom,
  // mode and the hover targets, every one of which is written on each
  // pointermove of a pan, a drag, a marquee or a wire. Subscribing to all of
  // it re-rendered the toolbar's thirty-odd buttons and swatches at pointer
  // rate, competing with the canvas for the same frame.
  const handTool = useEditorStore((s) => s.handTool);
  const componentView = useEditorStore((s) => s.componentView);
  const notesVisible = useEditorStore((s) => s.notesVisible);
  const wireColor = useEditorStore((s) => s.wireColor);
  const selectedParts = useEditorStore((s) => s.selectedParts);
  const selectedWires = useEditorStore((s) => s.selectedWires);
  const setHandTool = useEditorStore((s) => s.setHandTool);
  const setComponentView = useEditorStore((s) => s.setComponentView);
  const setWireColor = useEditorStore((s) => s.setWireColor);
  const toggleNotes = useEditorStore((s) => s.toggleNotes);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const running = useSimStore((s) => s.runState === 'running' || s.runState === 'paused');
  const hasSelection = selectedParts.length + selectedWires.length > 0;
  // Editing the design while the sim is running would rebuild the netlist
  // mid-run, which is fine for wire tweaks but usually not what the user
  // intends when they hit Delete or Rotate. Grey those affordances.
  const editDisabled = running;

  const rotate = () =>
    transact('Rotate', (d) => {
      for (const id of selectedParts) {
        const p = d.parts[id];
        // The same step the R key and the context menu use: 90 degrees once a
        // part can socket, 30 otherwise. Hardcoding 90 here meant the button
        // and the shortcut turned the same selection by different amounts.
        if (p) p.rotation = (p.rotation + rotationStepFor(p)) % 360;
      }
    });

  const mirror = () =>
    transact('Mirror', (d) => {
      for (const id of selectedParts) {
        const p = d.parts[id];
        if (p) p.mirrored = !p.mirrored;
      }
    });

  const remove = () => {
    transact('Delete', (d) => {
      for (const id of selectedParts) {
        delete d.parts[id];
        for (const wid in d.wires) {
          const w = d.wires[wid];
          if (
            (w.a.kind === 'terminal' && w.a.partId === id) ||
            (w.b.kind === 'terminal' && w.b.partId === id)
          )
            delete d.wires[wid];
        }
      }
      for (const id of selectedWires) delete d.wires[id];
    });
    clearSelection();
  };

  return (
    <div
      className="flex h-11 shrink-0 items-center gap-1 border-b border-neutral-300 bg-white px-2 shadow-sm"
      role="toolbar"
      aria-label="Editing tools"
    >
      <TBtn title="Undo (Ctrl+Z)" disabled={past === 0} onClick={undo}>
        <IconUndo />
      </TBtn>
      <TBtn title="Redo (Ctrl+Shift+Z)" disabled={future === 0} onClick={redo}>
        <IconRedo />
      </TBtn>

      <Divider />

      {/* Select vs pan (hand). The reference product carries the same pair so
          new users can drag the canvas around without hunting for space-bar.
          Wrapped in a labelled segmented control so the mode toggle reads as
          a first-class control instead of blending into the icon strip. */}
      <span className="pl-1 text-[11px] font-medium text-neutral-500">Tool:</span>
      <div
        className="flex items-center gap-0.5 rounded-md border border-neutral-300 bg-neutral-50 p-0.5"
        role="group"
        aria-label="Pointer tool"
      >
        <TBtn
          title="Select tool (V) — click to select or drag components"
          active={!handTool}
          onClick={() => setHandTool(false)}
        >
          <IconCursor />
        </TBtn>
        <TBtn
          title="Pan / hand tool (H) — drag the canvas"
          active={handTool}
          prominent={handTool}
          onClick={() => setHandTool(!handTool)}
        >
          <IconHand />
          {handTool && (
            <span className="ml-1 text-[10px] font-bold uppercase leading-none tracking-wide">
              Pan
            </span>
          )}
        </TBtn>
      </div>

      <Divider />

      <TBtn
        title="Rotate (R)"
        disabled={editDisabled || !selectedParts.length}
        onClick={rotate}
      >
        <IconRotate />
      </TBtn>
      <TBtn
        title="Mirror"
        disabled={editDisabled || !selectedParts.length}
        onClick={mirror}
      >
        <IconMirror />
      </TBtn>
      <TBtn
        title="Delete (Del)"
        disabled={editDisabled || !hasSelection}
        onClick={remove}
      >
        <IconTrash />
      </TBtn>

      <Divider />

      {/* Stacking order — matches the right-click menu, exposed in the
          toolbar so students discover it. Bracket icons are the app-wide
          keyboard bindings, so putting them on the buttons keeps the
          mapping visible. */}
      <TBtn
        title="Send to back ( [ )"
        disabled={editDisabled || !selectedParts.length}
        onClick={() =>
          transact('Send to back', (d) => {
            let lo = Infinity;
            for (const k in d.parts) lo = Math.min(lo, d.parts[k].z);
            let step = 0;
            for (const id of selectedParts)
              if (d.parts[id]) d.parts[id].z = lo - 1 - step++;
          })
        }
      >
        <span className="inline-block px-0.5 text-[14px] font-bold leading-none">[</span>
      </TBtn>
      <TBtn
        title="Bring to front ( ] )"
        disabled={editDisabled || !selectedParts.length}
        onClick={() =>
          transact('Bring to front', (d) => {
            let hi = -Infinity;
            for (const k in d.parts) hi = Math.max(hi, d.parts[k].z);
            let step = 0;
            for (const id of selectedParts)
              if (d.parts[id]) d.parts[id].z = hi + 1 + step++;
          })
        }
      >
        <span className="inline-block px-0.5 text-[14px] font-bold leading-none">]</span>
      </TBtn>

      <Divider />

      <TBtn
        title="Create note (N)"
        onClick={() => window.dispatchEvent(new CustomEvent('circuitlab:new-note'))}
      >
        <IconNote />
      </TBtn>
      <TBtn
        title={notesVisible ? 'Hide notes (Shift+N)' : 'Show notes (Shift+N)'}
        onClick={toggleNotes}
      >
        {notesVisible ? <IconEye /> : <IconEyeOff />}
      </TBtn>

      <Divider />

      <div className="flex items-center gap-1.5 pl-1">
        <span className="text-[11px] font-medium text-neutral-500">Wire</span>
        {WIRE_COLORS.map((c) => (
          <button
            key={c.key}
            title={`${c.name} (${c.key})`}
            aria-label={`Wire colour ${c.name}`}
            aria-pressed={wireColor === c.key}
            onClick={() => {
              setWireColor(c.key);
              if (selectedWires.length) {
                transact('Wire colour', (d) => {
                  for (const id of selectedWires) if (d.wires[id]) d.wires[id].color = c.key;
                });
              }
            }}
            className={`h-[15px] w-[15px] rounded-full border transition ${
              wireColor === c.key
                ? 'border-sky-500 ring-2 ring-sky-200'
                : 'border-neutral-300 hover:scale-110'
            }`}
            style={{ background: c.hex }}
          />
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {running && (
          <span
            className="mr-2 flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-block h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Simulating
          </span>
        )}
        <span className="text-[11px] font-medium text-neutral-500">View</span>
        {(['top', 'wires', 'schematic'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setComponentView(v)}
            className={`rounded px-2 py-1 text-[11.5px] font-medium capitalize transition ${
              componentView === v
                ? 'bg-sky-50 text-sky-700'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {v}
          </button>
        ))}
        <Divider />
        <TBtn
          title="Keyboard shortcuts (?)"
          onClick={() => window.dispatchEvent(new CustomEvent('circuitlab:shortcuts'))}
        >
          <IconKeyboard />
        </TBtn>
      </div>
    </div>
  );
}

function TBtn({
  children,
  title,
  onClick,
  disabled,
  active,
  prominent,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  // `prominent` upgrades the active state to a high-contrast fill so a mode
  // change (e.g. entering the hand/pan tool) is unmissable at a glance.
  prominent?: boolean;
}) {
  const base = 'inline-flex items-center rounded p-1.5 transition';
  const cls = active
    ? prominent
      ? `${base} bg-sky-500 text-white shadow-sm hover:bg-sky-600`
      : `${base} bg-sky-100 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-200`
    : `${base} text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent`;
  return (
    <button
      title={title}
      // title alone isn't reliably announced by screen readers — mirror it as
      // the accessible name so every icon-only button in the toolbar is
      // still labelled for keyboard and AT users.
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cls}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-neutral-300" />;
