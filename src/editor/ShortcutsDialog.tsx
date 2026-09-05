'use client';

import { useEffect } from 'react';

const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Editing',
    rows: [
      ['Undo', 'Ctrl Z'],
      ['Redo', 'Ctrl Y  /  Ctrl Shift Z'],
      ['Copy', 'Ctrl C'],
      ['Paste', 'Ctrl V'],
      ['Duplicate', 'Ctrl D'],
      ['Delete selection', 'Delete'],
      ['Select all', 'Ctrl A'],
    ],
  },
  {
    title: 'Arranging',
    rows: [
      ['Rotate 30° (90° when socketed)', 'R'],
      ['Mirror', 'M'],
      ['Nudge 5 units', 'Arrow keys'],
      ['Nudge 50 units', 'Shift + arrows'],
      ['Bring to front', ']'],
      ['Send to back', '['],
    ],
  },
  {
    title: 'View',
    rows: [
      ['Zoom to fit', 'F'],
      ['Zoom to selection', 'Shift F'],
      ['Zoom in / out', 'Ctrl + scroll'],
      ['Pan', 'Space + drag  /  middle drag'],
      ['Show terminal names', 'hover a pin'],
    ],
  },
  {
    title: 'Wiring and notes',
    rows: [
      ['Wire colour', '0 – 9'],
      ['New note', 'N'],
      ['Show / hide notes', 'Shift N'],
      ['Cancel the current wire', 'Esc'],
    ],
  },
  {
    title: 'Simulation',
    rows: [
      ['Start / stop simulation', 'S'],
      ['Open the code panel', 'C'],
      ['Toggle a breakpoint', 'click a line number'],
      ['This list', '?'],
    ],
  },
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-full w-[720px] max-w-full overflow-auto rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-neutral-800">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-[12px] text-neutral-500 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {g.title}
              </h3>
              <dl className="space-y-1">
                {g.rows.map(([label, keys]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4">
                    <dt className="text-[12.5px] text-neutral-700">{label}</dt>
                    <dd className="shrink-0 font-mono text-[11px] text-neutral-500">{keys}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
