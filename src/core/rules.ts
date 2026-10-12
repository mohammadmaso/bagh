import type { PlacedObject } from './project'
import type { SiteConfig } from './types'
import type { Terrain } from './terrain'
import { CATALOG_BY_ID, type CatalogItem } from '../data/catalog'
import { PLANTS } from '../data/plants'
import { RULES, type RuleConfig, type Severity, type RuleDef } from '../data/rules'
import { shapeOf } from './footprint'
import { distPointPoly, shapeDistance, polylineLength, samplePolyline, type Shape } from './geometry2d'
import { houseShape } from './collision'
import { meanOverShape } from './analysis/sunHours'

export interface Violation {
  id: string
  ruleId: string
  severity: Severity
  /** objects involved (first is the "subject" – focus target) */
  objectIds: string[]
  at: { x: number; z: number }
  /** message variables; `refs` map {a},{b} placeholders to object ids resolved to localized names by the UI */
  vars: Record<string, string | number>
  refs: Record<string, string>
}

export interface SunGrid { nx: number; nz: number; res: number; hours: Float32Array }

export interface RuleContext {
  site: SiteConfig
  terrain: Terrain
  objects: PlacedObject[]
  /** growing-season mean direct sun hours (Apr–Sep), if the analysis has run */
  growingSun?: SunGrid | null
  /** cells of ponding (m) from the flow analysis, optional */
  pits?: { nx: number; nz: number; res: number; x0: number; z0: number; data: Float32Array } | null
}

type Evaluator = (ctx: RuleContext, def: RuleDef & { params: Record<string, number> }) => Omit<Violation, 'severity' | 'ruleId' | 'id'>[]

const D2R = Math.PI / 180
const item = (o: PlacedObject): CatalogItem | undefined => CATALOG_BY_ID[o.type]
const isTree = (o: PlacedObject) => item(o)?.model === 'plant-tree'
const species = (o: PlacedObject) => { const it = item(o); return it?.plant ? PLANTS[it.plant] : undefined }
const isBed = (o: PlacedObject) => { const r = item(o)?.role; return r === 'bed' || r === 'bed-leafy' }
const isLeafyBed = (o: PlacedObject) => item(o)?.role === 'bed-leafy'
const fmt = (n: number) => Math.round(n * 10) / 10

/** compass bearing (deg, 0 = N, clockwise) of an object's local +z "front" after rotation */
export function frontBearing(rotY: number): number {
  const x = Math.sin(rotY), z = Math.cos(rotY) // local +z rotated by rotY (three.js convention): (sin, cos)
  return (((Math.atan2(x, -z) / D2R) % 360) + 360) % 360
}
const angDiff = (a: number, b: number) => { const d = Math.abs((((a - b) % 360) + 540) % 360 - 180); return d }

/** slope/aspect of the natural ground (pads ignored) using a 4 m stencil */
function groundSlope(t: Terrain, x: number, z: number) {
  const e = 4
  const gx = (t.groundAt(x + e, z) - t.groundAt(x - e, z)) / (2 * e), gz = (t.groundAt(x, z + e) - t.groundAt(x, z - e)) / (2 * e)
  const mag = Math.hypot(gx, gz)
  const az = (((Math.atan2(-gx, gz) / D2R) % 360) + 360) % 360
  return { slopeDeg: (Math.atan(mag) / D2R), aspectDeg: mag < 1e-9 ? 0 : az }
}

function distToBoundary(site: SiteConfig, x: number, z: number) {
  return Math.min(x, site.width - x, z, site.depth - z)
}
function distToShape(x: number, z: number, s: Shape): number {
  return shapeDistance({ type: 'circle', x, z, r: 0.001 }, s)
}

