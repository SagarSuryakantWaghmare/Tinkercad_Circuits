'use client';

import { useState } from 'react';
import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import { getPartDef } from '@/parts/registry';
import { IconWarning } from './icons';

/**
 * What went wrong, and what to do about it.
 *
 * The reference product puts a starburst on the part and the reason in a hover
 * tooltip, which vanishes the moment the fault clears and is never recorded.
 * Keeping a list for the run matters more than it sounds: the interesting
 * failure is usually the *first* one, and by the time a beginner has noticed
 * the smoke the cause is several events in the past.
 */
export function FailurePanel() {
  const failures = useSimStore((s) => s.snapshot.failures);
  const running = useSimStore((s) => s.runState !== 'idle');
  const parts = useDesignStore((s) => s.design.parts);
  const select = useEditorStore((s) => s.select);

  const [dismissed, setDismissed] = useState(0);
  const [open, setOpen] = useState(true);

  // Starting or stopping the simulation begins a fresh log, so anything the
  // user dismissed last time should not stay dismissed. Adjusted during render
  // rather than in an effect: it derives from `running` and nothing outside
  // this component needs to see the stale value.
  const [lastRunning, setLastRunning] = useState(running);
  if (lastRunning !== running) {
    setLastRunning(running);
    setDismissed(0);
    setOpen(true);
  }

  const shown = failures.slice(dismissed);
  if (!running || shown.length === 0) return null;

  const broken = shown.filter((f) => f.severity === 'breakdown').length;

  const nameOf = (partId: string) => {
    const inst = parts[partId];
    return inst?.name || (inst && getPartDef(inst.type)?.name) || 'Component';
  };

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 w-[420px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
      <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-[0_10px_36px_rgba(15,23,42,0.18)]">
        <header className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-3 py-2">
          <IconWarning width={15} height={15} className="shrink-0 text-red-600" />
          <span className="text-[12.5px] font-semibold text-red-800">
            {broken > 0
              ? `${broken} component${broken === 1 ? '' : 's'} destroyed`
              : `${shown.length} component${shown.length === 1 ? '' : 's'} over rating`}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setOpen(!open)}
              className="rounded px-2 py-0.5 text-[11.5px] font-medium text-red-700 hover:bg-red-100"
            >
              {open ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={() => setDismissed(failures.length)}
              title="Dismiss until the next failure"
              className="rounded px-2 py-0.5 text-[11.5px] text-red-600 hover:bg-red-100"
            >
              Dismiss
            </button>
          </div>
        </header>

        {open && (
          <ul className="max-h-56 overflow-auto">
            {shown.map((f, i) => (
              <li
                key={`${f.partId}-${f.title}-${i}`}
                className="border-b border-neutral-100 px-3 py-2 last:border-0"
              >
                <button
                  onClick={() => select({ parts: [f.partId] })}
                  className="block w-full text-left"
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-[12.5px] font-semibold ${
                        f.severity === 'breakdown' ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      {f.title}
                    </span>
                    <span className="truncate text-[11px] text-neutral-400">
                      {nameOf(f.partId)} · {f.t.toFixed(2)} s
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-neutral-600">{f.detail}</p>
                  {f.suggestion && (
                    <p className="mt-1 rounded bg-sky-50 px-2 py-1 text-[12px] leading-snug text-sky-900">
                      {f.suggestion}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
