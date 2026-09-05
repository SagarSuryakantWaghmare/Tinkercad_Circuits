'use client';

import { useEffect } from 'react';
import { useDesignStore } from '@/state/designStore';
import { useEditorStore } from '@/state/editorStore';
import { transformedBounds, unionRect, type Rect } from '@/lib/geometry';
import { getPartDef } from '@/parts/registry';
import { WIRE_COLORS } from '@/lib/tokens';
import { rotationStepFor } from '@/canvas/snapping';

/** Bounding box of everything placed, for zoom-to-fit. */
export function contentBounds(): Rect | null {
  const { parts } = useDesignStore.getState().design;
  let box: Rect | null = null;
  for (const id in parts) {
    const inst = parts[id];
    const def = getPartDef(inst.type);
    if (!def) continue;
    box = unionRect(
      box,
      transformedBounds(def.size, def.origin, { x: inst.x, y: inst.y }, inst.rotation, inst.mirrored),
    );
  }
  return box;
}

/** Bounding box of the current selection, or null when nothing is selected. */
export function selectionBounds(): Rect | null {
  const { parts } = useDesignStore.getState().design;
  const { selectedParts } = useEditorStore.getState();
  let box: Rect | null = null;
  for (const id of selectedParts) {
    const inst = parts[id];
    const def = inst && getPartDef(inst.type);
    if (!def) continue;
    box = unionRect(
      box,
      transformedBounds(def.size, def.origin, { x: inst.x, y: inst.y }, inst.rotation, inst.mirrored),
    );
  }
  return box;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
};

export function useHotkeys() {
  useEffect(() => {
    const clipboard: { parts: unknown[] } = { parts: [] };

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const ds = useDesignStore.getState();
      const ed = useEditorStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      // ── history ──
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) ds.redo();
        else ds.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        ds.redo();
        return;
      }

      // ── selection ──
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        ed.select({
          parts: Object.keys(ds.design.parts),
          wires: Object.keys(ds.design.wires),
        });
        return;
      }

      // ── clipboard ──
      if (mod && e.key.toLowerCase() === 'c') {
        clipboard.parts = ed.selectedParts
          .map((id) => ds.design.parts[id])
          .filter(Boolean)
          .map((p) => ({ ...p, props: { ...p.props } }));
        return;
      }
      if ((mod && e.key.toLowerCase() === 'v') || (mod && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        const source =
          e.key.toLowerCase() === 'd'
            ? ed.selectedParts.map((id) => ds.design.parts[id]).filter(Boolean)
            : (clipboard.parts as (typeof ds.design.parts)[string][]);
        if (!source.length) return;
        const created: string[] = [];
        ds.transact('Paste', (d) => {
          let z = 0;
          for (const k in d.parts) z = Math.max(z, d.parts[k].z);
          for (const p of source) {
            const id = `p_${Math.random().toString(36).slice(2, 10)}`;
            d.parts[id] = { ...p, id, x: p.x + 20, y: p.y + 20, z: ++z, props: { ...p.props } };
            created.push(id);
          }
        });
        ed.select({ parts: created });
        return;
      }

      // ── delete ──
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (!ed.selectedParts.length && !ed.selectedWires.length) return;
        ds.transact('Delete', (d) => {
          for (const id of ed.selectedParts) {
            delete d.parts[id];
            for (const wid in d.wires) {
              const w = d.wires[wid];
              if (
                (w.a.kind === 'terminal' && w.a.partId === id) ||
                (w.b.kind === 'terminal' && w.b.partId === id)
              )
                delete d.wires[wid];
            }
          }
          for (const id of ed.selectedWires) delete d.wires[id];
        });
        ed.clearSelection();
        return;
      }

      // ── rotate ──
      if (e.key.toLowerCase() === 'r' && !mod) {
        if (!ed.selectedParts.length) return;
        e.preventDefault();
        ds.transact('Rotate', (d) => {
          for (const id of ed.selectedParts) {
            const p = d.parts[id];
            if (p) p.rotation = (p.rotation + rotationStepFor(p)) % 360;
          }
        });
        return;
      }

      // ── mirror ──
      if (e.key.toLowerCase() === 'm' && !mod) {
        if (!ed.selectedParts.length) return;
        e.preventDefault();
        ds.transact('Mirror', (d) => {
          for (const id of ed.selectedParts) {
            const p = d.parts[id];
            if (p) p.mirrored = !p.mirrored;
          }
        });
        return;
      }

      // ── stacking order ──
      if ((e.key === '[' || e.key === ']') && !mod) {
        if (!ed.selectedParts.length) return;
        e.preventDefault();
        const toFront = e.key === ']';
        ds.transact(toFront ? 'Bring to front' : 'Send to back', (d) => {
          let lo = Infinity;
          let hi = -Infinity;
          for (const k in d.parts) {
            lo = Math.min(lo, d.parts[k].z);
            hi = Math.max(hi, d.parts[k].z);
          }
          let step = 0;
          for (const id of ed.selectedParts) {
            const p = d.parts[id];
            if (p) p.z = toFront ? hi + 1 + step++ : lo - 1 - step++;
          }
        });
        return;
      }

      // ── zoom to fit, or to the selection ──
      if (e.key.toLowerCase() === 'f' && !mod) {
        e.preventDefault();
        ed.fitTo(e.shiftKey ? (selectionBounds() ?? contentBounds()) : contentBounds());
        return;
      }

      // ── simulation and the code panel ──
      if (e.key.toLowerCase() === 's' && !mod) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('circuitlab:toggle-sim'));
        return;
      }
      if (e.key.toLowerCase() === 'c' && !mod) {
        e.preventDefault();
        ed.setCodeOpen(!ed.codeOpen);
        return;
      }

      // ── the shortcut sheet ──
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('circuitlab:shortcuts'));
        return;
      }

      // ── notes ──
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (e.shiftKey) ed.toggleNotes();
        else window.dispatchEvent(new CustomEvent('circuitlab:new-note'));
        return;
      }

      // ── wire colour by number key ──
      if (/^[0-9]$/.test(e.key) && !mod) {
        const c = WIRE_COLORS.find((w) => w.key === e.key);
        if (!c) return;
        ed.setWireColor(c.key);
        if (ed.selectedWires.length) {
          ds.transact('Wire colour', (d) => {
            for (const id of ed.selectedWires) if (d.wires[id]) d.wires[id].color = c.key;
          });
        }
        return;
      }

      // ── nudge ──
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-5, 0],
        ArrowRight: [5, 0],
        ArrowUp: [0, -5],
        ArrowDown: [0, 5],
      };
      if (nudge[e.key] && ed.selectedParts.length) {
        e.preventDefault();
        const [dx, dy] = nudge[e.key];
        const k = e.shiftKey ? 10 : 1; // 5 units, or a 50-unit stride
        ds.transact('Nudge', (d) => {
          for (const id of ed.selectedParts) {
            const p = d.parts[id];
            if (p) {
              p.x += dx * k;
              p.y += dy * k;
            }
          }
        });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
