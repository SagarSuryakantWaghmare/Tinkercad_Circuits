'use client';

import { useMemo } from 'react';
import { useEditorStore } from '@/state/editorStore';
import { allParts, basicParts, categoriesOf, searchParts } from '@/parts/registry';
import { CATEGORIES, type CategoryId, type PartDef } from '@/parts/types';
import { PartThumb } from './PartThumb';
import { StartersDrawer } from './StartersDrawer';
import { IconSearch } from '../icons';

export function ComponentPanel() {
  const view = useEditorStore((s) => s.panelView);
  const setView = useEditorStore((s) => s.setPanelView);
  const category = useEditorStore((s) => s.panelCategory);
  const setCategory = useEditorStore((s) => s.setPanelCategory);
  const search = useEditorStore((s) => s.panelSearch);
  const setSearch = useEditorStore((s) => s.setPanelSearch);
  const pending = useEditorStore((s) => s.pendingPart);
  const setPending = useEditorStore((s) => s.setPendingPart);

  const parts = useMemo(() => {
    let pool: PartDef<never>[] = view === 'basic' ? basicParts() : allParts();
    if (category !== 'all') {
      const cat = category as CategoryId;
      pool = pool.filter((p) => categoriesOf(p).includes(cat));
    }
    return searchParts(search, pool);
  }, [view, category, search]);

  const grouped = useMemo(() => {
    if (category !== 'all' || search.trim()) return null;
    // A part can appear in more than one section — Tinkercad files 74xx chips
    // under Logic, our IC section keeps the physical-chip copy too. Walking
    // every category each part claims puts it in each rail exactly once.
    const map = new Map<string, PartDef<never>[]>();
    for (const p of parts) {
      for (const cat of categoriesOf(p)) {
        const arr = map.get(cat) ?? [];
        arr.push(p);
        map.set(cat, arr);
      }
    }
    return CATEGORIES.filter((c) => map.has(c.id)).map((c) => ({
      label: c.label,
      items: map.get(c.id)!,
    }));
  }, [parts, category, search]);

  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col border-l border-neutral-200 bg-white"
      aria-label="Components"
    >
      {/* Header laid out like Tinkercad's: title, then a Basic / All / Starters
          segmented pill, then the search field. Segmented pill is easier to
          read at a glance than a native <select>. */}
      <header className="border-b border-neutral-200 px-3 py-3">
        <div className="mb-2 text-[14px] font-semibold text-neutral-900">Components</div>

        {/* Segmented view toggle. */}
        <div
          className="mb-2 grid grid-cols-3 gap-0.5 rounded-md bg-neutral-100 p-0.5"
          role="tablist"
          aria-label="Component view"
        >
          {([
            { key: 'basic', label: 'Basic' },
            { key: 'all', label: 'All' },
            { key: 'starters', label: 'Starters' },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              role="tab"
              aria-selected={view === opt.key}
              onClick={() => setView(opt.key)}
              className={`rounded px-2 py-1 text-[12px] font-medium transition ${
                view === opt.key
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {view !== 'starters' && (
          <div className="relative">
            <IconSearch
              width={14}
              height={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search components"
              aria-label="Search components"
              className="w-full rounded-md border border-neutral-300 bg-neutral-50 py-1.5 pl-8 pr-2 text-[12.5px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-sky-500 focus:bg-white focus-visible:ring-2 focus-visible:ring-sky-200"
            />
          </div>
        )}

        {view === 'all' && (
          <div
            className="mt-2 flex gap-1 overflow-x-auto whitespace-nowrap pb-1"
            role="tablist"
            aria-label="Categories"
          >
            <Chip active={category === 'all'} onClick={() => setCategory('all')}>
              All
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </Chip>
            ))}
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {view === 'starters' && <StartersDrawer />}

        {view !== 'starters' && parts.length === 0 && (
          <p className="px-2 py-8 text-center text-[12px] text-neutral-400">
            No components match “{search}”.
          </p>
        )}

        {view !== 'starters' && (grouped
          ? grouped.map((g) => (
              <section key={g.label} className="mb-3">
                <h3 className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  {g.label}
                </h3>
                <Grid items={g.items} pending={pending} setPending={setPending} />
              </section>
            ))
          : <Grid items={parts} pending={pending} setPending={setPending} />)}
      </div>
    </aside>
  );
}

function Grid({
  items,
  pending,
  setPending,
}: {
  items: PartDef<never>[];
  pending: string | null;
  setPending: (id: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {items.map((p) => (
        <button
          key={p.id}
          onClick={() => setPending(pending === p.id ? null : p.id)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/part', p.id);
            e.dataTransfer.effectAllowed = 'copy';
            setPending(p.id);
          }}
          className={`group flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition ${
            pending === p.id
              ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200'
              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
          }`}
          title={p.name}
        >
          <span className="flex h-[58px] w-full items-center justify-center">
            <PartThumb def={p} />
          </span>
          <span className="line-clamp-2 text-[11px] leading-tight text-neutral-700">
            {p.name}
          </span>
        </button>
      ))}
    </div>
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
