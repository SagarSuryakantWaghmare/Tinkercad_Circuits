'use client';

import { useEffect, useRef, useState } from 'react';
import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import {
  componentList,
  exportComponentCsv,
  exportDesignJson,
  exportPng,
  exportSketch,
  exportSvg,
  importDesignJson,
} from '@/persist/exporters';
import { IconExport } from '../icons';

export function SendToMenu() {
  const [open, setOpen] = useState(false);
  const [showBom, setShowBom] = useState(false);
  const design = useDesignStore((s) => s.design);
  const load = useDesignStore((s) => s.load);
  const setToast = useEditorStore((s) => s.setToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener('circuitlab:export', openMenu);
    return () => window.removeEventListener('circuitlab:export', openMenu);
  }, []);

  const run = async (fn: () => void | Promise<void>, label: string) => {
    try {
      await fn();
      setOpen(false);
    } catch (e) {
      setToast({
        text: e instanceof Error ? e.message : `Could not export ${label}.`,
        kind: 'error',
      });
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 px-3 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-50"
      >
        <IconExport width={15} height={15} />
        Send To
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-64 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          <Group>Download</Group>
          <Item onClick={() => run(() => exportDesignJson(design), 'the design')}>
            Design file (.circuit.json)
            <Hint>Everything — parts, wiring and code.</Hint>
          </Item>
          <Item onClick={() => run(() => exportSketch(design), 'the sketch')}>
            Arduino sketch (.ino)
          </Item>
          <Item onClick={() => run(() => exportPng(design), 'a PNG')}>Image (.png)</Item>
          <Item onClick={() => run(() => exportSvg(design), 'an SVG')}>
            Vector image (.svg)
          </Item>
          <Item onClick={() => run(() => exportComponentCsv(design), 'the component list')}>
            Component list (.csv)
          </Item>

          <div className="my-1 h-px bg-neutral-100" />
          <Group>Open</Group>
          <Item onClick={() => fileRef.current?.click()}>Import a design file…</Item>
          <Item
            onClick={() => {
              setShowBom(true);
              setOpen(false);
            }}
          >
            View component list
          </Item>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,.circuit.json,application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            load(await importDesignJson(file));
            setOpen(false);
            setToast({ text: 'Design imported.', kind: 'info' });
          } catch (err) {
            setToast({
              text: err instanceof Error ? err.message : 'Could not read that file.',
              kind: 'error',
            });
          }
        }}
      />

      {showBom && <BomDialog onClose={() => setShowBom(false)} />}
    </div>
  );
}

function BomDialog({ onClose }: { onClose: () => void }) {
  const design = useDesignStore((s) => s.design);
  const rows = componentList(design);
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-neutral-900/25 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-[520px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-neutral-900">Component list</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-[12px] text-neutral-500 hover:bg-neutral-100"
          >
            Close
          </button>
        </header>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-neutral-400">
            Nothing placed yet.
          </p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-16 px-4 py-2 font-semibold">Qty</th>
                <th className="px-2 py-2 font-semibold">Component</th>
                <th className="px-2 py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-mono text-neutral-600">{r.count}</td>
                  <td className="px-2 py-2 text-neutral-800">{r.name}</td>
                  <td className="px-2 py-2 text-neutral-500">{r.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const Group = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 py-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
    {children}
  </p>
);

function Item({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-[12.5px] text-neutral-800 transition hover:bg-sky-50"
    >
      {children}
    </button>
  );
}

const Hint = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-0.5 block text-[11px] text-neutral-400">{children}</span>
);
