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
 * A wire is painted twice with the identical path — a wide halo underneath and
 * the coloured core on top — which is exactly how the live product draws them.
 * The halo is what turns blue on selection.
 */
function WireItemInner({
  wire,
  selected,
  hovered,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onWaypointDown,
  onAddWaypoint,
}: {
  wire: ResolvedWire;
  selected: boolean;
  hovered: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onPointerEnter: (id: string) => void;
  onPointerLeave: () => void;
  /** Grab an existing bend point. */
  onWaypointDown?: (e: React.PointerEvent, id: string, index: number) => void;
  /** Double-click on the wire itself to put a new bend point there. */
  onAddWaypoint?: (e: React.MouseEvent, id: string) => void;
}) {
  const d = useMemo(() => {
    if (wire.kind === 'jumper') {
      // A Dupont lead is a straight span between its ends; only the waypoints
      // the user placed bend it.
      const pts = [wire.a.pos, ...wire.waypoints, wire.b.pos];
      return pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    }
    return roundedPath(routePolyline(wire.a, wire.b, wire.waypoints));
  }, [wire.a, wire.b, wire.waypoints, wire.kind]);

  const halo = selected ? C.select : hovered ? C.hover : C.wireShadow;

  return (
    <g data-wire={wire.id}>
      <path
        d={d}
        fill="none"
        stroke={halo}
        strokeWidth={WIRE_HALO_W}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={selected || hovered ? 1 : 0.9}
      />
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
        onDoubleClick={(e) => onAddWaypoint?.(e, wire.id)}
        onPointerEnter={() => onPointerEnter(wire.id)}
        onPointerLeave={onPointerLeave}
      />

      {/*
        Bend points, shown only on the selected wire so the canvas is not
        peppered with handles. Dragging one reshapes the route; double-clicking
        the wire adds another.
      */}
      {selected &&
        wire.waypoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4.5}
            fill="#FFFFFF"
            stroke={C.select}
            strokeWidth={2}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => onWaypointDown?.(e, wire.id, i)}
          />
        ))}
    </g>
  );
}

export const WireItem = memo(WireItemInner);

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
        <circle cx={snapped.pos.x} cy={snapped.pos.y} r={5} fill={C.netHighlight} opacity={0.9} />
      )}
    </g>
  );
}
