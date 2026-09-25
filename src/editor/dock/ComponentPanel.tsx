'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '@/state/editorStore';
import { useDesignStore } from '@/state/designStore';
import { allParts, basicParts, categoriesOf, searchParts } from '@/parts/registry';
import { CATEGORIES, type CategoryId, type PartDef } from '@/parts/types';
import { STARTER_CATEGORIES, STARTERS, type Starter } from '@/starters';
import { PartThumb } from './PartThumb';
import { StarterThumb } from './StarterThumb';
import { IconSearch } from '../icons';
import { contentBounds } from '../useHotkeys';

/**
 * The headed sections of the "All" list.
 *
 * Grouped by a part's primary category only. A part may also declare
 * altCategories so that filtering to either one finds it — but honouring
 * those here put the same part under two headings of one list, so the 74
 * series ICs were each listed twice while the count beside them, taken from
 * the ungrouped pool, said once.
 */
export function groupByCategory(parts: PartDef<never>[]) {
  const map = new Map<string, PartDef<never>[]>();
  for (const p of parts) {
    const arr = map.get(p.category) ?? [];
    arr.push(p);
    map.set(p.category, arr);
  }
  return CATEGORIES.filter((c) => map.has(c.id)).map((c) => ({
    label: c.label,
    items: map.get(c.id)!,
  }));
}