const E: Record<string, Evaluator> = {
  canopyOverlap: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    const trees = ctx.objects.filter(isTree).filter((o) => !o.hidden)
    for (let i = 0; i < trees.length; i++) for (let j = i + 1; j < trees.length; j++) {
      const a = trees[i], b = trees[j]
      const ra = species(a)!.matureCanopy / 2, rb = species(b)!.matureCanopy / 2
      const d = Math.hypot(a.x - b.x, a.z - b.z)
      const overlap = ra + rb - d
      if (overlap > def.params.tolerance) out.push({ objectIds: [a.id, b.id], at: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, vars: { overlap: fmt(overlap), dist: fmt(d), need: fmt(ra + rb) }, refs: { a: a.id, b: b.id } })
    }
    return out
  },
  treeFence: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    for (const o of ctx.objects) {
      if (!isTree(o) || o.hidden) continue
      const sp = species(o)!
      const need = Math.max(def.params.minFence, def.params.fenceFactor * (sp.matureCanopy / 2))
      const d = distToBoundary(ctx.site, o.x, o.z)
      if (d < need) out.push({ objectIds: [o.id], at: { x: o.x, z: o.z }, vars: { dist: fmt(d), need: fmt(need) }, refs: { a: o.id } })
    }
    return out
  },
  treeHouse: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    const houses: { id: string; s: Shape }[] = [{ id: 'house', s: houseShape(ctx.site) }]
    for (const o of ctx.objects) if (item(o)?.role === 'house' && !o.hidden) { const s = shapeOf(o); if (s) houses.push({ id: o.id, s }) }
    for (const o of ctx.objects) {
      if (!isTree(o) || o.hidden) continue
      const sp = species(o)!
      const need = Math.max(def.params.minHouse, def.params.houseFactor * (sp.matureCanopy / 2) + 1)
      for (const h of houses) {
        // houseShape includes a clearance margin; measure to the real wall (approx. 0.3 m smaller)
        const d = distToShape(o.x, o.z, h.s) + (h.id === 'house' ? 0.3 : 0)
        if (d < need) out.push({ objectIds: [o.id], at: { x: o.x, z: o.z }, vars: { dist: fmt(d), need: fmt(need) }, refs: { a: o.id } })
      }
    }
    return out
  },
  bedSun: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    const g = ctx.growingSun
    if (!g) return out
    for (const o of ctx.objects) {
      if (!isBed(o) || o.hidden) continue
      const s = shapeOf(o)
      if (!s) continue
      const hrs = meanOverShape(g.hours, g.nx, g.nz, g.res, s as any)
      if (hrs < def.params.minHours) out.push({ objectIds: [o.id], at: { x: o.x, z: o.z }, vars: { hours: fmt(hrs), need: def.params.minHours }, refs: { a: o.id } })
    }
    return out
  },
  juglone: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    for (const t of ctx.objects) {
      if (!isTree(t) || t.hidden || !species(t)?.juglone) continue
      for (const b of ctx.objects) {
        if (!isBed(b) || b.hidden) continue
        const s = shapeOf(b)
        if (!s) continue
        const d = distToShape(t.x, t.z, s)
        if (d < def.params.distance) out.push({ objectIds: [t.id, b.id], at: { x: (t.x + b.x) / 2, z: (t.z + b.z) / 2 }, vars: { dist: fmt(d), need: def.params.distance }, refs: { a: t.id, b: b.id } })
      }
    }
    return out
  },
  hiveFacing: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    for (const o of ctx.objects) {
      if (item(o)?.role !== 'hive' || o.hidden) continue
      const az = frontBearing(o.rotY)
      const diff = angDiff(az, def.params.idealAz)
      if (diff > def.params.okTol) out.push({ objectIds: [o.id], at: { x: o.x, z: o.z }, vars: { az: Math.round(az), ideal: def.params.idealAz, diff: Math.round(diff) }, refs: { a: o.id } })
    }
    return out
  },
  hiveClearance: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    const barriers = ctx.objects.filter((o) => o.type === 'flight-barrier' && o.points && !o.hidden)
    const paths = ctx.objects.filter((o) => item(o)?.role === 'path' && o.points && !o.hidden)
    for (const h of ctx.objects) {
      if (item(h)?.role !== 'hive' || h.hidden) continue
      const front = { x: Math.sin(h.rotY), z: Math.cos(h.rotY) }
      const hasBarrier = barriers.some((b) => {
        const bh = typeof b.params.height === 'number' ? (b.params.height as number) : CATALOG_BY_ID['flight-barrier'].height
        if (bh < def.params.barrierHeight - 1e-6) return false
        const pts = samplePolyline(b.points!, 0.5)
        return pts.some((p) => {
          const dx = p.x - h.x, dz = p.z - h.z
          return dx * front.x + dz * front.z > 0.2 && Math.hypot(dx, dz) <= def.params.barrierReach
        })
      })
      if (hasBarrier) continue
      const checks: { what: string; d: number; id?: string }[] = []
      checks.push({ what: 'boundary', d: distToBoundary(ctx.site, h.x, h.z) })
      for (const p of paths) checks.push({ what: 'path', d: distPointPoly({ x: h.x, z: h.z }, p.points!, false), id: p.id })
      for (const g of ctx.site.gates) {
        const gx = g.edge === 'west' ? 0 : g.edge === 'east' ? ctx.site.width : g.offset + g.width / 2
        const gz = g.edge === 'north' ? 0 : g.edge === 'south' ? ctx.site.depth : g.offset + g.width / 2
        checks.push({ what: 'gate', d: Math.hypot(h.x - gx, h.z - gz) })
      }
      for (const c of checks) {
        if (c.d < def.params.distance) out.push({ objectIds: c.id ? [h.id, c.id] : [h.id], at: { x: h.x, z: h.z }, vars: { dist: fmt(c.d), need: def.params.distance, what: c.what }, refs: { a: h.id } })
      }
    }
    return out
  },
  hiveWater: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    const water = ctx.objects.filter((o) => !o.hidden && (item(o)?.meta?.waterSource === true || item(o)?.role === 'bee-water'))
    for (const h of ctx.objects) {
      if (item(h)?.role !== 'hive' || h.hidden) continue
      let best = Infinity
      for (const w of water) best = Math.min(best, Math.hypot(h.x - w.x, h.z - w.z))
      if (best > def.params.distance) out.push({ objectIds: [h.id], at: { x: h.x, z: h.z }, vars: { dist: best === Infinity ? '—' : fmt(best), need: def.params.distance }, refs: { a: h.id } })
    }
    return out
  },
  runoff: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    const sources = ctx.objects.filter((o) => !o.hidden && (item(o)?.meta?.livestock === true || item(o)?.meta?.pollutes === true))
    const targets = ctx.objects.filter((o) => !o.hidden && (item(o)?.role === 'well' || item(o)?.role === 'tank' || isLeafyBed(o)))
    for (const s of sources) {
      const sl = groundSlope(ctx.terrain, s.x, s.z)
      if (sl.slopeDeg < 0.5) continue
      const dd = { x: Math.sin(sl.aspectDeg * D2R), z: -Math.cos(sl.aspectDeg * D2R) } // downhill unit vector
      const hs = ctx.terrain.groundAt(s.x, s.z)
      for (const t of targets) {
        const dx = t.x - s.x, dz = t.z - s.z
        const d = Math.hypot(dx, dz)
        if (d > def.params.distance || d < 0.01) continue
        const cos = (dx * dd.x + dz * dd.z) / d
        const ang = Math.acos(Math.max(-1, Math.min(1, cos))) / D2R
        const drop = hs - ctx.terrain.groundAt(t.x, t.z)
        if (ang <= def.params.coneDeg && drop > 0.2) {
          const sev = item(t)?.role === 'well' || item(t)?.role === 'tank' ? 'error' : undefined
          out.push({ objectIds: [s.id, t.id], at: { x: (s.x + t.x) / 2, z: (s.z + t.z) / 2 }, vars: { dist: fmt(d), need: def.params.distance, drop: fmt(drop), ...(sev ? { sev: 1 } : {}) }, refs: { a: s.id, b: t.id } })
        }
      }
    }
    return out
  },
  coopClearance: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    for (const c of ctx.objects) {
      const r = item(c)?.role
      if ((r !== 'coop' && !(r === 'livestock')) || c.hidden) continue
      const cs = shapeOf(c)
      if (!cs) continue
      for (const b of ctx.objects) {
        if (!isBed(b) || b.hidden) continue
        const bs = shapeOf(b)
        if (!bs) continue
        const d = shapeDistance(cs, bs)
        if (d < def.params.fromBeds) out.push({ objectIds: [c.id, b.id], at: { x: (c.x + b.x) / 2, z: (c.z + b.z) / 2 }, vars: { dist: fmt(d), need: def.params.fromBeds, what: 'bed' }, refs: { a: c.id, b: b.id } })
      }
      // boundary (neighbours): edge distance
      const pts = cs.type === 'circle' ? [{ x: cs.x, z: cs.z }] : [cs.x, cs.z].length ? corners(cs) : []
      let dmin = Infinity
      for (const p of pts) dmin = Math.min(dmin, distToBoundary(ctx.site, p.x, p.z))
      if (cs.type === 'circle') dmin -= cs.r
      if (dmin < def.params.fromBoundary) out.push({ objectIds: [c.id], at: { x: c.x, z: c.z }, vars: { dist: fmt(Math.max(0, dmin)), need: def.params.fromBoundary, what: 'boundary' }, refs: { a: c.id } })
    }
    return out
  },
  pathLimits: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    for (const o of ctx.objects) {
      if (item(o)?.role !== 'path' || !o.points || o.hidden) continue
      const w = typeof o.params.width === 'number' ? (o.params.width as number) : item(o)!.polyline!.width
      const mid = o.points[Math.floor(o.points.length / 2)]
      if (w < def.params.minWidth) out.push({ objectIds: [o.id], at: mid, vars: { kind: 'width', value: fmt(w), need: def.params.minWidth, level: 2 }, refs: { a: o.id } })
      else if (w < def.params.accessWidth) out.push({ objectIds: [o.id], at: mid, vars: { kind: 'width', value: fmt(w), need: def.params.accessWidth, level: 0 }, refs: { a: o.id } })
      const s = samplePolyline(o.points, 1)
      let maxPct = 0, at = mid
      for (let i = 1; i < s.length; i++) {
        const run = Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z)
        if (run < 0.3) continue
        const pct = (Math.abs(ctx.terrain.heightAt(s[i].x, s[i].z) - ctx.terrain.heightAt(s[i - 1].x, s[i - 1].z)) / run) * 100
        if (pct > maxPct) { maxPct = pct; at = s[i] }
      }
      if (maxPct > def.params.maxSlope) out.push({ objectIds: [o.id], at, vars: { kind: 'slope', value: fmt(maxPct), need: def.params.maxSlope, level: 3 }, refs: { a: o.id } })
      else if (maxPct > def.params.wheelbarrowSlope) out.push({ objectIds: [o.id], at, vars: { kind: 'slope', value: fmt(maxPct), need: def.params.wheelbarrowSlope, level: 2 }, refs: { a: o.id } })
      else if (maxPct > def.params.accessSlope) out.push({ objectIds: [o.id], at, vars: { kind: 'slope', value: fmt(maxPct), need: def.params.accessSlope, level: 0 }, refs: { a: o.id } })
    }
    return out
  },
  treeShadesBed: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    for (const t of ctx.objects) {
      if (!isTree(t) || t.hidden) continue
      const sp = species(t)!
      if (sp.matureHeight < def.params.minHeight) continue
      const reach = sp.matureHeight * def.params.shadowFactor + sp.matureCanopy / 2
      for (const b of ctx.objects) {
        if (!isBed(b) || b.hidden) continue
        const dx = b.x - t.x, dz = b.z - t.z
        const d = Math.hypot(dx, dz)
        if (d > reach || d < 0.1) continue
        const bearing = ((Math.atan2(dx, -dz) / D2R) + 360) % 360 // direction tree -> bed; shadows fall toward 0° (north)
        if (angDiff(bearing, 0) <= def.params.azTolerance) out.push({ objectIds: [t.id, b.id], at: { x: (t.x + b.x) / 2, z: (t.z + b.z) / 2 }, vars: { dist: fmt(d), reach: fmt(reach), height: fmt(sp.matureHeight) }, refs: { a: t.id, b: b.id } })
      }
    }
    return out
  },
  frostPocket: (ctx, def) => {
    const out: ReturnType<Evaluator> = []
    const { site, terrain } = ctx
    const corners4 = [[0, 0], [site.width, 0], [0, site.depth], [site.width, site.depth]].map(([x, z]) => terrain.groundAt(x, z))
    const lo = Math.min(...corners4), hi = Math.max(...corners4)
    const range = Math.max(0.01, hi - lo)
    for (const o of ctx.objects) {
      if (o.hidden) continue
      const it = item(o)
      const sp = species(o)
      const sensitive = (sp?.frostSensitive === true) || it?.role === 'greenhouse' || isLeafyBed(o)
      if (!sensitive) continue
      const h = terrain.groundAt(o.x, o.z)
      const frac = (h - lo) / range
      const slope = groundSlope(terrain, o.x, o.z).slopeDeg
      let pit = 0
      if (ctx.pits) {
        const i = Math.floor((o.x - ctx.pits.x0) / ctx.pits.res), j = Math.floor((o.z - ctx.pits.z0) / ctx.pits.res)
        if (i >= 0 && j >= 0 && i < ctx.pits.nx && j < ctx.pits.nz) pit = ctx.pits.data[j * ctx.pits.nx + i]
      }
      if ((frac < def.params.bottomFraction && slope < def.params.flatDeg) || pit > 0.1) out.push({ objectIds: [o.id], at: { x: o.x, z: o.z }, vars: { slope: fmt(slope), pit: fmt(pit) }, refs: { a: o.id } })
    }
    return out
  },
}

