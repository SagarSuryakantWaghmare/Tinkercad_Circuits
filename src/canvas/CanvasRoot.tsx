'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDesignStore } from '@/state/designStore';
import type { PartInstance, WireEnd } from '@/state/design';
import { useEditorStore, type WireAnchor } from '@/state/editorStore';
import { useSimStore } from '@/state/simStore';
import { getPartDef } from '@/parts/registry';
import { originOf, sizeOf, terminalsOf, type PropValue } from '@/parts/types';
import {
  distToSegment,
  rectFromPoints,
  rectsIntersect,
  transformedBounds,
  type Rect,
  type Vec2,
} from '@/lib/geometry';
import { C } from '@/lib/tokens';
import { GRID_VISIBLE_ZOOM, PITCH, snap, TERMINAL_HIT_R } from '@/lib/units';
import { PlacedPart } from './items/PlacedPart';
import { DraftWire, WireItem, type ResolvedWire } from './items/WireItem';
import { NoteItem } from './items/NoteItem';
import { indexTerminals, pickTerminal, worldTerminals } from './terminals';
import { rotationStepFor, snapPlacement } from './snapping';
import { simBus } from '@/sim/bus';
import { ContextMenu, type MenuItem } from '@/editor/ContextMenu';
import { contentBounds, selectionBounds } from '@/editor/useHotkeys';

const DRAG_THRESHOLD = 3; // screen px before a click becomes a drag

