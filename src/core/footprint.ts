import { CATALOG_BY_ID, resolveDim, type CatalogItem } from '../data/catalog'
import type { PlacedObject } from './project'
import type { Shape } from './geometry2d'
import { polylineLength } from './geometry2d'

export const COOP_SIZES: Record<string, { w: number; d: number; h: number; hens: number }> = {
  small: { w: 1.2, d: 1.0, h: 1.6, hens: 6 },
  medium: { w: 1.8, d: 1.2, h: 1.8, hens: 12 },
  large: { w: 2.6, d: 1.5, h: 2.0, hens: 24 },
}
export const TANK_POLY: Record<string, { dia: number; h: number; stand: number }> = {
  '2000': { dia: 1.4, h: 1.6, stand: 0.9 },
  '3000': { dia: 1.7, h: 1.8, stand: 0.9 },
  '5000': { dia: 2.0, h: 2.1, stand: 0.9 },
}

/** Resolved width (local x) and depth (local z) of an item's base, including derived dimensions. */
export function localDims(item: CatalogItem, params: PlacedObject['params']): { w: number; d: number } {
  const p = { ...params }
  if (item.id === 'chicken-coop') {
    const c = COOP_SIZES[String(p.size ?? 'medium')] ?? COOP_SIZES.medium
    const run = typeof p.runLength === 'number' ? p.runLength : 3
    const rw = typeof p.runWidth === 'number' ? p.runWidth : 2
    return { w: c.w + run, d: Math.max(c.d, rw) }
  }
  if (item.id === 'tank-poly') {
    const t = TANK_POLY[String(p.liters ?? '3000')] ?? TANK_POLY['3000']
    return { w: t.dia, d: t.dia }
  }
  if (item.id === 'herb-spiral') { const d = resolveDim('$diameter', p); return { w: d, d } }
  if (item.id === 'gazebo') { const d = resolveDim('$diameter', p); return { w: d, d } }
  if (item.id === 'hive-langstroth' || item.id === 'hive-topbar') return { w: resolveDim(item.fp.w, p), d: resolveDim(item.fp.d, p) }
  if (item.id === 'rabbit-hutches') return { w: 1.0 * resolveDim('$count', p), d: 0.9 }
  return { w: resolveDim(item.fp.w, p), d: resolveDim(item.fp.d, p) }
}

/** Collision / placement footprint in world coordinates. Trees collide at the trunk, not the canopy (canopy overlap is a rule). */
export function shapeOf(obj: PlacedObject): Shape | null {
  const item = CATALOG_BY_ID[obj.type]
  if (!item) return null
  if (item.kind === 'polyline') return null
  const d = localDims(item, obj.params)
  const s = obj.scale
  if (item.fp.shape === 'circle') return { type: 'circle', x: obj.x, z: obj.z, r: (Math.max(d.w, d.d) / 2) * s }
  return { type: 'rect', x: obj.x, z: obj.z, w: d.w * s, d: d.d * s, rot: obj.rotY }
}

export function polylineLengthOf(obj: PlacedObject): number {
  return obj.points ? polylineLength(obj.points) : 0
}
