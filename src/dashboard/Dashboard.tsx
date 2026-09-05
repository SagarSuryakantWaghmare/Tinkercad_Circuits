'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import '@/parts';
import { emptyDesign } from '@/state/design';
import { newDesignId } from '@/lib/ids';
import { deleteDesign, loadDesign, loadIndex, saveDesign, type DesignSummary } from '@/persist/store';
import { STARTERS } from '@/starters';
import { importDesignJson } from '@/persist/exporters';

/**
 * Landing page: the designs saved in this browser, plus a way to start from
 * blank or from a starter. There is no account and no server in this build, so
 * "my designs" means IndexedDB on this machine — the import/export buttons are
 * how a design moves anywhere else.
 */
export function Dashboard() {
  const router = useRouter();
  const [designs, setDesigns] = useState<DesignSummary[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadIndex().then(setDesigns).catch(() => setDesigns([]));
  }, []);

  const createBlank = async () => {
    setBusy(true);
    const design = emptyDesign(newDesignId());
    await saveDesign(design);
    router.push(`/editor?id=${design.id}`);
  };

  const createFromStarter = async (starterId: string) => {
    const starter = STARTERS.find((s) => s.id === starterId);
    if (!starter) return;
    setBusy(true);
    const content = starter.build();
    const design = emptyDesign(newDesignId(), starter.name);
    for (const p of content.parts) design.parts[p.id] = p;
    for (const w of content.wires) design.wires[w.id] = w;
    if (content.code) {
      design.code.text = content.code;
      design.code.language = 'arduino';
      design.code.mode = 'text';
      design.code.blocksAbandoned = true;
    }
    if (content.python) {
      design.code.python = content.python;
      design.code.language = 'micropython';
      design.code.mode = 'text';
      design.code.blocksAbandoned = true;
    }
    await saveDesign(design);
    router.push(`/editor?id=${design.id}`);
  };

  const duplicate = async (id: string) => {
    const source = await loadDesign(id);
    if (!source) return;
    const copy = { ...source, id: newDesignId(), name: `${source.name} copy`, updatedAt: Date.now() };
    await saveDesign(copy);
    setDesigns(await loadIndex());
  };

  return (
    <div className="h-full overflow-auto bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Logo />
          <div className="min-w-0">
            <h1 className="text-[17px] font-bold tracking-tight text-neutral-900">CircuitLab</h1>
            <p className="text-[12.5px] text-neutral-500">
              Design, wire and simulate circuits in the browser.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="cursor-pointer rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition hover:bg-neutral-50">
              Import
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    const design = await importDesignJson(file);
                    design.id = newDesignId();
                    await saveDesign(design);
                    router.push(`/editor?id=${design.id}`);
                  } catch {
                    window.alert('That file is not a CircuitLab design.');
                  }
                }}
              />
            </label>
            <button
              onClick={createBlank}
              disabled={busy}
              className="rounded-md bg-sky-600 px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              Create new circuit
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-neutral-800">Your designs</h2>
          {designs === null ? (
            <p className="text-[12.5px] text-neutral-400">Loading…</p>
          ) : designs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
              <p className="text-[13px] font-medium text-neutral-700">Nothing here yet</p>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-neutral-500">
                Create a blank circuit, or open one of the starters below — each is a working
                design you can simulate immediately and then take apart.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {designs.map((d) => (
                <li
                  key={d.id}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-sky-400 hover:shadow-sm"
                >
                  <button
                    onClick={() => router.push(`/editor?id=${d.id}`)}
                    className="block w-full text-left"
                  >
                    <span className="flex h-28 items-center justify-center overflow-hidden bg-neutral-100">
                      {d.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.thumbnail} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-[11px] text-neutral-400">No preview</span>
                      )}
                    </span>
                    <span className="block px-3 py-2">
                      <span className="block truncate text-[12.5px] font-medium text-neutral-800">
                        {d.name}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {d.parts} component{d.parts === 1 ? '' : 's'} · {relative(d.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <div className="flex gap-1 border-t border-neutral-100 px-2 py-1.5 opacity-0 transition group-hover:opacity-100">
                    <MiniButton onClick={() => duplicate(d.id)}>Duplicate</MiniButton>
                    <MiniButton
                      onClick={async () => {
                        if (!window.confirm(`Delete “${d.name}”? This cannot be undone.`)) return;
                        await deleteDesign(d.id);
                        setDesigns(await loadIndex());
                      }}
                    >
                      Delete
                    </MiniButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-1 text-[13px] font-semibold text-neutral-800">Starters</h2>
          <p className="mb-3 text-[12px] text-neutral-500">
            Pre-wired circuits with working code. Open one and press Start Simulation.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STARTERS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => createFromStarter(s.id)}
                  disabled={busy}
                  className="h-full w-full rounded-lg border border-neutral-200 bg-white p-3 text-left transition hover:border-sky-400 hover:bg-sky-50/40 disabled:opacity-60"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[12.5px] font-medium text-neutral-800">{s.name}</span>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                      {s.category}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-neutral-500">
                    {s.blurb}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-10 border-t border-neutral-200 pt-4 text-[11.5px] leading-relaxed text-neutral-400">
          Designs are stored in this browser only — there is no account and no server. Use
          <strong className="font-medium text-neutral-500"> Send To → Design file</strong> in the
          editor to keep a copy or move one to another machine.
        </footer>
      </main>
    </div>
  );
}

function MiniButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-2 py-1 text-[11px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      {children}
    </button>
  );
}

function relative(ts: number) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(ts).toLocaleDateString();
}

function Logo() {
  const cells = ['#E23B3B', '#E3A93B', '#3FBF4F', '#2E8BD6', '#7B3FB5', '#E3C93B'];
  return (
    <svg width="34" height="34" viewBox="0 0 30 30" className="shrink-0">
      <rect width="30" height="30" rx="6" fill="#1F2937" />
      {cells.map((c, i) => (
        <rect
          key={i}
          x={5 + (i % 3) * 7}
          y={6 + Math.floor(i / 3) * 9}
          width="6"
          height="7.5"
          rx="1.2"
          fill={c}
        />
      ))}
    </svg>
  );
}
