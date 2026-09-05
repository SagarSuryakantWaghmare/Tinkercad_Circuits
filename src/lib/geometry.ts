export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const v = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
export const eq = (a: Vec2, b: Vec2, e = 1e-6) =>
  Math.abs(a.x - b.x) < e && Math.abs(a.y - b.y) < e;

export function norm(a: Vec2): Vec2 {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Rotate a point about the origin. `deg` is clockwise in SVG's y-down space. */
export function rotate(p: Vec2, deg: number): Vec2 {
  if (deg === 0) return { x: p.x, y: p.y };
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/**
 * Apply a placed part's transform to a local-space point.
 * Order matches the SVG we emit: translate(x,y) rotate(deg) scale(mirror,1).
 */
export function localToWorld(
  p: Vec2,
  origin: Vec2,
  rotation: number,
  mirrored: boolean,
): Vec2 {
  const m = mirrored ? { x: -p.x, y: p.y } : p;
  const r = rotate(m, rotation);
  return { x: r.x + origin.x, y: r.y + origin.y };
}

export function rectContains(r: Rect, p: Vec2) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function rectsIntersect(a: Rect, b: Rect) {
  return !(
    a.x + a.w < b.x ||
    b.x + b.w < a.x ||
    a.y + a.h < b.y ||
    b.y + b.h < a.y
  );
}

export function rectFromPoints(a: Vec2, b: Vec2): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

export function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

export function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

/**
 * Axis-aligned bounding box of a rect after rotation about its own origin
 * point, expressed in world space.
 */
export function transformedBounds(
  size: { w: number; h: number },
  originLocal: Vec2,
  world: Vec2,
  rotation: number,
  mirrored: boolean,
): Rect {
  const corners: Vec2[] = [
    { x: -originLocal.x, y: -originLocal.y },
    { x: size.w - originLocal.x, y: -originLocal.y },
    { x: size.w - originLocal.x, y: size.h - originLocal.y },
    { x: -originLocal.x, y: size.h - originLocal.y },
  ].map((c) => localToWorld(c, world, rotation, mirrored));

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Shortest distance from point `p` to segment `a`–`b`. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-9) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
