import type { PlacedObject } from './project'
import type { SiteConfig } from './types'
import { CATALOG_BY_ID } from '../data/catalog'
import { localDims, TANK_POLY } from './footprint'
import { polylineLength } from './geometry2d'
import { fenceLayout } from '../render/siteLayer'

export interface QuantityRow {
  typeId: string
  category: string
  count: number
  /** m² (beds, ponds, parking …) */
  area: number
  /** m (paths, pipes, fences, hedges …) */
  length: number
  /** litres (tanks) */
  capacityL: number
  note?: string
}

export interface Quantities {
  rows: QuantityRow[]
  totals: { beds: number; bedArea: number; pathLength: number; pipeLength: number; fenceLength: number; tankCapacityL: number; trees: number; hives: number; coops: number }
  /** perimeter fence of the site minus gate openings */
  siteFenceLength: number
}

export function siteFenceLength(site: SiteConfig): number {
  let total = 0
  for (const e of ['north', 'east', 'south', 'west'] as const) {
    const { panels } = fenceLayout(site, e)
    for (const [a, b] of panels) total += b - a
  }
  return total
}

export function computeQuantities(objects: PlacedObject[], site: SiteConfig): Quantities {
  const map = new Map<string, QuantityRow>()
  const t = { beds: 0, bedArea: 0, pathLength: 0, pipeLength: 0, fenceLength: 0, tankCapacityL: 0, trees: 0, hives: 0, coops: 0 }
  for (const o of objects) {
    const item = CATALOG_BY_ID[o.type]
    if (!item) continue
    let r = map.get(o.type)
    if (!r) { r = { typeId: o.type, category: item.category, count: 0, area: 0, length: 0, capacityL: 0 }; map.set(o.type, r) }
    r.count++
    if (item.kind === 'polyline' && o.points) {
      const len = polylineLength(o.points)
      r.length += len
      const w = typeof o.params.width === 'number' ? (o.params.width as number) : item.polyline!.width
      if (item.role === 'path') { r.area += len * w; t.pathLength += len }
      if (item.role === 'pipe') t.pipeLength += len
      if (item.model === 'fence-line') t.fenceLength += len
    } else {
      const d = localDims(item, o.params)
      const area = d.w * d.d * o.scale * o.scale
      if (item.role === 'bed' || item.role === 'bed-leafy' || item.role === 'pond' || item.model === 'parking' || item.model === 'greenhouse' || item.model === 'polytunnel') r.area += item.fp.shape === 'circle' ? Math.PI * (d.w / 2) ** 2 * o.scale ** 2 : area
      if (item.role === 'bed' || item.role === 'bed-leafy') { t.beds++; t.bedArea += area }
      if (item.role === 'tank') {
        const cap = item.id === 'tank-poly' ? Number(o.params.liters ?? 3000) : Number(item.meta?.capacityL ?? 0)
        r.capacityL += cap; t.tankCapacityL += cap
        void TANK_POLY
      }
      if (item.role === 'tree') t.trees++
      if (item.role === 'hive') t.hives++
      if (item.role === 'coop') t.coops++
    }
  }
  const sf = siteFenceLength(site)
  t.fenceLength += sf
  const rows = [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.typeId.localeCompare(b.typeId))
  return { rows, totals: t, siteFenceLength: sf }
}

export function quantitiesToCSV(q: Quantities, name: (typeId: string) => string, header: [string, string, string, string, string, string]): string {
  const esc = (s: string | number) => { const x = String(s); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x }
  const lines = [header.map(esc).join(',')]
  for (const r of q.rows) lines.push([name(r.typeId), r.category, r.count, r.area ? r.area.toFixed(2) : '', r.length ? r.length.toFixed(2) : '', r.capacityL || ''].map(esc).join(','))
  lines.push(['Site fence (perimeter minus gates)', 'site', 1, '', q.siteFenceLength.toFixed(2), ''].map(esc).join(','))
  return '﻿' + lines.join('\n')
}
