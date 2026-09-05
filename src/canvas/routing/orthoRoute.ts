import { add, dist, eq, mul, type Vec2 } from '@/lib/geometry';
import { TERMINAL_STUB, WIRE_CORNER_R } from '@/lib/units';

export interface RouteAnchor {
  pos: Vec2;
  /** Unit vector the wire must leave along. [0,0] for a free end. */
  dir: [number, number];
}

/**
 * Build the polyline for a wire.
 *
 * Each end leaves its terminal along the terminal's own direction vector for a
 * short stub, then the path is completed with axis-aligned segments through any
 * user waypoints. This reproduces the product's routing: wires always emerge
 * perpendicular to the pin they're attached to.
 */
export function routePolyline(
  a: RouteAnchor,
  b: RouteAnchor,
  waypoints: Vec2[] = [],
): Vec2[] {
  const pts: Vec2[] = [a.pos];

  // Anchor stubs. A stub is dropped when it would point away from the target
  // and no waypoint justifies the detour — otherwise two facing terminals
  // produce a loop that runs out past both of them and doubles back.
  const target = waypoints[0] ?? b.pos;
  const aStub = stubOf(a, target);
  if (aStub) pts.push(aStub);

  const prevOfB = waypoints[waypoints.length - 1] ?? pts[pts.length - 1];
  const bStub = stubOf(b, prevOfB);

  const via = [...waypoints, ...(bStub ? [bStub] : []), b.pos];

  let cursor = pts[pts.length - 1];
  let incoming = dirBetween(pts.length > 1 ? pts[pts.length - 2] : a.pos, cursor);

  for (const t of via) {
    // Continue by turning: if we arrived moving vertically, go across first.
    const horizontalFirst =
      incoming === 'v' ? true : incoming === 'h' ? false : Math.abs(t.x - cursor.x) >= Math.abs(t.y - cursor.y);
    const leg = manhattan(cursor, t, horizontalFirst);
    for (const p of leg) {
      if (!eq(p, pts[pts.length - 1])) pts.push(p);
    }
    if (pts.length > 1) incoming = dirBetween(pts[pts.length - 2], pts[pts.length - 1]);
    cursor = t;
  }

  return dedupeCollinear(pts);
}

/**
 * The straight run out of a terminal, or null when the terminal is
 * direction-free (a breadboard hole) or when honouring the direction would
 * send the wire the long way round.
 */
function stubOf(a: RouteAnchor, toward: Vec2): Vec2 | null {
  if (a.dir[0] === 0 && a.dir[1] === 0) return null;
  const d = { x: a.dir[0], y: a.dir[1] };
  const away = { x: toward.x - a.pos.x, y: toward.y - a.pos.y };
  // Pointing more than ~90° away from the target: skip the stub.
  if (d.x * away.x + d.y * away.y < -TERMINAL_STUB * 0.5) return null;
  return add(a.pos, mul(d, TERMINAL_STUB));
}

function dirBetween(from: Vec2, to: Vec2): 'h' | 'v' | null {
  if (Math.abs(to.x - from.x) > 1e-6) return 'h';
  if (Math.abs(to.y - from.y) > 1e-6) return 'v';
  return null;
}

/** Two-segment axis-aligned connection between two points. */
function manhattan(from: Vec2, to: Vec2, horizontalFirst: boolean): Vec2[] {
  if (Math.abs(from.x - to.x) < 1e-6 || Math.abs(from.y - to.y) < 1e-6) {
    return [to];
  }
  return horizontalFirst
    ? [{ x: to.x, y: from.y }, to]
    : [{ x: from.x, y: to.y }, to];
}

/** Drop duplicate and collinear intermediate points. */
function dedupeCollinear(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    if (out.length && eq(out[out.length - 1], p)) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i > 0; i--) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(cross) < 1e-6) out.splice(i, 1);
  }
  return out;
}

/**
 * Convert a polyline into an SVG path where every corner is replaced by a
 * quarter-circle of radius `r` — the rounded elbow the product draws.
 *
 * Emits the same command shape observed in the live DOM:
 *   M x,y L x,y A10,10 <rot> 0,<sweep> x,y L …
 */
export function roundedPath(points: Vec2[], r: number = WIRE_CORNER_R): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${f(points[0].x)},${f(points[0].y)}`;

  let d = `M${f(points[0].x)},${f(points[0].y)}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];

    const inLen = dist(prev, cur);
    const outLen = dist(cur, next);
    // Never cut back more than half of either incident segment.
    const rr = Math.max(0, Math.min(r, inLen / 2, outLen / 2));

    if (rr < 0.5) {
      d += `L${f(cur.x)},${f(cur.y)}`;
      continue;
    }

    const din = unit(prev, cur);
    const dout = unit(cur, next);

    const start = { x: cur.x - din.x * rr, y: cur.y - din.y * rr };
    const end = { x: cur.x + dout.x * rr, y: cur.y + dout.y * rr };

    // Cross product sign gives the turn direction; in SVG's y-down space a
    // positive cross is a clockwise turn → sweep flag 1.
    const cross = din.x * dout.y - din.y * dout.x;
    if (Math.abs(cross) < 1e-6) {
      d += `L${f(cur.x)},${f(cur.y)}`;
      continue;
    }
    const sweep = cross > 0 ? 1 : 0;

    d += `L${f(start.x)},${f(start.y)}`;
    d += `A${r},${r} 0 0,${sweep} ${f(end.x)},${f(end.y)}`;
  }

  const last = points[points.length - 1];
  d += `L${f(last.x)},${f(last.y)}`;
  return d;
}

function unit(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/** Total length of a polyline — used for hit tolerance and length readouts. */
export function polylineLength(points: Vec2[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += dist(points[i - 1], points[i]);
  return sum;
}
