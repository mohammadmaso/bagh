import type { SiteConfig } from './types'

const D2R = Math.PI / 180

/** Sculpt layer: additive height offsets on a regular grid covering the plot. Border nodes are always 0. */
export interface SculptGrid {
  res: number // cell size, metres
  nx: number
  nz: number
  data: Float32Array
}

export function makeSculptGrid(width: number, depth: number, res = 0.5): SculptGrid {
  const nx = Math.ceil(width / res) + 1
  const nz = Math.ceil(depth / res) + 1
  return { res, nx, nz, data: new Float32Array(nx * nz) }
}

/** Unit vector (x,z) pointing downhill for a given compass aspect (0 = N, 90 = E, 180 = S). */
export function downhillDir(aspectDeg: number): { x: number; z: number } {
  const a = aspectDeg * D2R
  return { x: Math.sin(a), z: -Math.cos(a) }
}

/** A levelled platform: oriented rectangle at a fixed height, blended into the slope over `margin` metres. */
export interface Pad {
  id: string
  cx: number
  cz: number
  w: number // extent along local x (before rotation)
  d: number // extent along local z
  rotY: number // radians
  level: number
  margin: number
}

export function padWeight(p: Pad, x: number, z: number): number {
  const dx = x - p.cx, dz = z - p.cz
  const c = Math.cos(p.rotY), s = Math.sin(p.rotY)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  const qx = Math.abs(lx) - p.w / 2
  const qz = Math.abs(lz) - p.d / 2
  const dist = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0)
  if (dist <= 0) return 1
  if (dist >= p.margin) return 0
  const t = 1 - dist / p.margin
  return t * t * (3 - 2 * t)
}

export interface Terrain {
  site: SiteConfig
  sculpt: SculptGrid | null
  pads: Pad[]
  /** terrain height (m) at local plot coords. Extends the same slope beyond the plot. */
  heightAt(x: number, z: number): number
  /** base (unsculpted) plane height */
  baseHeightAt(x: number, z: number): number
  /** unit normal */
  normalAt(x: number, z: number): [number, number, number]
  /** slope in degrees and downhill compass bearing */
  slopeAt(x: number, z: number): { slopeDeg: number; aspectDeg: number }
}

export function createTerrain(site: SiteConfig, sculpt: SculptGrid | null = null, pads: Pad[] = []): Terrain {
  const s = Math.tan(site.slopeDeg * D2R)
  const cs = Math.tan(site.crossSlopeDeg * D2R)
  const d = downhillDir(site.aspectDeg)
  // cross direction = downhill rotated +90deg (clockwise seen from above, i.e. to the "right" when facing downhill)
  const c = { x: -d.z, z: d.x }
  const raw = (x: number, z: number) => -(s * (x * d.x + z * d.z)) - cs * (x * c.x + z * c.z)
  // offset so that the lowest plot corner sits at y = 0
  let min = Infinity
  for (const [x, z] of [[0, 0], [site.width, 0], [0, site.depth], [site.width, site.depth]]) {
    min = Math.min(min, raw(x, z))
  }
  const base = (x: number, z: number) => raw(x, z) - min

  const sampleSculpt = (x: number, z: number): number => {
    if (!sculpt) return 0
    const fx = x / sculpt.res
    const fz = z / sculpt.res
    if (fx <= 0 || fz <= 0 || fx >= sculpt.nx - 1 || fz >= sculpt.nz - 1) {
      // edge: bilinear clamp (border nodes are 0, so this fades to 0 at the boundary)
      if (fx < 0 || fz < 0 || fx > sculpt.nx - 1 || fz > sculpt.nz - 1) return 0
    }
    const ix = Math.min(sculpt.nx - 2, Math.max(0, Math.floor(fx)))
    const iz = Math.min(sculpt.nz - 2, Math.max(0, Math.floor(fz)))
    const tx = fx - ix
    const tz = fz - iz
    const i = iz * sculpt.nx + ix
    const a = sculpt.data[i], b = sculpt.data[i + 1]
    const cc = sculpt.data[i + sculpt.nx], e = sculpt.data[i + sculpt.nx + 1]
    return (a * (1 - tx) + b * tx) * (1 - tz) + (cc * (1 - tx) + e * tx) * tz
  }

  const heightAt = (x: number, z: number) => {
    let h = base(x, z) + sampleSculpt(x, z)
    for (const p of pads) {
      const w = padWeight(p, x, z)
      if (w > 0) h += (p.level - h) * w
    }
    return h
  }

  const normalAt = (x: number, z: number): [number, number, number] => {
    const e = 0.25
    const dx = heightAt(x + e, z) - heightAt(x - e, z)
    const dz = heightAt(x, z + e) - heightAt(x, z - e)
    const nx = -dx / (2 * e), nz = -dz / (2 * e)
    const l = Math.hypot(nx, 1, nz)
    return [nx / l, 1 / l, nz / l]
  }

  const slopeAt = (x: number, z: number) => {
    const e = 0.25
    const gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e)
    const gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e)
    const mag = Math.hypot(gx, gz)
    // downhill = -gradient
    let az = Math.atan2(-gx, gz) / D2R // bearing: x=sin, z=-cos  -> atan2(sin, cos) with cos = -(-gz)/mag
    az = (az + 360) % 360
    return { slopeDeg: Math.atan(mag) / D2R, aspectDeg: mag < 1e-9 ? 0 : az }
  }

  return { site, sculpt, pads, heightAt, baseHeightAt: base, normalAt, slopeAt }
}

/** Zero border nodes so the plot boundary stays exact. */
export function pinSculptBorder(g: SculptGrid) {
  for (let i = 0; i < g.nx; i++) { g.data[i] = 0; g.data[(g.nz - 1) * g.nx + i] = 0 }
  for (let j = 0; j < g.nz; j++) { g.data[j * g.nx] = 0; g.data[j * g.nx + g.nx - 1] = 0 }
}
