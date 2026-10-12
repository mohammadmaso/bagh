import type { PlacedObject } from './project'
import type { SiteConfig } from './types'
import { CATALOG_BY_ID } from '../data/catalog'
import { shapeOf } from './footprint'
import { shapesOverlap, rectCorners, type Shape } from './geometry2d'

export type CollisionKind = 'object' | 'house' | 'fence' | 'outside'
export interface Collision { id: string; with: string | null; kind: CollisionKind }

export function houseShape(site: SiteConfig): Shape {
  const h = site.house
  return { type: 'rect', x: site.width / 2 + h.offsetX, z: site.depth - h.setbackSouth - h.depth / 2, w: h.width + 0.6, d: h.depth + 0.6, rot: 0 }
}

/** Is the footprint fully inside the fenced plot (with a small clearance from the fence)? */
export function insidePlot(s: Shape, site: SiteConfig, margin = 0.1): boolean {
  const pts = s.type === 'circle'
    ? [[s.x - s.r, s.z - s.r], [s.x + s.r, s.z + s.r]]
    : rectCorners(s).map((p) => [p.x, p.z])
  return pts.every(([x, z]) => x >= margin && x <= site.width - margin && z >= margin && z <= site.depth - margin)
}

/** Roles that may overlap with others by design (ground-level, soft items). */
const SOFT = new Set(['path', 'none'])

export function shapeWithClearance(o: PlacedObject): { shape: Shape; clearance: number } | null {
  const s = shapeOf(o)
  if (!s) return null
  const item = CATALOG_BY_ID[o.type]
  return { shape: s, clearance: item?.clearance ?? 0 }
}

/** Pairwise collisions among point objects, plus house/fence containment. Ground-level paths/scale references are ignored. */
export function computeCollisions(objects: PlacedObject[], site: SiteConfig, only?: Set<string>): Collision[] {
  const list: { o: PlacedObject; s: Shape; c: number; soft: boolean }[] = []
  for (const o of objects) {
    if (o.hidden) continue
    const x = shapeWithClearance(o)
    if (!x) continue
    const item = CATALOG_BY_ID[o.type]
    list.push({ o, s: x.shape, c: x.clearance, soft: SOFT.has(item?.role ?? 'none') && o.type !== 'car' })
  }
  const out: Collision[] = []
  const house = houseShape(site)
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (only && !only.has(a.o.id)) {
      // still need pair checks against `only` members; handled below
    }
    if (!a.soft) {
      if (!insidePlot(a.s, site)) out.push({ id: a.o.id, with: null, kind: 'outside' })
      if (shapesOverlap(a.s, house, a.c)) out.push({ id: a.o.id, with: 'house', kind: 'house' })
    }
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      if (a.soft || b.soft) continue
      if (only && !only.has(a.o.id) && !only.has(b.o.id)) continue
      if (Math.abs(a.s.x - b.s.x) > 40 || Math.abs(a.s.z - b.s.z) > 40) continue
      if (shapesOverlap(a.s, b.s, Math.max(a.c, b.c))) {
        out.push({ id: a.o.id, with: b.o.id, kind: 'object' })
        out.push({ id: b.o.id, with: a.o.id, kind: 'object' })
      }
    }
  }
  return out
}

/** Would `candidate` collide with anything in `others` / the house / outside the plot? */
export function collidesWithAny(candidate: PlacedObject, others: PlacedObject[], site: SiteConfig): boolean {
  const x = shapeWithClearance(candidate)
  if (!x) return false
  const item = CATALOG_BY_ID[candidate.type]
  if (SOFT.has(item?.role ?? 'none') && candidate.type !== 'car') return false
  if (!insidePlot(x.shape, site)) return true
  if (shapesOverlap(x.shape, houseShape(site), x.clearance)) return true
  for (const o of others) {
    if (o.id === candidate.id || o.hidden) continue
    const y = shapeWithClearance(o)
    if (!y) continue
    const it2 = CATALOG_BY_ID[o.type]
    if (SOFT.has(it2?.role ?? 'none') && o.type !== 'car') continue
    if (shapesOverlap(x.shape, y.shape, Math.max(x.clearance, y.clearance))) return true
  }
  return false
}
