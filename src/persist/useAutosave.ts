'use client';

import { useEffect, useRef } from 'react';
import { useDesignStore } from '@/state/designStore';
import { makeThumbnail } from './exporters';
import { saveDesign } from './store';

/**
 * Autosave. The document is written to IndexedDB a beat after the user stops
 * editing, and the dashboard thumbnail is refreshed on a slower cadence
 * because rasterising the canvas is the expensive half.
 */
export function useAutosave(enabled = true) {
  const revision = useDesignStore((s) => s.revision);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastThumb = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(async () => {
      const design = useDesignStore.getState().design;
      const now = Date.now();
      const wantThumb = now - lastThumb.current > 15_000;
      const thumb = wantThumb ? await makeThumbnail(design) : undefined;
      if (thumb) lastThumb.current = now;
      try {
        await saveDesign(design, thumb);
      } catch {
        // Storage can be unavailable (private mode, quota); the editor keeps
        // working from memory, so a failed save is not worth interrupting for.
      }
    }, 800);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [revision, enabled]);

  // Best-effort flush when the tab goes away.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => void saveDesign(useDesignStore.getState().design).catch(() => {});
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [enabled]);
}