export function CanvasRoot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const design = useDesignStore((s) => s.design);
  const transact = useDesignStore((s) => s.transact);
  const begin = useDesignStore((s) => s.begin);
  const commit = useDesignStore((s) => s.commit);

  const ed = useEditorStore();
  const running = useSimStore((s) => s.runState === 'running' || s.runState === 'paused');

  // ── geometry index, rebuilt only when the document actually changes ────────
  const terminalIndex = useMemo(() => indexTerminals(design), [design]);

  const partIds = useMemo(
    () =>
      Object.keys(design.parts).sort((a, b) => {
        const pa = design.parts[a];
        const pb = design.parts[b];
        const sa = getPartDef(pa.type)?.substrate ? 0 : 1;
        const sb = getPartDef(pb.type)?.substrate ? 0 : 1;
        return sa - sb || pa.z - pb.z;
      }),
    [design.parts],
  );

  const wires: ResolvedWire[] = useMemo(() => {
    // Resolve each end to a live terminal; an end whose part has been deleted
    // stays in the document but draws dashed rather than disappearing.
    const anchorOf = (end: WireEnd) => {
      if (end.kind === 'free') {
        return { pos: { x: end.x, y: end.y }, dir: [0, 0] as [number, number], resolved: true };
      }
      const t = terminalIndex.get(`${end.partId}:${end.terminal}`);
      return t
        ? { pos: t.pos, dir: t.dir, resolved: true }
        : { pos: { x: 0, y: 0 }, dir: [0, 0] as [number, number], resolved: false };
    };

    return Object.values(design.wires).map((w) => {
      const a = anchorOf(w.a);
      const b = anchorOf(w.b);
      return {
        id: w.id,
        a,
        b,
        waypoints: w.waypoints,
        color: w.color,
        dangling: !a.resolved || !b.resolved,
        kind: w.type,
      };
    });
  }, [design.wires, terminalIndex]);

  // ── viewport sizing ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      useEditorStore.getState().setViewport(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const screenOf = useCallback((e: { clientX: number; clientY: number }): Vec2 => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const worldOf = useCallback(
    (e: { clientX: number; clientY: number }): Vec2 =>
      useEditorStore.getState().toWorld(screenOf(e)),
    [screenOf],
  );

  // ── zoom ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const anchor = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (e.ctrlKey || e.metaKey) {
        useEditorStore.getState().zoomBy(Math.exp(-e.deltaY * 0.01), anchor);
      } else {
        useEditorStore.getState().zoomBy(Math.exp(-e.deltaY * 0.0015), anchor);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── pointer state machine ──────────────────────────────────────────────────
  const downRef = useRef<{ screen: Vec2; world: Vec2; moved: boolean } | null>(null);

  const onBackgroundDown = (e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 2 || e.altKey || spaceDown.current) {
      ed.setMode({ kind: 'pan', last: screenOf(e) });
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    // Placing a part chosen in the panel.
    if (ed.pendingPart) {
      placePart(ed.pendingPart, worldOf(e));
      ed.setPendingPart(null);
      return;
    }

    const world = worldOf(e);
    // Clicking a terminal on empty-ish space still starts a wire.
    const term = pickTerminal(design, world, TERMINAL_HIT_R * 1.6);
    if (term) return startWire(e, term.partId, term.def.name);

    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    downRef.current = { screen: screenOf(e), world, moved: false };
    ed.setMode({ kind: 'marquee', from: world, to: world, additive: e.shiftKey });
    if (!e.shiftKey) ed.clearSelection();
  };

  const onPartDown = (e: React.PointerEvent, partId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const world = worldOf(e);

    // A pending part drops wherever you click, including on top of a board.
    if (ed.pendingPart) {
      placePart(ed.pendingPart, world);
      ed.setPendingPart(null);
      return;
    }

    // A terminal under the cursor wins over the body — that's how you start a wire.
    const term = pickTerminal(design, world, TERMINAL_HIT_R * 1.6);
    if (term) return startWire(e, term.partId, term.def.name);

    if (running) return; // parts are immovable while the sim runs

    const already = ed.selectedParts.includes(partId);
    if (!already) {
      ed.select({ parts: [partId], additive: e.shiftKey });
    } else if (e.shiftKey) {
      ed.select({ parts: ed.selectedParts.filter((p) => p !== partId) });
      return;
    }

    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    downRef.current = { screen: screenOf(e), world, moved: false };
    begin('Move');
    ed.setMode({ kind: 'dragParts', origin: world, moved: false });
  };

  function startWire(e: React.PointerEvent, partId: string, terminal: string) {
    const t = terminalIndex.get(`${partId}:${terminal}`);
    if (!t) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const from: WireAnchor = { partId, terminal, pos: t.pos, dir: t.dir };
    ed.setMode({ kind: 'drawWire', from, points: [], cursor: t.pos, toward: null });
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const mode = ed.mode;
    if (mode.kind === 'idle') {
      // Terminal hover feedback.
      const world = worldOf(e);
      const t = pickTerminal(design, world, TERMINAL_HIT_R * 1.4);
      const cur = ed.hoverTerminal;
      const next = t ? { partId: t.partId, terminal: t.def.name } : null;
      if (cur?.partId !== next?.partId || cur?.terminal !== next?.terminal) {
        ed.setHoverTerminal(next);
      }
      return;
    }

    if (mode.kind === 'pan') {
      const s = screenOf(e);
      ed.panBy(s.x - mode.last.x, s.y - mode.last.y);
      ed.setMode({ kind: 'pan', last: s });
      return;
    }

    if (mode.kind === 'marquee') {
      ed.setMode({ ...mode, to: worldOf(e) });
      return;
    }

    if (mode.kind === 'drawWire') {
      const world = worldOf(e);
      const t = pickTerminal(design, world, TERMINAL_HIT_R * 1.6, {
        partId: mode.from.partId,
        terminal: mode.from.terminal,
      });
      ed.setMode({
        ...mode,
        cursor: world,
        toward: t ? { partId: t.partId, terminal: t.def.name, pos: t.pos, dir: t.dir } : null,
      });
      return;
    }

    if (mode.kind === 'dragWaypoint') {
      const world = worldOf(e);
      transact('Reshape wire', (dd) => {
        const w = dd.wires[mode.wireId];
        if (!w || !w.waypoints[mode.index]) return;
        w.waypoints[mode.index] = { x: snap(world.x), y: snap(world.y) };
      });
      return;
    }

    if (mode.kind === 'dragParts') {
      const d = downRef.current;
      if (!d) return;
      const s = screenOf(e);
      if (!d.moved && Math.hypot(s.x - d.screen.x, s.y - d.screen.y) < DRAG_THRESHOLD) return;
      d.moved = true;

      const world = worldOf(e);
      const dx = world.x - mode.origin.x;
      const dy = world.y - mode.origin.y;
      const ids = ed.selectedParts;
      const moving = new Set(ids);

      transact('Move', (dd) => {
        // Snap using the primary (first) part, then apply the same delta to all
        // so a multi-selection keeps its internal spacing.
        const lead = dd.parts[ids[0]];
        if (!lead) return;
        const snapped = snapPlacement(
          dd,
          lead,
          { x: lead.x + dx, y: lead.y + dy },
          moving,
        );
        const adx = snapped.x - lead.x;
        const ady = snapped.y - lead.y;
        for (const id of ids) {
          const p = dd.parts[id];
          if (!p || p.locked) continue;
          p.x += adx;
          p.y += ady;
        }
      });
      ed.setMode({ kind: 'dragParts', origin: { x: mode.origin.x + dx, y: mode.origin.y + dy }, moved: true });
    }
  };

  const onPointerUp = () => {
    const mode = ed.mode;

    if (mode.kind === 'pan') {
      ed.setMode({ kind: 'idle' });
      return;
    }

    if (mode.kind === 'marquee') {
      const r = rectFromPoints(mode.from, mode.to);
      if (r.w > 2 || r.h > 2) {
        const hitParts = partIds.filter((id) => rectsIntersect(r, boundsOf(design.parts[id])));
        ed.select({ parts: hitParts, additive: mode.additive });
      }
      ed.setMode({ kind: 'idle' });
      downRef.current = null;
      return;
    }

    if (mode.kind === 'dragWaypoint') {
      commit();
      ed.setMode({ kind: 'idle' });
      return;
    }

    if (mode.kind === 'dragParts') {
      commit();
      ed.setMode({ kind: 'idle' });
      downRef.current = null;
      return;
    }

    if (mode.kind === 'drawWire') {
      if (mode.toward) {
        finishWire(mode.from, mode.toward, mode.points);
        ed.setMode({ kind: 'idle' });
      } else {
        // Click without a target drops a bend point and keeps routing.
        ed.setMode({ ...mode, points: [...mode.points, mode.cursor] });
      }
      return;
    }
  };

  function finishWire(from: WireAnchor, to: WireAnchor, waypoints: Vec2[]) {
    if (from.partId === to.partId && from.terminal === to.terminal) return;
    transact('Wire', (d) => {
      const id = `w_${Math.random().toString(36).slice(2, 10)}`;
      d.wires[id] = {
        id,
        a: { kind: 'terminal', partId: from.partId, terminal: from.terminal },
        b: { kind: 'terminal', partId: to.partId, terminal: to.terminal },
        waypoints,
        color: useEditorStore.getState().wireColor,
        type: 'wire',
      };
    });
  }

  function placePart(type: string, at: Vec2) {
    const def = getPartDef(type);
    if (!def) return;
    transact('Add component', (d) => {
      const id = `p_${Math.random().toString(36).slice(2, 10)}`;
      let z = 0;
      for (const k in d.parts) z = Math.max(z, d.parts[k].z);
      const inst = {
        id,
        type,
        x: at.x,
        y: at.y,
        rotation: 0,
        mirrored: false,
        props: { ...(def.defaults as Record<string, never>) },
        z: z + 1,
      };
      const snapped = snapPlacement(d, inst, at, new Set([id]));
      inst.x = snapped.x;
      inst.y = snapped.y;
      d.parts[id] = inst;
      useEditorStore.getState().select({ parts: [id] });
    });
  }

  /**
   * Put a new bend point on a wire, at the position double-clicked.
   *
   * Inserted at the segment nearest the click rather than appended, so a bend
   * added in the middle of a long wire stays in the middle instead of sending
   * the route back on itself.
   */
  function addWaypoint(wireId: string, at: Vec2) {
    const w = design.wires[wireId];
    if (!w) return;
    const ends = wires.find((r) => r.id === wireId);
    if (!ends) return;

    const path = [ends.a.pos, ...w.waypoints, ends.b.pos];
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const d = distToSegment(at, path[i], path[i + 1]);
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }
    transact('Add bend point', (dd) => {
      const wire = dd.wires[wireId];
      if (!wire) return;
      wire.waypoints.splice(bestIndex, 0, { x: snap(at.x), y: snap(at.y) });
    });
    ed.select({ wires: [wireId] });
  }

  function boundsOf(inst: (typeof design.parts)[string]): Rect {
    const def = getPartDef(inst.type)!;
    return transformedBounds(
      sizeOf(def, inst.props as never),
      originOf(def, inst.props as never),
      { x: inst.x, y: inst.y },
      inst.rotation,
      inst.mirrored,
    );
  }

  // ── keyboard ───────────────────────────────────────────────────────────────
  const spaceDown = useRef(false);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = true;
      if (e.key === 'Escape') {
        useEditorStore.getState().setMode({ kind: 'idle' });
        useEditorStore.getState().setPendingPart(null);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // ── notes ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onNewNote = () => {
      const st = useEditorStore.getState();
      // Drop it near the middle of what the user is looking at.
      const at = st.toWorld({ x: st.viewport.w / 2, y: st.viewport.h / 2 });
      let created = '';
      useDesignStore.getState().transact('Add note', (d) => {
        const id = `n_${Math.random().toString(36).slice(2, 10)}`;
        d.notes[id] = { id, x: at.x, y: at.y, text: '' };
        created = id;
      });
      st.select({ notes: [created] });
      // A new note is useless if notes are hidden.
      st.setNotesVisible(true);
    };
    window.addEventListener('circuitlab:new-note', onNewNote);
    return () => window.removeEventListener('circuitlab:new-note', onNewNote);
  }, []);

  const onNoteDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const start = worldOf(e);
    const note = design.notes[id];
    if (!note) return;
    ed.select({ notes: [id] });
    const base = { x: note.x, y: note.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    begin('Move note');
    const move = (ev: PointerEvent) => {
      const w = useEditorStore.getState().toWorld(screenOf(ev));
      transact('Move note', (d) => {
        const n = d.notes[id];
        if (n) {
          n.x = base.x + (w.x - start.x);
          n.y = base.y + (w.y - start.y);
        }
      });
    };
    const up = () => {
      commit();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── interaction forwarding into the running simulation ────────────────────
  const onInteract = useCallback(
    (partId: string, event: string, value?: number | boolean) => {
      simBus.emit({ partId, event, value });
    },
    [],
  );

  const onSetProp = useCallback(
    (partId: string, key: string, value: PropValue) => {
      transact('Change property', (d) => {
        const p = d.parts[partId];
        if (p) p.props[key] = value;
      });
    },
    [transact],
  );

  // ── right-click menu ───────────────────────────────────────────────────────
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const menuItems = useMemo((): MenuItem[] => {
    const sel = ed.selectedParts;
    const has = sel.length > 0 || ed.selectedWires.length > 0;
    const mutate = (label: string, fn: (p: PartInstance) => void) => () =>
      transact(label, (d) => {
        for (const id of sel) {
          const p = d.parts[id];
          if (p) fn(p);
        }
      });

    return [
      {
        label: 'Duplicate',
        hint: 'Ctrl D',
        disabled: !sel.length,
        onSelect: () => {
          const created: string[] = [];
          transact('Duplicate', (d) => {
            let z = 0;
            for (const k in d.parts) z = Math.max(z, d.parts[k].z);
            for (const id of sel) {
              const p = d.parts[id];
              if (!p) continue;
              const nid = `p_${Math.random().toString(36).slice(2, 10)}`;
              d.parts[nid] = { ...p, id: nid, x: p.x + 20, y: p.y + 20, z: ++z, props: { ...p.props } };
              created.push(nid);
            }
          });
          useEditorStore.getState().select({ parts: created });
        },
      },
      {
        label: 'Rotate',
        hint: 'R',
        disabled: !sel.length,
        onSelect: mutate('Rotate', (p) => {
          p.rotation = (p.rotation + rotationStepFor(p)) % 360;
        }),
      },
      {
        label: 'Mirror',
        hint: 'M',
        disabled: !sel.length,
        onSelect: mutate('Mirror', (p) => void (p.mirrored = !p.mirrored)),
      },
      { label: '', separator: true },
      {
        label: 'Bring to front',
        hint: ']',
        disabled: !sel.length,
        onSelect: () =>
          transact('Bring to front', (d) => {
            let hi = -Infinity;
            for (const k in d.parts) hi = Math.max(hi, d.parts[k].z);
            let step = 0;
            for (const id of sel) if (d.parts[id]) d.parts[id].z = hi + 1 + step++;
          }),
      },
      {
        label: 'Send to back',
        hint: '[',
        disabled: !sel.length,
        onSelect: () =>
          transact('Send to back', (d) => {
            let lo = Infinity;
            for (const k in d.parts) lo = Math.min(lo, d.parts[k].z);
            let step = 0;
            for (const id of sel) if (d.parts[id]) d.parts[id].z = lo - 1 - step++;
          }),
      },
      { label: '', separator: true },
      {
        label: 'Zoom to selection',
        hint: 'Shift F',
        disabled: !sel.length,
        onSelect: () => useEditorStore.getState().fitTo(selectionBounds()),
      },
      {
        label: 'Zoom to fit',
        hint: 'F',
        onSelect: () => useEditorStore.getState().fitTo(contentBounds()),
      },
      {
        label: 'Add a note here',
        hint: 'N',
        onSelect: () => window.dispatchEvent(new CustomEvent('circuitlab:new-note')),
      },
      { label: '', separator: true },
      {
        label: 'Delete',
        hint: 'Del',
        danger: true,
        disabled: !has,
        onSelect: () => {
          const st2 = useEditorStore.getState();
          transact('Delete', (d) => {
            for (const id of st2.selectedParts) {
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
            for (const id of st2.selectedWires) delete d.wires[id];
          });
          st2.clearSelection();
        },
      },
      {
        label: 'Keyboard shortcuts',
        hint: '?',
        onSelect: () => window.dispatchEvent(new CustomEvent('circuitlab:shortcuts')),
      },
    ];
  }, [transact, ed.selectedParts, ed.selectedWires]);

  // ── derived render data ────────────────────────────────────────────────────
  const { pan, zoom } = ed;
  const showGrid = zoom >= GRID_VISIBLE_ZOOM;
  const hoverGroup = useHoverGroupTerminals(design, ed.hoverTerminal);

  return (
    <svg
      ref={svgRef}
      className="circuitlab-canvas absolute inset-0 h-full w-full touch-none select-none"
      style={{ background: C.canvasBg, cursor: cursorFor(ed.mode.kind, !!ed.pendingPart) }}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => {
        e.preventDefault();
        const el = (e.target as Element).closest('[data-part],[data-wire]');
        const partId = el?.getAttribute('data-part');
        const wireId = el?.getAttribute('data-wire');
        if (partId && !ed.selectedParts.includes(partId)) ed.select({ parts: [partId] });
        else if (wireId && !ed.selectedWires.includes(wireId)) ed.select({ wires: [wireId] });
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* The menu is HTML, so it renders to the body rather than into the SVG. */}
      {menu &&
        typeof document !== 'undefined' &&
        createPortal(
          <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />,
          document.body,
        )}
      <defs>
        <pattern
          id="dotgrid"
          width={PITCH}
          height={PITCH}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={0} cy={0} r={0.6} fill={C.gridDot} />
        </pattern>
      </defs>

      <g data-scene transform={`scale(${zoom},${zoom}) translate(${pan.x},${pan.y})`}>
        {/* 0 — grid */}
        {showGrid && (
          <rect
            x={-pan.x - 200}
            y={-pan.y - 200}
            width={ed.viewport.w / zoom + 400}
            height={ed.viewport.h / zoom + 400}
            fill="url(#dotgrid)"
            pointerEvents="none"
            data-export="false"
          />
        )}

        {/* 3 — parts */}
        <g>
          {partIds.map((id) => (
            <PlacedPart
              key={id}
              inst={design.parts[id]}
              selected={ed.selectedParts.includes(id)}
              hovered={ed.hoverPart === id}
              simulating={running}
              view={ed.componentView}
              onPointerDown={onPartDown}
              onPointerEnter={ed.setHoverPart}
              onPointerLeave={() => ed.setHoverPart(null)}
              onInteract={onInteract}
              onSetProp={onSetProp}
            />
          ))}
        </g>

        {/* 5 — wires */}
        <g>
          {wires.map((w) => (
            <WireItem
              key={w.id}
              wire={w}
              selected={ed.selectedWires.includes(w.id)}
              hovered={false}
              onPointerDown={(e, id) => {
                e.stopPropagation();
                ed.select({ wires: [id], additive: e.shiftKey });
              }}
              onWaypointDown={(e, id, index) => {
                e.stopPropagation();
                begin('Reshape wire');
                ed.setMode({ kind: 'dragWaypoint', wireId: id, index });
              }}
              onAddWaypoint={(e, id) => {
                e.stopPropagation();
                addWaypoint(id, ed.toWorld(screenOf(e)));
              }}
              onPointerEnter={() => {}}
              onPointerLeave={() => {}}
            />
          ))}
        </g>

        {/* 7 — terminal-group highlight */}
        {hoverGroup.length > 0 && (
          <g pointerEvents="none" data-export="false">
            {hoverGroup.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={4.5} fill={C.netHighlight} opacity={0.85} />
            ))}
          </g>
        )}

        {/* 8 — hovered terminal */}
        <TerminalHover design={design} hover={ed.hoverTerminal} index={terminalIndex} />

        {/* 9 — selection */}
        <g pointerEvents="none" data-export="false">
          {ed.selectedParts.map((id) => {
            const inst = design.parts[id];
            if (!inst) return null;
            const b = boundsOf(inst);
            return (
              <rect
                key={id}
                x={b.x - 3}
                y={b.y - 3}
                width={b.w + 6}
                height={b.h + 6}
                rx={2}
                fill="none"
                stroke={C.select}
                strokeWidth={1.6}
                strokeDasharray="6 3"
              />
            );
          })}
        </g>

        {/* 11 — notes */}
        {ed.notesVisible && (
          <g>
            {Object.values(design.notes).map((n) => (
              <NoteItem
                key={n.id}
                note={n}
                selected={ed.selectedNotes.includes(n.id)}
                onPointerDown={onNoteDown}
                onChange={(text) =>
                  transact('Edit note', (d) => {
                    const note = d.notes[n.id];
                    if (note) note.text = text;
                  })
                }
                onDelete={(id) => {
                  transact('Delete note', (d) => void delete d.notes[id]);
                  ed.clearSelection();
                }}
              />
            ))}
          </g>
        )}

        {/* 10 — interaction */}
        {ed.mode.kind === 'marquee' && (
          <MarqueeRect from={ed.mode.from} to={ed.mode.to} />
        )}
        {ed.mode.kind === 'drawWire' && (
          <DraftWire
            from={{ pos: ed.mode.from.pos, dir: ed.mode.from.dir }}
            points={ed.mode.points}
            cursor={ed.mode.cursor}
            color={ed.wireColor}
            snapped={ed.mode.toward ? { pos: ed.mode.toward.pos, dir: ed.mode.toward.dir } : null}
          />
        )}
      </g>
    </svg>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function MarqueeRect({ from, to }: { from: Vec2; to: Vec2 }) {
  const r = rectFromPoints(from, to);
  return (
    <rect
      x={r.x}
      y={r.y}
      width={r.w}
      height={r.h}
      fill={C.select}
      fillOpacity={0.08}
      stroke={C.select}
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}

function TerminalHover({
  design,
  hover,
  index,
}: {
  design: ReturnType<typeof useDesignStore.getState>['design'];
  hover: { partId: string; terminal: string } | null;
  index: Map<string, ReturnType<typeof worldTerminals>[number]>;
}) {
  if (!hover) return null;
  const t = index.get(`${hover.partId}:${hover.terminal}`);
  if (!t) return null;
  const inst = design.parts[hover.partId];
  const label = inst?.name ? `${inst.name} · ${t.def.name}` : t.def.name;
  return (
    <g pointerEvents="none">
      <circle cx={t.pos.x} cy={t.pos.y} r={5.5} fill={C.netHighlight} opacity={0.35} />
      <circle
        cx={t.pos.x}
        cy={t.pos.y}
        r={3.2}
        fill="#fff"
        stroke={C.netHighlight}
        strokeWidth={1.6}
      />
      <g transform={`translate(${t.pos.x + 10},${t.pos.y - 14})`}>
        <rect
          x={0}
          y={-8}
          width={label.length * 5.2 + 10}
          height={16}
          rx={3}
          fill="#2B2F33"
          opacity={0.92}
        />
        <text x={5} y={0} fontSize={9} fill="#fff" dominantBaseline="central">
          {label}
        </text>
      </g>
    </g>
  );
}

/** Every hole of the hovered terminal's internal group, so a breadboard row lights up. */
function useHoverGroupTerminals(
  design: ReturnType<typeof useDesignStore.getState>['design'],
  hover: { partId: string; terminal: string } | null,
): Vec2[] {
  return useMemo(() => {
    if (!hover) return [];
    const inst = design.parts[hover.partId];
    if (!inst) return [];
    const def = getPartDef(inst.type);
    if (!def) return [];
    const list = terminalsOf(def, inst.props as never);
    const me = list.find((t) => t.name === hover.terminal);
    if (!me?.group) return [];
    return worldTerminals(inst)
      .filter((t) => t.def.group === me.group && t.def.name !== me.name)
      .map((t) => t.pos);
  }, [design, hover]);
}

function cursorFor(kind: string, placing: boolean) {
  if (placing) return 'copy';
  switch (kind) {
    case 'pan':
      return 'grabbing';
    case 'drawWire':
      return 'crosshair';
    case 'marquee':
      return 'crosshair';
    default:
      return 'default';
  }
}
