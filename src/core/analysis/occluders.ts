import type { PlacedObject } from '../project'
import type { SiteConfig } from '../types'
import { CATALOG_BY_ID } from '../../data/catalog'
import { PLANTS } from '../../data/plants'
import { plantSizeAt } from '../growth'
import { localDims, COOP_SIZES, TANK_POLY } from '../footprint'
import type { Terrain } from '../terrain'

/** Light-blocking primitives used by the sun-hours analysis. `sigma` > 0 means a soft (foliage) medium attenuating exp(-sigma * chord). */
export type Occluder =
  | { kind: 'box'; id: string; cx: number; cz: number; w: number; d: number; rot: number; y0: number; y1: number; opacity: number }
  | { kind: 'ellipsoid'; id: string; cx: number; cy: number; cz: number; rx: number; ry: number; rz: number; sigma: number }
  | { kind: 'gable'; id: string; cx: number; cz: number; w: number; d: number; rot: number; y0: number; wallH: number; rise: number; opacity: number }

export interface OccluderContext {
  site: SiteConfig
  terrain: Terrain
  /** years of growth on the timeline */
  ageYears: number
  /** 0 (bare) .. 1 (full leaf) for deciduous canopies */
  leaf: number
  /** transmission of wire mesh fences (0 = fully see-through, 1 = opaque) */
  fenceOpacity?: number
}

/** Foliage extinction coefficient per metre of path through the canopy. */
export const CANOPY_SIGMA = { summer: 1.05, bare: 0.1, evergreen: 1.25 }

function boxFor(o: PlacedObject, id: string, w: number, d: number, y0: number, h: number, opacity = 1): Occluder {
  return { kind: 'box', id, cx: o.x, cz: o.z, w, d, rot: o.rotY, y0, y1: y0 + h, opacity }
}

