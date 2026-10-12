import { createTerrain, makeSculptGrid, type Cut, type Pad } from '../terrain'
import type { SiteConfig } from '../types'
import { sunDaySamples, horizonElevation } from '../sun'
import type { Occluder } from './occluders'

export interface SunHoursInput {
  site: SiteConfig
  sculpt: { res: number; data: number[] } | null
  pads: Pad[]
  cuts: Cut[]
  occluders: Occluder[]
  /** dates to evaluate */
  dates: { id: string; year: number; month: number; day: number; /** per-date occluders (leaf cover differs by season) */ occluders?: Occluder[] }[]
  res: number // metres per cell
  stepMin: number
  /** sample height above ground (m) */
  sampleHeight: number
}

export interface SunHoursResult {
  nx: number
  nz: number
  res: number
  /** per date id: hours of direct sun per cell (row-major, z outer) */
  hours: Record<string, Float32Array>
  /** day length (hours of sun above geometric horizon + horizon profile) for reference */
  openSky: Record<string, number>
}

const D = Math.PI / 180

interface Prepared {
  o: Occluder
  // xz AABB for quick rejection
  x0: number; x1: number; z0: number; z1: number; y0: number; y1: number
  cos: number; sin: number
}

function prepare(oc: Occluder[]): Prepared[] {
  return oc.map((o) => {
    if (o.kind === 'ellipsoid') return { o, x0: o.cx - o.rx, x1: o.cx + o.rx, z0: o.cz - o.rz, z1: o.cz + o.rz, y0: o.cy - o.ry, y1: o.cy + o.ry, cos: 1, sin: 0 }
    const c = Math.cos(o.rot), s = Math.sin(o.rot)
    const ex = Math.abs(c) * o.w / 2 + Math.abs(s) * o.d / 2, ez = Math.abs(s) * o.w / 2 + Math.abs(c) * o.d / 2
    const top = o.kind === 'box' ? o.y1 : o.y0 + o.wallH + o.rise
    return { o, x0: o.cx - ex, x1: o.cx + ex, z0: o.cz - ez, z1: o.cz + ez, y0: o.y0, y1: top, cos: c, sin: s }
  })
}

/** Slab test for AABB (in xz) ∩ ray, returns [tmin, tmax] or null. dir need not be normalised. */
function rayAabb(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, p: Prepared): [number, number] | null {
  let t0 = 0, t1 = 1e9
  const slab = (o: number, d: number, a: number, b: number) => {
    if (Math.abs(d) < 1e-9) return o >= a && o <= b
    let ta = (a - o) / d, tb = (b - o) / d
    if (ta > tb) { const t = ta; ta = tb; tb = t }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    return t0 <= t1
  }
  if (!slab(ox, dx, p.x0, p.x1) || !slab(oy, dy, p.y0, p.y1) || !slab(oz, dz, p.z0, p.z1)) return null
  return [t0, t1]
}

/** Transmittance (0..1) of a ray from (ox,oy,oz) along unit dir through one occluder. */
function transmit(p: Prepared, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
  const bb = rayAabb(ox, oy, oz, dx, dy, dz, p)
  if (!bb) return 1
  const o = p.o
  if (o.kind === 'ellipsoid') {
    const ax = (ox - o.cx) / o.rx, ay = (oy - o.cy) / o.ry, az = (oz - o.cz) / o.rz
    const bx = dx / o.rx, by = dy / o.ry, bz = dz / o.rz
    const A = bx * bx + by * by + bz * bz
    const B = 2 * (ax * bx + ay * by + az * bz)
    const C = ax * ax + ay * ay + az * az - 1
    const disc = B * B - 4 * A * C
    if (disc <= 0) return 1
    const sq = Math.sqrt(disc)
    let t0 = (-B - sq) / (2 * A), t1 = (-B + sq) / (2 * A)
    if (t1 <= 0) return 1
    t0 = Math.max(t0, 0)
    // unit direction => chord length = t1 - t0
    return Math.exp(-o.sigma * (t1 - t0) * 0.75)
  }
  // oriented footprint test in local frame
  const lx0 = (ox - o.cx) * p.cos - (oz - o.cz) * p.sin
  const lz0 = (ox - o.cx) * p.sin + (oz - o.cz) * p.cos
  const ldx = dx * p.cos - dz * p.sin, ldz = dx * p.sin + dz * p.cos
  let t0 = 0, t1 = 1e9
  const slab = (oo: number, d: number, a: number, b: number) => {
    if (Math.abs(d) < 1e-9) return oo >= a && oo <= b
    let ta = (a - oo) / d, tb = (b - oo) / d
    if (ta > tb) { const t = ta; ta = tb; tb = t }
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb)
    return t0 <= t1
  }
  const hw = o.w / 2, hd = o.d / 2
  if (o.kind === 'box') {
    if (!slab(lx0, ldx, -hw, hw) || !slab(lz0, ldz, -hd, hd) || !slab(oy, dy, o.y0, o.y1)) return 1
    return 1 - o.opacity
  }
  // gable: ridge along local x; cross-section in (lz, y)
  if (!slab(lx0, ldx, -hw, hw) || !slab(lz0, ldz, -hd, hd) || !slab(oy, dy, o.y0, o.y0 + o.wallH + o.rise)) return 1
  if (t1 <= t0) return 1
  const n = Math.max(2, Math.ceil((t1 - t0) / 0.25))
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    const z = lz0 + ldz * t, y = oy + dy * t - o.y0
    const roofY = o.wallH + o.rise * (1 - Math.min(1, Math.abs(z) / hd))
    if (y <= roofY) return 1 - o.opacity
  }
  return 1
}

