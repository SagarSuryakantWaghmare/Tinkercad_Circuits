'use client';

import { useDesignStore } from '@/state/designStore';
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

  const ed = useEditorStore();
  const running = useSimStore((s) => s.runState === 'running' || s.runState === 'paused');
  const hasSelection = ed.selectedParts.length + ed.selectedWires.length > 0;
  // Editing the design while the sim is running would rebuild the netlist
  // mid-run, which is fine for wire tweaks but usually not what the user
  // intends when they hit Delete or Rotate. Grey those affordances.
  const editDisabled = running;

  const rotate = () =>
    transact('Rotate', (d) => {
      for (const id of ed.selectedParts) {
        const p = d.parts[id];
        if (p) p.rotation = (p.rotation + 90) % 360;
      }
    });

  const mirror = () =>
    transact('Mirror', (d) => {
      for (const id of ed.selectedParts) {
        const p = d.parts[id];
        if (p) p.mirrored = !p.mirrored;
      }
    });

  const remove = () => {
    transact('Delete', (d) => {
      for (const id of ed.selectedParts) {
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
      for (const id of ed.selectedWires) delete d.wires[id];
    });
    ed.clearSelection();
  };

  return (
    <div
      className="flex h-11 shrink-0 items-center gap-1 border-b border-neutral-200 bg-neutral-50 px-2"
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
          new users can drag the canvas around without hunting for space-bar. */}
      <TBtn
        title="Select (V)"
        active={!ed.handTool}
        onClick={() => ed.setHandTool(false)}
      >
        <IconCursor />
      </TBtn>
      <TBtn
        title="Pan / hand tool (H) — drag the canvas"
        active={ed.handTool}
        onClick={() => ed.setHandTool(!ed.handTool)}
      >
        <IconHand />
      </TBtn>

      <Divider />

      <TBtn
        title="Rotate (R)"
        disabled={editDisabled || !ed.selectedParts.length}
        onClick={rotate}
      >
        <IconRotate />
      </TBtn>
      <TBtn
        title="Mirror"
        disabled={editDisabled || !ed.selectedParts.length}
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
        disabled={editDisabled || !ed.selectedParts.length}
        onClick={() =>
          transact('Send to back', (d) => {
            let lo = Infinity;
            for (const k in d.parts) lo = Math.min(lo, d.parts[k].z);
            let step = 0;
            for (const id of ed.selectedParts)
              if (d.parts[id]) d.parts[id].z = lo - 1 - step++;
          })
        }
      >
        <span className="inline-block px-0.5 text-[14px] font-bold leading-none">[</span>
      </TBtn>
      <TBtn
        title="Bring to front ( ] )"
        disabled={editDisabled || !ed.selectedParts.length}
        onClick={() =>
          transact('Bring to front', (d) => {
            let hi = -Infinity;
            for (const k in d.parts) hi = Math.max(hi, d.parts[k].z);
            let step = 0;
            for (const id of ed.selectedParts)
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
        title={ed.notesVisible ? 'Hide notes (Shift+N)' : 'Show notes (Shift+N)'}
        onClick={ed.toggleNotes}
      >
        {ed.notesVisible ? <IconEye /> : <IconEyeOff />}
      </TBtn>

      <Divider />

      <div className="flex items-center gap-1.5 pl-1">
        <span className="text-[11px] font-medium text-neutral-500">Wire</span>
        {WIRE_COLORS.map((c) => (
          <button
            key={c.key}
            title={`${c.name} (${c.key})`}
            aria-label={`Wire colour ${c.name}`}
            aria-pressed={ed.wireColor === c.key}
            onClick={() => {
              ed.setWireColor(c.key);
              if (ed.selectedWires.length) {
                transact('Wire colour', (d) => {
                  for (const id of ed.selectedWires) if (d.wires[id]) d.wires[id].color = c.key;
                });
              }
            }}
            className={`h-[15px] w-[15px] rounded-full border transition ${
              ed.wireColor === c.key
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
            onClick={() => ed.setComponentView(v)}
            className={`rounded px-2 py-1 text-[11.5px] font-medium capitalize transition ${
              ed.componentView === v
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
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
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
      className={
        active
          ? 'rounded bg-sky-100 p-1.5 text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-200'
          : 'rounded p-1.5 text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent'
      }
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-neutral-300" />;
