'use client';

import { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect?: () => void;
  /** A horizontal rule instead of a row. */
  separator?: boolean;
}

/**
 * Canvas context menu.
 *
 * Right-clicking is how people reach for rotate, duplicate and delete without
 * remembering the shortcut, so every item shows its key next to it — the menu
 * teaches the keyboard rather than replacing it.
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Pointer-down rather than click, so the menu closes before a drag starts.
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  // Keep the menu inside the window when opened near an edge.
  const w = 216;
  const h = items.length * 27 + 12;
  const left = Math.min(x, Math.max(8, window.innerWidth - w - 8));
  const top = Math.min(y, Math.max(8, window.innerHeight - h - 8));

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[216px] rounded-lg border border-neutral-200 bg-white py-1.5 shadow-xl"
      style={{ left, top }}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={`s${i}`} className="my-1 border-t border-neutral-100" />
        ) : (
          <button
            key={it.label}
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              it.onSelect?.();
              onClose();
            }}
            className={`flex w-full items-center justify-between gap-6 px-3 py-1 text-left text-[12.5px] transition ${
              it.disabled
                ? 'cursor-default text-neutral-300'
                : it.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <span>{it.label}</span>
            {it.hint && <span className="text-[11px] text-neutral-400">{it.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