/** Direct-sun hours per ground cell. Pure; runs in a worker for large inputs. */
export function computeSunHours(inp: SunHoursInput, onProgress?: (p: number) => void): SunHoursResult {
  const { site } = inp
  let sculpt = null
  if (inp.sculpt) { sculpt = makeSculptGrid(site.width, site.depth, inp.sculpt.res); sculpt.data.set(inp.sculpt.data) }
  const terrain = createTerrain(site, sculpt, inp.pads, inp.cuts)
  const nx = Math.round(site.width / inp.res), nz = Math.round(site.depth / inp.res)
  const preparedDefault = prepare(inp.occluders)
  const hours: Record<string, Float32Array> = {}
  const openSky: Record<string, number> = {}
  // precompute ground heights
  const gh = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) gh[j * nx + i] = terrain.heightAt((i + 0.5) * inp.res, (j + 0.5) * inp.res)
  const slopeMarch = (x: number, y: number, z: number, dx: number, dy: number, dz: number) => {
    // terrain self-shadowing: march along the ray in plan
    const horiz = Math.hypot(dx, dz)
    if (horiz < 1e-6) return false
    const step = 1.5
    for (let s = step; s < 90; s += step) {
      const px = x + (dx / horiz) * s, pz = z + (dz / horiz) * s
      const ry = y + (dy / horiz) * s
      if (terrain.heightAt(px, pz) > ry + 0.05) return true
    }
    return false
  }
  const total = inp.dates.length
  inp.dates.forEach((dt, di) => {
    const samples = sunDaySamples(dt.year, dt.month, dt.day, site.lat, site.lon, site.tzOffsetMinutes, inp.stepMin)
    const usable = samples.filter((s) => s.el > horizonElevation(site.horizon, s.az))
    const prepared = dt.occluders ? prepare(dt.occluders) : preparedDefault
    const out = new Float32Array(nx * nz)
    const dtH = inp.stepMin / 60
    openSky[dt.id] = usable.length * dtH
    // candidate occluders by sample: skip those whose xz AABB is irrelevant is handled inside rayAabb
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * inp.res, z = (j + 0.5) * inp.res
        const y = gh[j * nx + i] + inp.sampleHeight
        let acc = 0
        for (const s of usable) {
          const dx = s.dir[0], dy = s.dir[1], dz = s.dir[2]
          let T = 1
          for (const p of prepared) {
            // quick reject: the occluder must lie in the sun direction (dot > 0) – cheap check on centre
            const cx = (p.x0 + p.x1) / 2 - x, cz = (p.z0 + p.z1) / 2 - z
            if (cx * dx + cz * dz < -Math.max(p.x1 - p.x0, p.z1 - p.z0)) continue
            T *= transmit(p, x, y, z, dx, dy, dz)
            if (T < 0.01) break
          }
          if (T > 0.01 && terrain.slopeAt(x, z).slopeDeg > 0.5 && slopeMarch(x, y, z, dx, dy, dz)) T = 0
          acc += T * dtH
        }
        out[j * nx + i] = acc
      }
      if (onProgress && j % 4 === 0) onProgress((di + j / nz) / total)
    }
    hours[dt.id] = out
  })
  onProgress?.(1)
  return { nx, nz, res: inp.res, hours, openSky }
}

/** Mean of a cell-grid over a rotated rectangle / circle footprint. */
export function meanOverShape(grid: Float32Array, nx: number, nz: number, res: number, shape: { type: 'rect'; x: number; z: number; w: number; d: number; rot: number } | { type: 'circle'; x: number; z: number; r: number }): number {
  let sum = 0, n = 0
  const r = shape.type === 'circle' ? shape.r : Math.hypot(shape.w, shape.d) / 2
  const i0 = Math.max(0, Math.floor((shape.x - r) / res)), i1 = Math.min(nx - 1, Math.ceil((shape.x + r) / res))
  const j0 = Math.max(0, Math.floor((shape.z - r) / res)), j1 = Math.min(nz - 1, Math.ceil((shape.z + r) / res))
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = (i + 0.5) * res, z = (j + 0.5) * res
    let inside: boolean
    if (shape.type === 'circle') inside = Math.hypot(x - shape.x, z - shape.z) <= shape.r
    else {
      const dx = x - shape.x, dz = z - shape.z, c = Math.cos(shape.rot), s = Math.sin(shape.rot)
      inside = Math.abs(dx * c - dz * s) <= shape.w / 2 && Math.abs(dx * s + dz * c) <= shape.d / 2
    }
    if (inside) { sum += grid[j * nx + i]; n++ }
  }
  if (n === 0) {
    const i = Math.min(nx - 1, Math.max(0, Math.floor(shape.x / res))), j = Math.min(nz - 1, Math.max(0, Math.floor(shape.z / res)))
    return grid[j * nx + i]
  }
  return sum / n
}
void D
