'use client';

import { memo, useMemo } from 'react';
import type { Vec2 } from '@/lib/geometry';
import { C, wireHex } from '@/lib/tokens';
import { WIRE_CORE_W, WIRE_HALO_W } from '@/lib/units';
import { roundedPath, routePolyline, type RouteAnchor } from '../routing/orthoRoute';

export interface ResolvedWire {
  id: string;
  a: RouteAnchor;
  b: RouteAnchor;
  waypoints: Vec2[];
  color: string;
  dangling: boolean;
  /** A jumper is a stiff pre-formed link and runs point to point. */
  kind: 'wire' | 'jumper';
}

/**
 * The path a wire is drawn along. Both layers below share it, so it is built
 * once by whoever owns the wire list rather than twice here.
 */
export function wirePath(wire: ResolvedWire): string {
  if (wire.kind === 'jumper') {
    // A Dupont lead is a straight span between its ends; only the waypoints
    // the user placed bend it.
    const pts = [wire.a.pos, ...wire.waypoints, wire.b.pos];
    return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  }
  return roundedPath(routePolyline(wire.a, wire.b, wire.waypoints));
}

/**
 * The wide backing stroke under a wire, and what turns blue on selection.
 *
 * Every halo is painted in one pass before any core, which is what keeps a
 * crossing readable: drawn per wire, a wire laid down later chopped a
 * five-unit grey notch out of the coloured core of one already there.
 */
export const WireHalo = memo(function WireHalo({
  d,
  selected,
  hovered,
}: {
  d: string;
  selected: boolean;
  hovered: boolean;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={selected ? C.select : hovered ? C.hover : C.wireShadow}
      strokeWidth={WIRE_HALO_W}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={selected || hovered ? 1 : 0.9}
    />
  );
});

/** The coloured core of a wire, plus the fat invisible stroke that grabs it. */
export const WireCore = memo(function WireCore({
  wire,
  d,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  wire: ResolvedWire;
  d: string;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onPointerEnter: (id: string) => void;
  onPointerLeave: () => void;
}) {
  return (
    <g data-wire={wire.id}>
      <path
        d={d}
        fill="none"
        stroke={wireHex(wire.color)}
        strokeWidth={WIRE_CORE_W}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={wire.dangling ? '6 4' : undefined}
      />
      {/* fat invisible stroke so thin wires are still easy to grab */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        strokeLinecap="round"
        style={{ cursor: 'pointer' }}
        onPointerDown={(e) => onPointerDown(e, wire.id)}
        onPointerEnter={() => onPointerEnter(wire.id)}
        onPointerLeave={onPointerLeave}
      />
    </g>
  );
});

/** The in-progress wire drawn while the user is routing. */
export function DraftWire({
  from,
  points,
  cursor,
  color,
  snapped,
}: {
  from: RouteAnchor;
  points: Vec2[];
  cursor: Vec2;
  color: string;
  snapped: RouteAnchor | null;
}) {
  const d = useMemo(
    () =>
      roundedPath(
        routePolyline(from, snapped ?? { pos: cursor, dir: [0, 0] }, points),
      ),
    [from, points, cursor, snapped],
  );
  return (
    <g pointerEvents="none">
      <path
        d={d}
        fill="none"
        stroke={C.wireShadow}
        strokeWidth={WIRE_HALO_W}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
      <path
        d={d}
        fill="none"
        stroke={wireHex(color)}
        strokeWidth={WIRE_CORE_W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {snapped && (
        <g>
          {/* Halo that pulses outward from the landing pad so a compatible
              terminal reads as a green "will connect" affordance the
              instant the pointer approaches it. */}
          <circle
            cx={snapped.pos.x}
            cy={snapped.pos.y}
            r={10}
            fill={C.netHighlight}
            opacity={0.18}
          />
          <circle
            cx={snapped.pos.x}
            cy={snapped.pos.y}
            r={6.5}
            fill="none"
            stroke={C.netHighlight}
            strokeWidth={1.6}
            opacity={0.9}
          />
          <circle
            cx={snapped.pos.x}
            cy={snapped.pos.y}
            r={4}
            fill="#FFFFFF"
            stroke={C.netHighlight}
            strokeWidth={1.6}
          />
        </g>
      )}
    </g>
  );
}
