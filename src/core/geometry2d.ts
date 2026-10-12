import type { Vec2 } from './types'

/** Footprint shapes on the ground plane (x east, z south). Rotation is about the vertical axis (radians). */
export type Shape =
  | { type: 'circle'; x: number; z: number; r: number }
  | { type: 'rect'; x: number; z: number; w: number; d: number; rot: number }

export function rectCorners(s: Extract<Shape, { type: 'rect' }>): Vec2[] {
  const c = Math.cos(s.rot), n = Math.sin(s.rot)
  const hw = s.w / 2, hd = s.d / 2
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => ({ x: s.x + lx * c + lz * n, z: s.z - lx * n + lz * c }))
}

/** local -> world uses x' = x + lx*cos + lz*sin ; z' = z - lx*sin + lz*cos (consistent with three's rotation.y) */
function toLocal(s: Extract<Shape, { type: 'rect' }>, px: number, pz: number) {
  const dx = px - s.x, dz = pz - s.z
  const c = Math.cos(s.rot), n = Math.sin(s.rot)
  return { lx: dx * c - dz * n, lz: dx * n + dz * c }
}

export function pointInShape(s: Shape, px: number, pz: number): boolean {
  if (s.type === 'circle') return Math.hypot(px - s.x, pz - s.z) <= s.r
  const { lx, lz } = toLocal(s, px, pz)
  return Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.d / 2
}

function project(pts: Vec2[], ax: number, az: number): [number, number] {
  let lo = Infinity, hi = -Infinity
  for (const p of pts) { const v = p.x * ax + p.z * az; if (v < lo) lo = v; if (v > hi) hi = v }
  return [lo, hi]
}

/** Separating-axis overlap test between any two shapes. `margin` expands the first-vs-second test (positive = require clearance). */
export function shapesOverlap(a: Shape, b: Shape, margin = 0): boolean {
  if (a.type === 'circle' && b.type === 'circle') return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + margin
  if (a.type === 'rect' && b.type === 'rect') {
    const ca = rectCorners(inflate(a, margin / 2)), cb = rectCorners(inflate(b, margin / 2))
    for (const s of [a, b]) {
      const c = Math.cos(s.rot), n = Math.sin(s.rot)
      for (const [ax, az] of [[c, -n], [n, c]]) {
        const [a0, a1] = project(ca, ax, az), [b0, b1] = project(cb, ax, az)
        if (a1 < b0 || b1 < a0) return false
      }
    }
    return true
  }
  const circle = (a.type === 'circle' ? a : b) as Extract<Shape, { type: 'circle' }>
  const rect = (a.type === 'rect' ? a : b) as Extract<Shape, { type: 'rect' }>
  const { lx, lz } = toLocal(rect, circle.x, circle.z)
  const qx = Math.max(Math.abs(lx) - rect.w / 2, 0), qz = Math.max(Math.abs(lz) - rect.d / 2, 0)
  return Math.hypot(qx, qz) < circle.r + margin
}

function inflate(s: Extract<Shape, { type: 'rect' }>, m: number) {
  return { ...s, w: s.w + 2 * m, d: s.d + 2 * m }
}

/** Distance between the edges of two shapes (0 when overlapping). Approximate for rect-rect (uses corner/edge sampling). */
export function shapeDistance(a: Shape, b: Shape): number {
  if (shapesOverlap(a, b)) return 0
  if (a.type === 'circle' && b.type === 'circle') return Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r
  const polyA = outline(a), polyB = outline(b)
  let best = Infinity
  for (const p of polyA) best = Math.min(best, distPointPoly(p, polyB))
  for (const p of polyB) best = Math.min(best, distPointPoly(p, polyA))
  return best
}

export function outline(s: Shape, seg = 24): Vec2[] {
  if (s.type === 'rect') return rectCorners(s)
  return Array.from({ length: seg }, (_, i) => ({ x: s.x + Math.cos((i / seg) * 2 * Math.PI) * s.r, z: s.z + Math.sin((i / seg) * 2 * Math.PI) * s.r }))
}

export function distPointSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dz = b.z - a.z
  const l2 = dx * dx + dz * dz
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.z - (a.z + t * dz))
}

export function distPointPoly(p: Vec2, poly: Vec2[], closed = true): number {
  let best = Infinity
  const n = closed ? poly.length : poly.length - 1
  for (let i = 0; i < n; i++) best = Math.min(best, distPointSeg(p, poly[i], poly[(i + 1) % poly.length]))
  return best
}

export function polylineLength(pts: Vec2[]): number {
  let l = 0
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
  return l
}

export function polygonArea(pts: Vec2[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.z - q.x * p.z }
  return Math.abs(a) / 2
}

/** Points sampled every `step` metres along a polyline (always includes the first and last point). */
export function samplePolyline(pts: Vec2[], step: number): { x: number; z: number; t: number; dx: number; dz: number }[] {
  const out: { x: number; z: number; t: number; dx: number; dz: number }[] = []
  if (pts.length < 2) return out
  const total = polylineLength(pts)
  const n = Math.max(1, Math.round(total / step))
  for (let k = 0; k <= n; k++) {
    let d = (total * k) / n
    for (let i = 1; i < pts.length; i++) {
      const sl = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
      if (d <= sl || i === pts.length - 1) {
        const t = sl === 0 ? 0 : Math.min(1, d / sl)
        const dx = (pts[i].x - pts[i - 1].x) / (sl || 1), dz = (pts[i].z - pts[i - 1].z) / (sl || 1)
        out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * t, t: total ? (total * k) / n / total : 0, dx, dz })
        break
      }
      d -= sl
    }
  }
  return out
}

/** Snap a value to a grid (0 = off). */
export const snap = (v: number, g: number) => (g > 0 ? Math.round(v / g) * g : v)

/** Rotate point (x,z) around the vertical axis by rot — matches three.js rotation.y. */
export function rotate(x: number, z: number, rot: number): Vec2 {
  const c = Math.cos(rot), s = Math.sin(rot)
  return { x: x * c + z * s, z: -x * s + z * c }
}
