'use client';

import { useDesignStore } from '@/state/designStore';

/**
 * Every edit in this session, newest first, with the point you are at marked.
 *
 * The undo stack has always carried a human-readable label for each entry —
 * "Move", "Rotate", "Wire colour" — and simply never showed them. Listing them
 * turns "press undo until it looks right" into picking the moment you meant,
 * which no comparable circuit editor offers.
 */
export function HistoryPanel({ onClose }: { onClose: () => void }) {
  const past = useDesignStore((s) => s.past);
  const future = useDesignStore((s) => s.future);
  const jumpTo = useDesignStore((s) => s.jumpTo);

  // Newest first: redoable steps above the present, undoable ones below.
  const rows = [
    ...future.map((e, i) => ({ label: e.label, step: future.length - i, state: 'ahead' as const })),
    { label: 'Now', step: 0, state: 'here' as const },
    ...past
      .slice()
      .reverse()
      .map((e, i) => ({ label: e.label, step: -(i + 1), state: 'behind' as const })),
  ];

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-30 w-[220px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.14)]">
      <header className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className="text-[12.5px] font-semibold text-neutral-800">History</span>
        <button
          onClick={onClose}
          className="rounded px-2 py-0.5 text-[11.5px] text-neutral-500 hover:bg-neutral-100"
        >
          Close
        </button>
      </header>

      {past.length === 0 && future.length === 0 ? (
        <p className="px-3 py-3 text-[12px] text-neutral-400">
          Nothing edited yet. Every change you make lands here.
        </p>
      ) : (
        <ul className="max-h-[320px] overflow-auto py-1">
          {rows.map((r, i) => (
            <li key={`${r.step}-${i}`}>
              <button
                disabled={r.state === 'here'}
                onClick={() => jumpTo(r.step)}
                className={`flex w-full items-baseline gap-2 px-3 py-1 text-left text-[12px] transition ${
                  r.state === 'here'
                    ? 'cursor-default bg-sky-50 font-semibold text-sky-700'
                    : r.state === 'ahead'
                      ? 'text-neutral-400 hover:bg-neutral-100'
                      : 'text-neutral-700 hover:bg-neutral-100'
                }`}
                title={
                  r.state === 'ahead'
                    ? 'Redo forward to here'
                    : r.state === 'behind'
                      ? 'Undo back to here'
                      : undefined
                }
              >
                <span className="truncate">{r.label}</span>
                {r.state !== 'here' && (
                  <span className="ml-auto shrink-0 text-[10.5px] text-neutral-400">
                    {r.step > 0 ? `+${r.step}` : r.step}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
