import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Start a value drag from inside a part's art.
 *
 * Knobs, sliders and sensor levels are all "grab and move" affordances during
 * simulation. Listeners go on the window so the gesture survives the pointer
 * leaving the small SVG target, and the callback receives per-move deltas in
 * screen pixels — the caller decides what a pixel means for its own units.
 */
export function beginValueDrag(
  e: ReactPointerEvent,
  onDelta: (dx: number, dy: number) => void,
  onEnd?: () => void,
) {
  e.stopPropagation();
  e.preventDefault();

  let last = { x: e.clientX, y: e.clientY };

  const move = (ev: PointerEvent) => {
    const dx = ev.clientX - last.x;
    const dy = ev.clientY - last.y;
    last = { x: ev.clientX, y: ev.clientY };
    if (dx || dy) onDelta(dx, dy);
  };

  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    onEnd?.();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