function corners(s: Extract<Shape, { type: 'rect' }>) {
  const c = Math.cos(s.rot), n = Math.sin(s.rot)
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => ({ x: s.x + (sx * s.w / 2) * c + (sz * s.d / 2) * n, z: s.z - (sx * s.w / 2) * n + (sz * s.d / 2) * c }))
}

export function effectiveRule(def: RuleDef, cfg: RuleConfig | undefined) {
  const o = cfg?.[def.id]
  return { ...def, enabled: o?.enabled ?? def.enabled, severity: o?.severity ?? def.severity, params: { ...def.params, ...(o?.params ?? {}) } }
}

/** Run every enabled rule and return all violations, most severe first. */
export function evaluateRules(ctx: RuleContext, cfg?: RuleConfig): Violation[] {
  const out: Violation[] = []
  for (const def of RULES) {
    const eff = effectiveRule(def, cfg)
    if (!eff.enabled) continue
    const ev = E[def.id]
    if (!ev) continue
    for (const v of ev(ctx, eff)) {
      let severity = eff.severity
      // data-driven escalation: runoff towards wells/tanks is an error; path limits grade themselves
      if (def.id === 'runoff' && v.vars.sev === 1) severity = 'error'
      if (def.id === 'pathLimits') severity = v.vars.level === 3 ? 'error' : v.vars.level === 2 ? 'warning' : 'info'
      if (def.id === 'hiveFacing' && (v.vars.diff as number) <= 90) severity = 'info'
      if (def.id === 'canopyOverlap' && (v.vars.overlap as number) < 1) severity = 'info'
      out.push({ ...v, ruleId: def.id, severity, id: `${def.id}:${v.objectIds.join('+')}:${v.vars.what ?? v.vars.kind ?? ''}` })
    }
  }
  const rank = { error: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}
void polylineLength
