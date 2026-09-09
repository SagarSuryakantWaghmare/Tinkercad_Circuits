'use client';

import { useEditorStore } from '@/state/editorStore';
import { useDesignStore } from '@/state/designStore';
import { describePart, getPartDef } from '@/parts/registry';
import type { PropSchema, PropValue } from '@/parts/types';
import { WIRE_COLORS } from '@/lib/tokens';
import { IconMirror, IconRotate, IconTrash } from '../icons';

const PREFIX: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  'µ': 1e-6,
  m: 1e-3,
  '': 1,
  k: 1e3,
  M: 1e6,
  G: 1e9,
};

/** Split a raw SI value into the largest prefix that keeps it ≥ 1. */
export function splitUnit(value: number, prefixes: string[]) {
  const ordered = [...prefixes].sort((a, b) => PREFIX[b] - PREFIX[a]);
  for (const p of ordered) {
    const m = value / PREFIX[p];
    if (m >= 1 && m < 1000) return { mag: round(m), prefix: p };
  }
  const p = ordered[ordered.length - 1] ?? '';
  return { mag: round(value / PREFIX[p]), prefix: p };
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function Inspector() {
  const selectedParts = useEditorStore((s) => s.selectedParts);
  const selectedWires = useEditorStore((s) => s.selectedWires);
  const design = useDesignStore((s) => s.design);
  const transact = useDesignStore((s) => s.transact);
  const clear = useEditorStore((s) => s.clearSelection);

  if (selectedWires.length && !selectedParts.length) {
    return <WireInspector ids={selectedWires} />;
  }
  if (selectedParts.length !== 1) return null;

  const inst = design.parts[selectedParts[0]];
  if (!inst) return null;
  const def = getPartDef(inst.type);
  if (!def) return null;

  const setProp = (key: string, value: PropValue) =>
    transact('Change property', (d) => {
      const p = d.parts[inst.id];
      if (p) p.props[key] = value;
    });

  return (
    <div className="pointer-events-auto w-[236px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.14)]">
      <header className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className="truncate text-[12.5px] font-semibold text-neutral-800" title={def.name}>
          {def.name}
        </span>
        <div className="flex items-center gap-0.5 text-neutral-500">
          <IconBtn
            title="Rotate (R)"
            onClick={() =>
              transact('Rotate', (d) => {
                const p = d.parts[inst.id];
                if (p) p.rotation = (p.rotation + (def.rotationStep ?? (def.socketable ? 90 : 30))) % 360;
              })
            }
          >
            <IconRotate width={15} height={15} />
          </IconBtn>
          <IconBtn
            title="Mirror"
            onClick={() =>
              transact('Mirror', (d) => {
                const p = d.parts[inst.id];
                if (p) p.mirrored = !p.mirrored;
              })
            }
          >
            <IconMirror width={15} height={15} />
          </IconBtn>
          <IconBtn
            title="Delete"
            onClick={() => {
              transact('Delete', (d) => {
                delete d.parts[inst.id];
                for (const wid in d.wires) {
                  const w = d.wires[wid];
                  if (
                    (w.a.kind === 'terminal' && w.a.partId === inst.id) ||
                    (w.b.kind === 'terminal' && w.b.partId === inst.id)
                  )
                    delete d.wires[wid];
                }
              });
              clear();
            }}
          >
            <IconTrash width={15} height={15} />
          </IconBtn>
        </div>
      </header>

      {describePart(def) && (
        <p className="border-b border-neutral-100 px-3 py-2 text-[11.5px] leading-snug text-neutral-500">
          {describePart(def)}
        </p>
      )}

      <div className="space-y-2.5 px-3 py-2.5">
        <Field label="Name">
          <input
            value={inst.name ?? ''}
            placeholder={def.name}
            onChange={(e) =>
              transact('Rename component', (d) => {
                const p = d.parts[inst.id];
                if (p) p.name = e.target.value || undefined;
              })
            }
            className="w-full rounded border border-neutral-300 px-2 py-1 text-[12px] outline-none focus:border-sky-500"
          />
        </Field>

        {(def.props ?? []).map((schema) => {
          if (schema.when && !schema.when(inst.props)) return null;
          return (
            <PropField
              key={schema.key}
              schema={schema}
              value={inst.props[schema.key]}
              onChange={(v) => setProp(schema.key, v)}
            />
          );
        })}
      </div>
    </div>
  );
}

function PropField({
  schema,
  value,
  onChange,
}: {
  schema: PropSchema;
  value: PropValue;
  onChange: (v: PropValue) => void;
}) {
  switch (schema.kind) {
    case 'unit': {
      const raw = Number(value) || 0;
      const { mag, prefix } = splitUnit(raw, schema.prefixes);
      return (
        <Field label={schema.label}>
          <div className="flex gap-1">
            <input
              type="number"
              value={mag}
              step="any"
              onChange={(e) => onChange(Number(e.target.value) * PREFIX[prefix])}
              className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-[12px] outline-none focus:border-sky-500"
            />
            <select
              value={prefix}
              onChange={(e) => onChange(mag * PREFIX[e.target.value])}
              className="rounded border border-neutral-300 bg-white px-1 py-1 text-[12px] outline-none focus:border-sky-500"
            >
              {schema.prefixes.map((p) => (
                <option key={p} value={p}>
                  {p}
                  {schema.unit}
                </option>
              ))}
            </select>
          </div>
        </Field>
      );
    }

    case 'number':
      return (
        <Field label={schema.label}>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={Number(value)}
              min={schema.min}
              max={schema.max}
              step={schema.step ?? 'any'}
              onChange={(e) => onChange(Number(e.target.value))}
              className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-[12px] outline-none focus:border-sky-500"
            />
            {schema.unit && (
              <span className="text-[11px] text-neutral-500">{schema.unit}</span>
            )}
          </div>
        </Field>
      );

    case 'slider':
      return (
        <Field label={`${schema.label}${schema.unit ? ` (${value} ${schema.unit})` : ''}`}>
          <input
            type="range"
            min={schema.min}
            max={schema.max}
            step={schema.step ?? 1}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-sky-600"
          />
        </Field>
      );

    case 'select':
      return (
        <Field label={schema.label}>
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-sky-500"
          >
            {schema.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      );

    case 'color':
      return (
        <Field label={schema.label}>
          <select
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-[12px] outline-none focus:border-sky-500"
          >
            {schema.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      );

    case 'toggle':
      return (
        <label className="flex items-center gap-2 text-[12px] text-neutral-700">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-sky-600"
          />
          {schema.label}
        </label>
      );

    case 'text':
      return (
        <Field label={schema.label}>
          <input
            value={String(value ?? '')}
            placeholder={schema.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-[12px] outline-none focus:border-sky-500"
          />
        </Field>
      );
  }
}

function WireInspector({ ids }: { ids: string[] }) {
  const transact = useDesignStore((s) => s.transact);
  const design = useDesignStore((s) => s.design);
  const clear = useEditorStore((s) => s.clearSelection);
  const setWireColor = useEditorStore((s) => s.setWireColor);
  const current = design.wires[ids[0]]?.color ?? '0';
  const kind = design.wires[ids[0]]?.type ?? 'wire';

  return (
    <div className="pointer-events-auto w-[236px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.14)]">
      <header className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className="text-[12.5px] font-semibold text-neutral-800">
          {ids.length > 1 ? `${ids.length} Wires` : 'Wire'}
        </span>
        <IconBtn
          title="Delete"
          onClick={() => {
            transact('Delete wire', (d) => {
              for (const id of ids) delete d.wires[id];
            });
            clear();
          }}
        >
          <IconTrash width={15} height={15} />
        </IconBtn>
      </header>
      <div className="px-3 py-2.5">
        <p className="mb-1.5 text-[11px] font-medium text-neutral-500">
          Colour <span className="text-neutral-400">(press 0–9)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {WIRE_COLORS.map((c) => (
            <button
              key={c.key}
              title={`${c.name} (${c.key})`}
              onClick={() => {
                setWireColor(c.key);
                transact('Wire colour', (d) => {
                  for (const id of ids) if (d.wires[id]) d.wires[id].color = c.key;
                });
              }}
              className={`h-6 w-6 rounded-full border-2 transition ${
                current === c.key ? 'border-sky-500 scale-110' : 'border-neutral-300'
              }`}
              style={{ background: c.hex }}
            />
          ))}
        </div>

        <p className="mb-1.5 mt-3 text-[11px] font-medium text-neutral-500">Type</p>
        <div className="flex gap-1">
          {(
            [
              { value: 'wire', label: 'Wire', hint: 'Flexible, routes around parts' },
              { value: 'jumper', label: 'Jumper', hint: 'Stiff, hugs the board' },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              title={t.hint}
              onClick={() =>
                transact('Wire type', (d) => {
                  for (const id of ids) if (d.wires[id]) d.wires[id].type = t.value;
                })
              }
              className={`flex-1 rounded border px-2 py-1 text-[11.5px] font-medium transition ${
                kind === t.value
                  ? 'border-sky-500 bg-sky-50 text-sky-700'
                  : 'border-neutral-300 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function IconBtn({
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
      className="rounded p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
    >
      {children}
    </button>
  );
}
