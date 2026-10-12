import type { PlacedObject } from './project'
import type { SiteConfig } from './types'
import { shapeOf } from './footprint'
import { snap as snapGrid, rectCorners, type Shape } from './geometry2d'

export interface SnapOptions { grid: number; edges: boolean; threshold?: number }

function aabb(s: Shape) {
  if (s.type === 'circle') return { x0: s.x - s.r, x1: s.x + s.r, z0: s.z - s.r, z1: s.z + s.r }
  const c = rectCorners(s)
  return { x0: Math.min(...c.map((p) => p.x)), x1: Math.max(...c.map((p) => p.x)), z0: Math.min(...c.map((p) => p.z)), z1: Math.max(...c.map((p) => p.z)) }
}

/**
 * Snap a desired centre (x,z) for `obj`: grid first, then edge snapping to the fence line (flush, 0.2 m inside) and to
 * neighbouring footprints (edge-aligned or abutting). Returns the adjusted centre.
 */
export function snapPosition(obj: PlacedObject, x: number, z: number, others: PlacedObject[], site: SiteConfig, opt: SnapOptions): { x: number; z: number } {
  let sx = snapGrid(x, opt.grid), sz = snapGrid(z, opt.grid)
  if (!opt.edges) return { x: sx, z: sz }
  const th = opt.threshold ?? 0.35
  const me = shapeOf({ ...obj, x: sx, z: sz })
  if (!me) return { x: sx, z: sz }
  const b = aabb(me)
  const halfW = (b.x1 - b.x0) / 2, halfD = (b.z1 - b.z0) / 2
  let bestX: { d: number; v: number } | null = null, bestZ: { d: number; v: number } | null = null
  const tryX = (target: number, edge: 'min' | 'max') => {
    const cx = edge === 'min' ? target + halfW : target - halfW
    const d = Math.abs(cx - sx)
    if (d <= th && (!bestX || d < bestX.d)) bestX = { d, v: cx }
  }
  const tryZ = (target: number, edge: 'min' | 'max') => {
    const cz = edge === 'min' ? target + halfD : target - halfD
    const d = Math.abs(cz - sz)
    if (d <= th && (!bestZ || d < bestZ.d)) bestZ = { d, v: cz }
  }
  const inset = 0.2
  tryX(inset, 'min'); tryX(site.width - inset, 'max'); tryZ(inset, 'min'); tryZ(site.depth - inset, 'max')
  for (const o of others) {
    if (o.id === obj.id) continue
    const s = shapeOf(o)
    if (!s) continue
    const a = aabb(s)
    tryX(a.x0, 'min'); tryX(a.x1, 'min'); tryX(a.x0, 'max'); tryX(a.x1, 'max')
    tryZ(a.z0, 'min'); tryZ(a.z1, 'min'); tryZ(a.z0, 'max'); tryZ(a.z1, 'max')
  }
  if (bestX) sx = (bestX as { v: number }).v
  if (bestZ) sz = (bestZ as { v: number }).v
  return { x: sx, z: sz }
}