/** Build occluders from the site (house, fence) and every placed object at its current growth age. */
export function buildOccluders(objects: PlacedObject[], ctx: OccluderContext): Occluder[] {
  const out: Occluder[] = []
  const { site, terrain } = ctx
  const g = (x: number, z: number) => terrain.heightAt(x, z)

  // cabin
  const h = site.house
  const cx = site.width / 2 + h.offsetX, cz = site.depth - h.setbackSouth - h.depth / 2
  const floor = terrain.baseHeightAt(cx, cz) + 0.25
  out.push({ kind: 'gable', id: 'house', cx, cz, w: h.width + 2 * h.overhang, d: h.depth + 2 * h.overhang, rot: 0, y0: floor, wallH: h.wallHeight, rise: (h.depth / 2) * Math.tan((h.roofPitchDeg * Math.PI) / 180), opacity: 1 })

  // perimeter wire fence: thin, mostly see-through
  const fo = ctx.fenceOpacity ?? 0.12
  if (fo > 0) {
    const H = site.fence.height, t = 0.05
    const edges: [number, number, number, number][] = [[site.width / 2, 0, site.width, t], [site.width / 2, site.depth, site.width, t]]
    for (const [x, z, w, d] of edges) out.push({ kind: 'box', id: 'fence', cx: x, cz: z, w, d, rot: 0, y0: g(x, z), y1: g(x, z) + H, opacity: fo })
    for (const x of [0, site.width]) out.push({ kind: 'box', id: 'fence', cx: x, cz: site.depth / 2, w: t, d: site.depth, rot: 0, y0: Math.min(g(x, 0), g(x, site.depth)), y1: Math.max(g(x, 0), g(x, site.depth)) + H, opacity: fo })
  }

  for (const o of objects) {
    if (o.hidden) continue
    const item = CATALOG_BY_ID[o.type]
    if (!item) continue
    const id = o.id
    const d = localDims(item, o.params)
    const w = d.w * o.scale, dd = d.d * o.scale
    const y0 = g(o.x, o.z)

    if (item.kind === 'polyline' && o.points) {
      const H = typeof o.params.height === 'number' ? (o.params.height as number) : item.height
      const op = item.model === 'hedgerow' ? 0.8 : item.model === 'flight-barrier' ? 0.85 : item.model === 'fence-line' ? 0.12 : item.model === 'retaining-wall' ? 1 : 0
      if (op <= 0) continue
      const width = typeof o.params.width === 'number' ? (o.params.width as number) : item.polyline!.width
      for (let i = 1; i < o.points.length; i++) {
        const a = o.points[i - 1], b = o.points[i]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        if (len < 1e-3) continue
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2
        const base = Math.min(g(a.x, a.z), g(b.x, b.z)) - 0.05
        out.push({ kind: 'box', id, cx: mx, cz: mz, w: len, d: Math.max(width, 0.05), rot: -Math.atan2(b.z - a.z, b.x - a.x), y0: base, y1: base + H, opacity: op })
      }
      continue
    }

    if (item.plant && (item.model === 'plant-tree')) {
      const sp = PLANTS[item.plant]
      const sz = plantSizeAt(sp, Math.max(0, ctx.ageYears + o.ageOffset))
      const trunkH = Math.min(sz.trunkHeight, sz.height * 0.8)
      out.push({ kind: 'box', id, cx: o.x, cz: o.z, w: sz.trunkRadius * 2, d: sz.trunkRadius * 2, rot: 0, y0, y1: y0 + trunkH, opacity: 1 })
      const crownH = Math.max(0.2, sz.height - trunkH)
      const sigma = sp.deciduous ? CANOPY_SIGMA.bare + (CANOPY_SIGMA.summer - CANOPY_SIGMA.bare) * ctx.leaf * Math.min(1.2, sp.leaf.density) : CANOPY_SIGMA.evergreen
      out.push({ kind: 'ellipsoid', id, cx: o.x, cy: y0 + trunkH + crownH / 2, cz: o.z, rx: sz.canopy / 2, ry: crownH / 2, rz: sz.canopy / 2, sigma })
      continue
    }

    switch (item.model) {
      case 'plant-row': case 'plant-bed': case 'trellis-vine': {
        const sp = item.plant ? PLANTS[item.plant] : undefined
        const sz = sp ? plantSizeAt(sp, Math.max(0, ctx.ageYears + 1)) : { height: 1 }
        const hgt = item.model === 'plant-bed' ? Math.min(0.5, sz.height) : item.model === 'trellis-vine' ? 2 : sz.height
        const leaf = sp?.deciduous ? 0.15 + 0.7 * ctx.leaf : 0.85
        out.push(boxFor(o, id, w, dd, y0, hgt, leaf))
        break
      }
      case 'pergola-vine': {
        const sp = PLANTS[item.plant!]
        const sz = plantSizeAt(sp, Math.max(0, ctx.ageYears + o.ageOffset))
        out.push(boxFor(o, id, w, dd, y0 + 2.4, 0.45, Math.min(0.9, (0.15 + 0.75 * ctx.leaf) * Math.min(1, sz.fraction * 1.2 + 0.1))))
        for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) out.push({ kind: 'box', id, cx: o.x + sx * w / 2, cz: o.z + sz2 * dd / 2, w: 0.12, d: 0.12, rot: 0, y0, y1: y0 + 2.4, opacity: 1 })
        break
      }
      case 'pergola': out.push(boxFor(o, id, w, dd, y0 + 2.45, 0.2, 0.4)); break
      case 'gazebo': out.push(boxFor(o, id, w, dd, y0, 3.2, 1)); break
      case 'greenhouse': out.push(boxFor(o, id, w, dd, y0, 2.8, 0.3)); break
      case 'polytunnel': out.push(boxFor(o, id, w, dd, y0, 2.2, 0.28)); break
      case 'cold-frame': out.push(boxFor(o, id, w, dd, y0, 0.45, 0.3)); break
      case 'ginseng-bed': out.push(boxFor(o, id, w, dd, y0 + 1.7, 0.1, 0.72)); break
      case 'mushroom-house': out.push(boxFor(o, id, w, dd, y0, 2.2, 0.7)); break
      case 'coop': {
        const c = COOP_SIZES[String(o.params.size ?? 'medium')] ?? COOP_SIZES.medium
        const run = typeof o.params.runLength === 'number' ? (o.params.runLength as number) : 3
        const rotCos = Math.cos(o.rotY), rotSin = Math.sin(o.rotY)
        const off = -(c.w + run) / 2 + c.w / 2
        const hx = o.x + off * rotCos * o.scale, hz = o.z - off * rotSin * o.scale
        out.push({ kind: 'box', id, cx: hx, cz: hz, w: c.w * o.scale, d: c.d * o.scale, rot: o.rotY, y0, y1: y0 + 0.55 + c.h, opacity: 1 })
        const roff = -(c.w + run) / 2 + c.w + run / 2
        out.push({ kind: 'box', id, cx: o.x + roff * rotCos * o.scale, cz: o.z - roff * rotSin * o.scale, w: run * o.scale, d: (typeof o.params.runWidth === 'number' ? (o.params.runWidth as number) : 2) * o.scale, rot: o.rotY, y0, y1: y0 + 1.5, opacity: 0.12 })
        break
      }
      case 'tank-poly': { const t = TANK_POLY[String(o.params.liters ?? '3000')] ?? TANK_POLY['3000']; out.push(boxFor(o, id, t.dia, t.dia, y0, t.stand + t.h, 1)); break }
      case 'tank-ibc': out.push(boxFor(o, id, w, dd, y0, 1.2, 0.85)); break
      case 'solar': out.push(boxFor(o, id, w, 2.2 * 0.85, y0 + 0.5, 1.1, 1)); break
      case 'light-post': out.push(boxFor(o, id, 0.12, 0.12, y0, 3, 1)); break
      case 'human': out.push(boxFor(o, id, 0.4, 0.25, y0, 1.75, 1)); break
      case 'path': case 'parking': case 'pond': case 'inground-bed': case 'potato-rows': case 'squash-patch': case 'steps': case 'gate': case 'bee-water': case 'tap': break
      case 'house-gable': {
        const wh = typeof o.params.wallHeight === 'number' ? (o.params.wallHeight as number) : 2.8
        const pitch = typeof o.params.pitch === 'number' ? (o.params.pitch as number) : 30
        out.push({ kind: 'gable', id, cx: o.x, cz: o.z, w: w + 1, d: dd + 1, rot: o.rotY, y0: y0 + 0.25, wallH: wh, rise: (dd / 2) * Math.tan((pitch * Math.PI) / 180), opacity: 1 })
        break
      }
      default: {
        // low ground-level things (beds, hives) are measured, not obstacles: skipping them keeps their own cells sunlit
        const role: string = item.role
        if (role === 'bed' || role === 'bed-leafy' || role === 'hive' || role === 'bee-water') break
        const hgt = Math.max(0.1, item.height * o.scale)
        const op = 1
        if (hgt > 0.15) out.push(boxFor(o, id, w, dd, y0, typeof o.params.height === 'number' && item.model === 'raised-bed' ? (o.params.height as number) + 0.25 : hgt, op))
      }
    }
  }
  return out
}
