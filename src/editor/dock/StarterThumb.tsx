'use client';

import { memo, useMemo } from 'react';
import { getPartDef } from '@/parts/registry';
import { worldTerminals } from '@/canvas/terminals';
import { roundedPath, routePolyline, type RouteAnchor } from '@/canvas/routing/orthoRoute';
import type { Starter } from '@/starters';
import type { WireEnd } from '@/state/design';
import { transformedBounds, unionRect, type Rect, type Vec2 } from '@/lib/geometry';
import { C, wireHex } from '@/lib/tokens';
import { WIRE_CORE_W, WIRE_HALO_W } from '@/lib/units';

function StarterThumbInner({
  starter,
  width = '100%',
  height = '100%',
}: {
  starter: Starter;
  width?: number | string;
  height?: number | string;
}) {
  const { parts, wires, viewBox } = useMemo(() => {
    try {
      const content = starter.build();
      let box: Rect | null = null;

      // Index world terminals for all parts in the starter
      const terminalIndex = new Map<string, { pos: Vec2; dir: [number, number] }>();

      for (const p of content.parts) {
        const def = getPartDef(p.type);
        if (!def) continue;

        const b = transformedBounds(
          def.size,
          def.origin,
          { x: p.x, y: p.y },
          p.rotation ?? 0,
          p.mirrored ?? false,
        );
        box = unionRect(box, b);

        for (const t of worldTerminals(p)) {
          terminalIndex.set(`${p.id}:${t.def.name}`, { pos: t.pos, dir: t.dir });
        }
      }

      const anchorOf = (end: WireEnd): RouteAnchor => {
        if (end.kind === 'free') {
          return { pos: { x: end.x, y: end.y }, dir: [0, 0] };
        }
        const t = terminalIndex.get(`${end.partId}:${end.terminal}`);
        return t ? { pos: t.pos, dir: t.dir } : { pos: { x: 0, y: 0 }, dir: [0, 0] };
      };

      const resolvedWires: {
        id: string;
        color: string;
        d: string;
      }[] = [];

      for (const w of content.wires) {
        const a = anchorOf(w.a);
        const b = anchorOf(w.b);

        let d: string;
        if (w.type === 'jumper') {
          const pts = [a.pos, ...(w.waypoints ?? []), b.pos];
          d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
          for (const pt of pts) {
            box = unionRect(box, { x: pt.x, y: pt.y, w: 1, h: 1 });
          }
        } else {
          const polyline = routePolyline(a, b, w.waypoints ?? []);
          d = roundedPath(polyline);
          for (const pt of polyline) {
            box = unionRect(box, { x: pt.x, y: pt.y, w: 1, h: 1 });
          }
        }

        resolvedWires.push({
          id: w.id,
          color: w.color,
          d,
        });
      }

      if (!box || box.w <= 0 || box.h <= 0) {
        box = { x: -100, y: -100, w: 200, h: 200 };
      }

      const pad = Math.max(16, Math.min(box.w, box.h) * 0.08);
      const minX = box.x - pad;
      const minY = box.y - pad;
      const w = box.w + pad * 2;
      const h = box.h + pad * 2;

      // Sort parts: substrates (breadboards) at bottom, others on top
      const sortedParts = [...content.parts].sort((a, b) => {
        const defA = getPartDef(a.type);
        const defB = getPartDef(b.type);
        const subA = defA?.substrate ? 1 : 0;
        const subB = defB?.substrate ? 1 : 0;
        return subA - subB || a.z - b.z;
      });

      return {
        parts: sortedParts,
        wires: resolvedWires,
        viewBox: `${minX} ${minY} ${w} ${h}`,
      };
    } catch {
      return { parts: [], wires: [], viewBox: '-100 -100 200 200' };
    }
  }, [starter]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none select-none"
    >
      {/* 1. Parts Layer */}
      {parts.map((p) => {
        const def = getPartDef(p.type);
        if (!def) return null;
        const Art = def.Art;
        const transform = `translate(${p.x},${p.y}) rotate(${p.rotation ?? 0}) scale(${
          p.mirrored ? -1 : 1
        }, 1)`;
        return (
          <g key={p.id} transform={transform}>
            <Art
              props={p.props as never}
              state={null}
              selected={false}
              simulating={false}
            />
          </g>
        );
      })}

      {/* 2. Wires Layer */}
      {wires.map((w) => {
        const color = wireHex(w.color);
        return (
          <g key={w.id}>
            <path
              d={w.d}
              fill="none"
              stroke={C.wireShadow}
              strokeWidth={WIRE_HALO_W}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
            />
            <path
              d={w.d}
              fill="none"
              stroke={color}
              strokeWidth={WIRE_CORE_W}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
    </svg>
  );
}

export const StarterThumb = memo(StarterThumbInner);