export function ComponentPanel() {
  const view = useEditorStore((s) => s.panelView);
  const setView = useEditorStore((s) => s.setPanelView);
  const category = useEditorStore((s) => s.panelCategory);
  const setCategory = useEditorStore((s) => s.setPanelCategory);
  const search = useEditorStore((s) => s.panelSearch);
  const setSearch = useEditorStore((s) => s.setPanelSearch);
  const pending = useEditorStore((s) => s.pendingPart);
  const setPending = useEditorStore((s) => s.setPendingPart);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [listView, setListView] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useDesignStore((s) => s.transact);
  const design = useDesignStore((s) => s.design);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [dropdownOpen]);

  // Current header label computation
  const headerGroup = view === 'starters' ? 'Starters' : 'Components';
  const headerLabel = useMemo(() => {
    if (view === 'basic') return 'Basic';
    if (view === 'all') return 'All';
    if (view === 'starters') {
      if (category === 'all') return 'All';
      if (category === 'basic') return 'Basic';
      if (category === 'arduino') return 'Arduino';
      if (category === 'microbit') return 'Micro:Bit';
      if (category === 'assemblies') return 'Circuit Assemblies';
      const found = STARTER_CATEGORIES.find((c) => c.id === category);
      return found?.label ?? 'All';
    }
    return 'All';
  }, [view, category]);

  // Components list
  const parts = useMemo(() => {
    if (view === 'starters') return [];
    let pool: PartDef<never>[] = view === 'basic' ? basicParts() : allParts();
    if (category !== 'all') {
      const cat = category as CategoryId;
      pool = pool.filter((p) => categoriesOf(p).includes(cat));
    }
    return searchParts(search, pool);
  }, [view, category, search]);

  const groupedParts = useMemo(() => {
    if (view === 'starters' || category !== 'all' || search.trim()) return null;
    return groupByCategory(parts);
  }, [view, parts, category, search]);

  // Starters list
  const starters = useMemo(() => {
    if (view !== 'starters') return [];
    const q = search.trim().toLowerCase();
    return STARTERS.filter(
      (s) =>
        (category === 'all' || s.category === category) &&
        (!q || s.name.toLowerCase().includes(q) || s.blurb.toLowerCase().includes(q)),
    );
  }, [view, category, search]);

  const groupedStarters = useMemo(() => {
    if (view !== 'starters' || category !== 'all' || search.trim()) return null;
    return STARTER_CATEGORIES.map((c) => ({
      label: c.label,
      items: STARTERS.filter((s) => s.category === c.id),
    })).filter((g) => g.items.length > 0);
  }, [view, category, search]);

  const placeStarter = (starter: Starter) => {
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
    setTimeout(() => ed.fitTo(contentBounds()), 40);
  };

  return (
    <aside
      className="flex h-full w-[310px] shrink-0 flex-col border-l border-neutral-200 bg-[#FAFBFD]"
      aria-label="Components"
    >
      {/* ── Header: Tinkercad-style Dropdown Selector ──────────────────────── */}
      <header className="border-b border-neutral-200 bg-white p-3">
        <div className="flex items-center gap-2">
          {/* Dropdown Button */}
          <div className="relative flex-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-md border border-neutral-300 bg-[#F4F7FA] px-3 py-1.5 text-left transition hover:bg-[#EBF2F8] focus:outline-none"
              aria-expanded={dropdownOpen}
              aria-haspopup="listbox"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-medium leading-none text-neutral-500">
                  {headerGroup}
                </span>
                <span className="mt-0.5 text-[13px] font-semibold leading-tight text-neutral-900">
                  {headerLabel}
                </span>
              </div>
              <svg
                className={`h-2.5 w-2.5 text-neutral-700 transition-transform ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
                viewBox="0 0 10 6"
                fill="currentColor"
              >
                <path d="M0 0l5 6 5-6z" />
              </svg>
            </button>

            {/* Dropdown Menu Popup */}
            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-neutral-200 bg-white py-1.5 shadow-xl">
                {/* Components Group */}
                <div className="px-3.5 py-1 text-[11px] font-semibold text-neutral-400">
                  Components
                </div>
                <button
                  onClick={() => {
                    setView('basic');
                    setCategory('all');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-[12.5px] transition ${
                    view === 'basic'
                      ? 'bg-[#3B8ED7] font-medium text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Basic
                </button>
                <button
                  onClick={() => {
                    setView('all');
                    setCategory('all');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-[12.5px] transition ${
                    view === 'all'
                      ? 'bg-[#3B8ED7] font-medium text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  All
                </button>

                {/* Starters Group */}
                <div className="mt-1.5 border-t border-neutral-100 px-3.5 pb-1 pt-2 text-[11px] font-semibold text-neutral-400">
                  Starters
                </div>
                <button
                  onClick={() => {
                    setView('starters');
                    setCategory('basic');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-[12.5px] transition ${
                    view === 'starters' && category === 'basic'
                      ? 'bg-[#3B8ED7] font-medium text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Basic
                </button>
                <button
                  onClick={() => {
                    setView('starters');
                    setCategory('arduino');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-[12.5px] transition ${
                    view === 'starters' && category === 'arduino'
                      ? 'bg-[#3B8ED7] font-medium text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Arduino
                </button>
                <button
                  onClick={() => {
                    setView('starters');
                    setCategory('microbit');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-[12.5px] transition ${
                    view === 'starters' && category === 'microbit'
                      ? 'bg-[#3B8ED7] font-medium text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Micro:Bit
                </button>
                <button
                  onClick={() => {
                    setView('starters');
                    setCategory('assemblies');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-[12.5px] transition ${
                    view === 'starters' && category === 'assemblies'
                      ? 'bg-[#3B8ED7] font-medium text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  Circuit Assemblies
                </button>
                <button
                  onClick={() => {
                    setView('starters');
                    setCategory('all');
                    setDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-1.5 text-left text-[12.5px] transition ${
                    view === 'starters' && category === 'all'
                      ? 'bg-[#3B8ED7] font-medium text-white'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  All
                </button>
              </div>
            )}
          </div>

          {/* List/Grid view toggle button */}
          <button
            onClick={() => setListView((v) => !v)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-600 transition hover:bg-neutral-50"
            title={listView ? 'Switch to Grid View' : 'Switch to List View'}
          >
            {listView ? (
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="4" r="1.5" />
                <rect x="6" y="3" width="8" height="2" rx="0.5" />
                <circle cx="3" cy="8" r="1.5" />
                <rect x="6" y="7" width="8" height="2" rx="0.5" />
                <circle cx="3" cy="12" r="1.5" />
                <rect x="6" y="11" width="8" height="2" rx="0.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Search input with right search icon */}
        <div className="relative mt-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            aria-label="Search"
            className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-3 pr-8 text-[12.5px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-200"
          />
          <IconSearch
            width={15}
            height={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
        </div>
      </header>

      {/* ── Content Area: 3-Column Visual Grid ────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {/* Components View */}
        {view !== 'starters' && (
          <>
            {parts.length === 0 && (
              <p className="px-2 py-8 text-center text-[12px] text-neutral-400">
                No components match “{search}”.
              </p>
            )}

            {groupedParts ? (
              groupedParts.map((g) => (
                <section key={g.label} className="mb-4">
                  <h3 className="px-1 pb-1.5 text-[13px] font-medium text-[#2196F3]">
                    {g.label}
                  </h3>
                  <PartsGrid
                    items={g.items}
                    pending={pending}
                    setPending={setPending}
                    listView={listView}
                  />
                </section>
              ))
            ) : (
              <PartsGrid
                items={parts}
                pending={pending}
                setPending={setPending}
                listView={listView}
              />
            )}
          </>
        )}

        {/* Starters View */}
        {view === 'starters' && (
          <>
            {starters.length === 0 && (
              <p className="px-2 py-8 text-center text-[12px] text-neutral-400">
                No starters match “{search}”.
              </p>
            )}

            {groupedStarters ? (
              groupedStarters.map((g) => (
                <section key={g.label} className="mb-4">
                  <h3 className="px-1 pb-1.5 text-[13px] font-medium text-[#2196F3]">
                    {g.label}
                  </h3>
                  <StartersGrid
                    items={g.items}
                    onSelect={placeStarter}
                    listView={listView}
                  />
                </section>
              ))
            ) : (
              <StartersGrid
                items={starters}
                onSelect={placeStarter}
                listView={listView}
              />
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function PartsGrid({
  items,
  pending,
  setPending,
  listView,
}: {
  items: PartDef<never>[];
  pending: string | null;
  setPending: (id: string | null) => void;
  listView: boolean;
}) {
  if (listView) {
    return (
      <div className="space-y-1.5">
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
            className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
              pending === p.id
                ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200'
                : 'border-neutral-200/80 bg-white hover:border-sky-400 hover:shadow-xs'
            }`}
          >
            <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded bg-[#F8F9FA] p-1">
              <PartThumb def={p} box={40} />
            </span>
            <span className="text-[12px] font-medium text-neutral-800">{p.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
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
          className={`group flex min-h-[96px] flex-col items-center justify-between rounded-lg border p-1.5 text-center transition ${
            pending === p.id
              ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-200'
              : 'border-neutral-200/80 bg-white hover:border-sky-400 hover:shadow-xs'
          }`}
          title={p.name}
        >
          <span className="flex h-[56px] w-full items-center justify-center p-0.5">
            <PartThumb def={p} box={52} />
          </span>
          <span className="line-clamp-2 w-full text-[10.5px] font-normal leading-tight text-neutral-700 group-hover:text-sky-700">
            {p.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function StartersGrid({
  items,
  onSelect,
  listView,
}: {
  items: Starter[];
  onSelect: (s: Starter) => void;
  listView: boolean;
}) {
  if (listView) {
    return (
      <div className="space-y-1.5">
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/starter', s.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-neutral-200/80 bg-white p-2 text-left transition hover:border-sky-400 hover:shadow-xs"
            title={`${s.name}\n${s.blurb}`}
          >
            <span className="flex h-[44px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded bg-[#F8F9FA] p-1">
              <StarterThumb starter={s} />
            </span>
            <div className="flex flex-col">
              <span className="text-[12px] font-medium text-neutral-800">{s.name}</span>
              <span className="line-clamp-1 text-[11px] text-neutral-500">{s.blurb}</span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/starter', s.id);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          className="group flex min-h-[96px] flex-col items-center justify-between rounded-lg border border-neutral-200/80 bg-white p-1.5 text-center transition hover:border-sky-400 hover:shadow-xs"
          title={`${s.name}\n${s.blurb}`}
        >
          <span className="flex h-[56px] w-full items-center justify-center overflow-hidden p-0.5">
            <StarterThumb starter={s} />
          </span>
          <span className="line-clamp-2 w-full text-[10.5px] font-normal leading-tight text-neutral-700 group-hover:text-sky-700">
            {s.name}
          </span>
        </button>
      ))}
    </div>
  );
}
