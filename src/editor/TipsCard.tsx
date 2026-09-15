'use client';

import { useEffect, useState } from 'react';

import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { IconLightbulb } from './icons';

const TIPS = [
  'Press H for the hand tool — then drag the canvas to pan around your workspace.',
  'Drag components from the panel on the right onto the canvas to start building.',
  'Click Start Simulation (top right) to bring your circuit to life.',
  'Select any part to see its properties, live values, and learn-more notes in the Inspector.',
  'Try the Starters drawer for pre-built circuits — a fast way to see how something is wired.',
  'Right-click or middle-click and drag to pan without switching tools. Scroll to zoom.',
  'Press ? at any time to open the full keyboard shortcuts cheatsheet.',
];

const DISMISS_KEY = 'circuitlab.tips.dismissed';
const ROTATE_MS = 7000;

export function TipsCard() {
  const partCount = useDesignStore((s) => Object.keys(s.design.parts).length);
  const pendingPart = useEditorStore((s) => s.pendingPart);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % TIPS.length), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  // Only shown on a truly empty canvas so it never gets in the way once the
  // user is actually building. Placement mode also hides it — the placement
  // banner already claims the attention.
  if (dismissed || partCount > 0 || pendingPart) return null;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 flex max-w-sm items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 shadow-sm">
      <IconLightbulb width={16} height={16} />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
          Tip for new students
        </div>
        <div className="mt-0.5 text-[12.5px] leading-snug text-neutral-800">{TIPS[index]}</div>
      </div>
      <button
        type="button"
        aria-label="Dismiss tips"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            // Non-fatal — the state stays for the session even if we cannot persist it.
          }
        }}
        className="ml-1 rounded p-0.5 text-neutral-500 hover:bg-amber-100 hover:text-neutral-800"
        title="Hide tips"
      >
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M2 2 L10 10 M10 2 L2 10" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
