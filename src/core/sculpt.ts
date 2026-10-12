import { createTerrain, makeSculptGrid, pinSculptBorder, type SculptGrid, type Terrain } from './terrain'
import type { SculptData } from './project'
import type { SiteConfig, Vec2 } from './types'
import { contourAcross } from './contour'
import { smoothstep } from './noise'

export const SCULPT_RES = 0.5

// ---- (de)serialisation: base64 of a Float32Array, so one stroke = one small `replace` patch in undo history
export function encodeSculpt(g: SculptGrid): SculptData {
  const bytes = new Uint8Array(g.data.buffer.slice(g.data.byteOffset, g.data.byteOffset + g.data.byteLength))
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { res: g.res, nx: g.nx, nz: g.nz, data: btoa(s) }
}

export function decodeSculpt(d: SculptData | null | undefined, site: SiteConfig): SculptGrid {
  const g = makeSculptGrid(site.width, site.depth, d?.res ?? SCULPT_RES)
  if (!d || !d.data) return g
  try {
    const bin = atob(d.data)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const f = new Float32Array(bytes.buffer)
    if (f.length === g.data.length) g.data.set(f)
  } catch { /* corrupt data -> flat */ }
  return g
}

export const isFlat = (g: SculptGrid) => g.data.every((v) => v === 0)

export type BrushMode = 'raise' | 'lower' | 'smooth' | 'flatten'

export interface Brush { mode: BrushMode; radius: number; strength: number }

/**
 * Apply one brush dab at (cx,cz). `strength` is metres per second at the centre (raise/lower) or a 0..1 blend rate
 * (smooth/flatten). `target` is the absolute height for flatten. Border nodes stay 0 so the plot boundary is exact.
 */
export function applyBrush(g: SculptGrid, base: (x: number, z: number) => number, b: Brush, cx: number, cz: number, dt: number, target?: number) {
  const r = b.radius
  const i0 = Math.max(1, Math.floor((cx - r) / g.res)), i1 = Math.min(g.nx - 2, Math.ceil((cx + r) / g.res))
  const j0 = Math.max(1, Math.floor((cz - r) / g.res)), j1 = Math.min(g.nz - 2, Math.ceil((cz + r) / g.res))
  const copy = b.mode === 'smooth' ? Float32Array.from(g.data) : null
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = i * g.res, z = j * g.res
    const d = Math.hypot(x - cx, z - cz)
    if (d > r) continue
    const f = 1 - smoothstep(0, 1, d / r) // soft falloff
    const k = j * g.nx + i
    switch (b.mode) {
      case 'raise': g.data[k] += b.strength * dt * f; break
      case 'lower': g.data[k] -= b.strength * dt * f; break
      case 'smooth': {
        const c = copy!
        const avg = (c[k - 1] + c[k + 1] + c[k - g.nx] + c[k + g.nx] + c[k]) / 5
        // smooth total height (base + delta) is dominated by base which is already smooth: smoothing the delta layer suffices
        g.data[k] += (avg - c[k]) * Math.min(1, b.strength * dt * 4) * f
        break
      }
      case 'flatten': {
        const want = (target ?? base(x, z)) - base(x, z)
        g.data[k] += (want - g.data[k]) * Math.min(1, b.strength * dt * 4) * f
        break
      }
    }
    // keep the delta bounded to avoid absurd mountains
    g.data[k] = Math.max(-6, Math.min(6, g.data[k]))
  }
  pinSculptBorder(g)
}

// ---------------------------------------------------------------- terraces

export interface TerraceOptions {
  region: { x0: number; x1: number; z0: number; z1: number }
  wallHeight: number
  /** metres over which the terraced surface blends into natural ground outside the region */
  blend?: number
}

export interface TerraceResult {
  delta: Float32Array
  walls: Vec2[][]
  cut: number
  fill: number
  levels: number[]
}

/**
 * Contour terraces: snaps the ground to level treads at multiples of `wallHeight`, with risers where the natural ground
 * crosses (k + ½)·h. Returns the sculpt delta to ADD to the existing grid, the retaining-wall polylines along the risers
 * (following contours), and cut/fill volumes.
 */
export function generateTerraces(base: Terrain, current: SculptGrid, opt: TerraceOptions): TerraceResult {
  const { site } = base
  const h = Math.max(0.1, opt.wallHeight)
  const blend = opt.blend ?? 1.5
  const { x0, x1, z0, z1 } = opt.region
  const delta = new Float32Array(current.data.length)
  let cut = 0, fill = 0
  const bevel = 0.04
  const cell = current.res * current.res
  const natural = (x: number, z: number) => base.groundAt(x, z) - 0 // base plane + existing sculpt is `current`; terraces are cut from natural+current
  for (let j = 1; j < current.nz - 1; j++) for (let i = 1; i < current.nx - 1; i++) {
    const x = i * current.res, z = j * current.res
    // region weight with soft edge
    const dx = Math.max(x0 - x, x - x1, 0), dz = Math.max(z0 - z, z - z1, 0)
    const dist = Math.hypot(dx, dz)
    const w = dist <= 0 ? 1 : 1 - smoothstep(0, blend, dist)
    if (w <= 0) continue
    const gnd = natural(x, z)
    const q = gnd / h
    const k = Math.floor(q)
    const f = q - k
    const level = (k + smoothstep(0.5 - bevel, 0.5 + bevel, f)) * h
    const d = (level - gnd) * w
    delta[j * current.nx + i] = d
    if (d > 0) fill += d * cell; else cut += -d * cell
  }
  // walls: contours at (k+½)h inside the region
  const levels: number[] = []
  const walls: Vec2[][] = []
  const lo = Math.min(...[[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => base.groundAt(x, z)))
  const hi = Math.max(...[[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => base.groundAt(x, z)))
  const flat = createTerrain(site, current) // contours of the natural ground (without pads)
  const cx = (x0 + x1) / 2
  for (let k = Math.floor(lo / h); k <= Math.ceil(hi / h); k++) {
    const target = (k + 0.5) * h
    if (target <= lo + 0.05 || target >= hi - 0.05) continue
    // find z at x = cx where ground == target by scanning
    let zFound: number | null = null
    let prev = flat.groundAt(cx, z0 - 0.0)
    for (let z = z0; z <= z1; z += 0.1) {
      const hh = flat.groundAt(cx, z)
      if ((prev - target) * (hh - target) <= 0) { zFound = z; break }
      prev = hh
    }
    if (zFound === null) continue
    const pts = contourAcross(flat, cx, zFound, 0.5).filter((p) => p.x >= x0 - 1e-6 && p.x <= x1 + 1e-6 && p.z >= z0 - 1e-6 && p.z <= z1 + 1e-6)
    if (pts.length > 2) { walls.push(pts); levels.push(target) }
  }
  return { delta, walls, cut, fill, levels }
}

/** Add `delta` to the grid, keep the boundary pinned, return the new grid. */
export function addDelta(g: SculptGrid, delta: Float32Array): SculptGrid {
  const out: SculptGrid = { ...g, data: Float32Array.from(g.data) }
  for (let i = 0; i < out.data.length; i++) out.data[i] += delta[i]
  pinSculptBorder(out)
  return out
}
