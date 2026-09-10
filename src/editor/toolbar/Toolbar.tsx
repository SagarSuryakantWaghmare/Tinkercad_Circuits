'use client';

import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { WIRE_COLORS } from '@/lib/tokens';
import {
  IconEye,
  IconEyeOff,
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
  const hasSelection = ed.selectedParts.length + ed.selectedWires.length > 0;

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
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-neutral-200 bg-white px-2">
      <TBtn title="Undo (Ctrl+Z)" disabled={past === 0} onClick={undo}>
        <IconUndo />
      </TBtn>
      <TBtn title="Redo (Ctrl+Shift+Z)" disabled={future === 0} onClick={redo}>
        <IconRedo />
      </TBtn>

      <Divider />

      <TBtn title="Rotate (R)" disabled={!ed.selectedParts.length} onClick={rotate}>
        <IconRotate />
      </TBtn>
      <TBtn title="Mirror" disabled={!ed.selectedParts.length} onClick={mirror}>
        <IconMirror />
      </TBtn>
      <TBtn title="Delete (Del)" disabled={!hasSelection} onClick={remove}>
        <IconTrash />
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
        <button
          onClick={() => ed.setProtectComponents(!ed.protectComponents)}
          title={
            ed.protectComponents
              ? 'Protection on: parts report what would have destroyed them and survive it'
              : 'Protection off: over-driven parts are destroyed, as they would be on a bench'
          }
          className={`rounded px-2 py-1 text-[11.5px] font-medium transition ${
            ed.protectComponents
              ? 'bg-emerald-50 text-emerald-700'
              : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          {ed.protectComponents ? 'Protected' : 'Protect'}
        </button>
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
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1.5 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-neutral-200" />;
