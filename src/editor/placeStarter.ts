'use client';

import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import type { Starter } from '@/starters';
import { applyStarter } from '@/starters/apply';
import { contentBounds } from './useHotkeys';

/**
 * Load a starter over the open design as one undoable step. Every way into a
 * starter from the editor — the panel, the inspector's suggestions, dropping
 * one on the canvas — goes through here so they cannot drift apart.
 */
export function placeStarter(starter: Starter) {
  const busy = Object.keys(useDesignStore.getState().design.parts).length > 0;
  if (busy) {
    const ok = window.confirm(
      `Replace the current design with “${starter.name}”?\n\nYour existing components and code will be cleared. Undo brings them back.`,
    );
    if (!ok) return;
  }

  const content = starter.build();
  useDesignStore
    .getState()
    .transact(`Starter: ${starter.name}`, (d) => applyStarter(d, starter.name, content));

  const ed = useEditorStore.getState();
  ed.clearSelection();
  if (content.code || content.python) ed.setCodeOpen(true);
  // Let the parts commit before measuring them.
  setTimeout(() => ed.fitTo(contentBounds()), 40);
}
