'use client';

import { useMemo, useState } from 'react';
import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { STARTER_CATEGORIES, STARTERS, type Starter } from '@/starters';
import { contentBounds } from '../useHotkeys';

/**
 * Starters. Dropping one in places its components, its wiring and its code —
 * pressing Start Simulation immediately afterwards is the whole point, so a
 * starter replaces the workspace rather than merging into it when the design
 * is empty, and offers to replace when it is not.
 */
export function StartersDrawer() {
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const load = useDesignStore((s) => s.transact);
  const design = useDesignStore((s) => s.design);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STARTERS.filter(
      (s) =>
        (category === 'all' || s.category === category) &&
        (!q || s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)),
    );
  }, [category, search]);

  const place = (starter: Starter) => {
    const busy = Object.keys(design.parts).length > 0;
    if (busy) {
      const ok = window.confirm(
        `Replace the current design with “${starter.name}”?\n\nYour existing components and code will be cleared. Undo brings them back.`,
      );
      if (!ok) return;
    }

    const content = starter.build();
    load(`Starter: ${starter.name}`, (d) => {
      d.parts = {};
      d.wires = {};
      for (const p of content.parts) d.parts[p.id] = p;
      for (const w of content.wires) d.wires[w.id] = w;
      if (content.code) {
        d.code.text = content.code;
        d.code.language = 'arduino';
        d.code.mode = 'text';
        d.code.blocksAbandoned = true;
      }
      if (content.python) {
        d.code.python = content.python;
        d.code.language = 'micropython';
        d.code.mode = 'text';
        d.code.blocksAbandoned = true;
      }
      d.name = starter.name;
    });

    const ed = useEditorStore.getState();
    ed.clearSelection();
    if (content.code || content.python) ed.setCodeOpen(true);
    // Let the parts commit before measuring them.
    setTimeout(() => ed.fitTo(contentBounds()), 40);
  };

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1">
        <Chip active={category === 'all'} onClick={() => setCategory('all')}>
          All
        </Chip>
        {STARTER_CATEGORIES.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search starters"
        className="mb-2 w-full rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-[12.5px] outline-none placeholder:text-neutral-400 focus:border-sky-500 focus:bg-white"
      />

      <ul className="space-y-1.5">
        {list.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => place(s)}
              className="w-full rounded-lg border border-neutral-200 bg-white p-2.5 text-left transition hover:border-sky-400 hover:bg-sky-50/40"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-medium text-neutral-800">{s.name}</span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                  {STARTER_CATEGORIES.find((c) => c.id === s.category)?.label}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-neutral-500">{s.blurb}</p>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="px-2 py-8 text-center text-[12px] text-neutral-400">
            No starters match “{search}”.
          </li>
        )}
      </ul>
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2 py-[3px] text-[11px] font-medium transition ${
        active
          ? 'border-sky-500 bg-sky-50 text-sky-700'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
      }`}
    >
      {children}
    </button>
  );
}
