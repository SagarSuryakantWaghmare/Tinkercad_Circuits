'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSimStore } from '@/state/simStore';

const BAUDS = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 74880, 115200];

export function SerialMonitor({ onSend }: { onSend: (text: string) => void }) {
  const lines = useSimStore((s) => s.snapshot.serial);
  const baud = useSimStore((s) => s.baud);
  const setBaud = useSimStore((s) => s.setBaud);
  const [input, setInput] = useState('');
  const [autoscroll, setAutoscroll] = useState(true);
  const [timestamps, setTimestamps] = useState(false);
  const [cleared, setCleared] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => lines.slice(cleared), [lines, cleared]);

  useEffect(() => {
    if (autoscroll && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [visible.length, autoscroll]);

  const send = () => {
    if (!input) return;
    onSend(input + '\n');
    setInput('');
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-2 py-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Send a message to the board…"
          className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-[12px] outline-none focus:border-sky-500"
        />
        <button
          onClick={send}
          className="rounded bg-sky-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-sky-700"
        >
          Send
        </button>
        <label className="flex items-center gap-1 text-[11px] text-neutral-600">
          <input
            type="checkbox"
            checked={autoscroll}
            onChange={(e) => setAutoscroll(e.target.checked)}
            className="accent-sky-600"
          />
          Autoscroll
        </label>
        <label className="flex items-center gap-1 text-[11px] text-neutral-600">
          <input
            type="checkbox"
            checked={timestamps}
            onChange={(e) => setTimestamps(e.target.checked)}
            className="accent-sky-600"
          />
          Timestamp
        </label>
        <button
          onClick={() => setCleared(lines.length)}
          className="rounded border border-neutral-300 px-2 py-1 text-[11.5px] text-neutral-700 hover:bg-neutral-50"
        >
          Clear
        </button>
        <select
          value={baud}
          onChange={(e) => setBaud(Number(e.target.value))}
          className="rounded border border-neutral-300 bg-white px-1.5 py-1 text-[11.5px] outline-none"
        >
          {BAUDS.map((b) => (
            <option key={b} value={b}>
              {b} baud
            </option>
          ))}
        </select>
      </div>

      <div
        ref={boxRef}
        className="min-h-0 flex-1 overflow-auto bg-neutral-50 px-3 py-2 font-mono text-[12px] leading-[1.6] text-neutral-800"
      >
        {visible.length === 0 && (
          <p className="font-sans text-[12px] text-neutral-400">
            Nothing received yet. Call <code className="font-mono">Serial.begin(9600)</code> in
            setup and <code className="font-mono">Serial.println(…)</code> in loop.
          </p>
        )}
        {visible.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            {timestamps && (
              <span className="mr-2 select-none text-neutral-400">
                {String(i).padStart(5, '0')}
              </span>
            )}
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Serial plotter. Parses numeric fields out of each received line the way the
 * Arduino IDE does — whitespace-, comma- or tab-separated numbers, optionally
 * with `label:value` pairs — and draws one trace per column.
 */
export function SerialPlotter() {
  const lines = useSimStore((s) => s.snapshot.serial);

  const { series, labels } = useMemo(() => {
    const tail = lines.slice(-400);
    const cols: number[][] = [];
    const names: string[] = [];
    for (const line of tail) {
      const fields = line.split(/[\s,\t]+/).filter(Boolean);
      fields.forEach((f, i) => {
        const named = /^([A-Za-z_][\w ]*):(-?[\d.]+)$/.exec(f);
        const value = named ? Number(named[2]) : Number(f);
        if (!Number.isFinite(value)) return;
        if (!cols[i]) {
          cols[i] = [];
          names[i] = named ? named[1] : `Series ${i + 1}`;
        }
        cols[i].push(value);
      });
    }
    return { series: cols.filter(Boolean), labels: names.filter(Boolean) };
  }, [lines]);

  const W = 800;
  const H = 220;
  const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

  const all = series.flat();
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const span = max - min || 1;
  const pad = span * 0.08;

  const y = (v: number) => H - ((v - (min - pad)) / (span + pad * 2)) * H;

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-3 py-1.5">
        <span className="text-[12px] font-medium text-neutral-700">Serial Plotter</span>
        {labels.map((l, i) => (
          <span key={l} className="flex items-center gap-1 text-[11px] text-neutral-600">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            {l}
          </span>
        ))}
        {all.length > 0 && (
          <span className="ml-auto font-mono text-[11px] text-neutral-500">
            {min.toFixed(2)} … {max.toFixed(2)}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 bg-neutral-50 p-2">
        {series.length === 0 ? (
          <p className="p-6 text-center text-[12px] text-neutral-400">
            Print numbers with <code className="font-mono">Serial.println(value)</code> to plot
            them here.
          </p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={0}
                x2={W}
                y1={f * H}
                y2={f * H}
                stroke="#e5e7eb"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.map((col, i) => (
              <polyline
                key={i}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
                points={col
                  .map((v, x) => `${(x / Math.max(1, col.length - 1)) * W},${y(v)}`)
                  .join(' ')}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
