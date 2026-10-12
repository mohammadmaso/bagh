import type { Terrain, Pad } from '../terrain'
import { createTerrain } from '../terrain'

export interface Grid { nx: number; nz: number; res: number; x0: number; z0: number; data: Float32Array }

export function sampleGrid(t: Terrain, x0: number, z0: number, x1: number, z1: number, res: number): Grid {
  const nx = Math.round((x1 - x0) / res), nz = Math.round((z1 - z0) / res)
  const data = new Float32Array(nx * nz)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) data[j * nx + i] = t.heightAt(x0 + (i + 0.5) * res, z0 + (j + 0.5) * res)
  return { nx, nz, res, x0, z0, data }
}

/** Slope (degrees) per cell by central differences on the sampled terrain. */
export function slopeGrid(t: Terrain, res = 0.5): Grid {
  const { width, depth } = t.site
  const g = sampleGrid(t, 0, 0, width, depth, res)
  const out = new Float32Array(g.data.length)
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(g.nx - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(g.nz - 1, j + 1)
    const gx = (g.data[j * g.nx + i1] - g.data[j * g.nx + i0]) / ((i1 - i0) * res)
    const gz = (g.data[j1 * g.nx + i] - g.data[j0 * g.nx + i]) / ((j1 - j0) * res)
    out[j * g.nx + i] = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI
  }
  return { ...g, data: out }
}

export interface FlowResult {
  grid: Grid
  /** D8 direction index 0..7 or -1 for outlets */
  dir: Int8Array
  /** upstream contributing cells (including self) after depression filling */
  accum: Float32Array
  /** filled-depression depth (m) – positive where water would pond */
  pits: Float32Array
}

const DX = [1, 1, 0, -1, -1, -1, 0, 1]
const DZ = [0, 1, 1, 1, 0, -1, -1, -1]
const DD = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2]

/**
 * D8 flow routing with priority-flood depression filling. The grid extends beyond the plot (uphill catchment), so
 * accumulation near the north fence includes water arriving from the slope above.
 */
export function computeFlow(t: Terrain, res = 1, margin = { n: 30, s: 4, e: 6, w: 6 }): FlowResult {
  const { width, depth } = t.site
  const g = sampleGrid(t, -margin.w, -margin.n, width + margin.e, depth + margin.s, res)
  const { nx, nz } = g
  const n = nx * nz
  const z = Float32Array.from(g.data)
  const orig = Float32Array.from(g.data)
  // priority flood (Barnes): fill depressions so every cell drains to an edge
  const visited = new Uint8Array(n)
  const heap: number[] = []
  const push = (i: number) => { heap.push(i); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (z[heap[p]] <= z[heap[k]]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p } }
  const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && z[heap[l]] < z[heap[m]]) m = l; if (r < heap.length && z[heap[r]] < z[heap[m]]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m } } return top }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) { const k = j * nx + i; visited[k] = 1; push(k) }
  const order: number[] = []
  while (heap.length) {
    const c = pop()
    order.push(c)
    const ci = c % nx, cj = (c / nx) | 0
    for (let d = 0; d < 8; d++) {
      const ni = ci + DX[d], nj = cj + DZ[d]
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const k = nj * nx + ni
      if (visited[k]) continue
      visited[k] = 1
      if (z[k] < z[c]) z[k] = z[c] + 1e-4 // fill, with tiny gradient so flats drain
      push(k)
    }
  }
  const dir = new Int8Array(n).fill(-1)
  for (let c = 0; c < n; c++) {
    const ci = c % nx, cj = (c / nx) | 0
    let best = 0, bd = -1
    for (let d = 0; d < 8; d++) {
      const ni = ci + DX[d], nj = cj + DZ[d]
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const s = (z[c] - z[nj * nx + ni]) / (DD[d] * res)
      if (s > best) { best = s; bd = d }
    }
    dir[c] = bd
  }
  // accumulate from highest to lowest (order is ascending in filled elevation -> reverse)
  const accum = new Float32Array(n).fill(1)
  for (let q = order.length - 1; q >= 0; q--) {
    const c = order[q]
    const d = dir[c]
    if (d < 0) continue
    const ni = (c % nx) + DX[d], nj = ((c / nx) | 0) + DZ[d]
    accum[nj * nx + ni] += accum[c]
  }
  const pits = new Float32Array(n)
  for (let c = 0; c < n; c++) pits[c] = Math.max(0, z[c] - orig[c] - (c >= 0 ? 0.0003 : 0))
  return { grid: g, dir, accum, pits }
}

/** Cut/fill volumes (m³) between the original slope and the pad-levelled surface. */
export function cutFill(base: Terrain, pads: Pad[], res = 0.25): { cut: number; fill: number; perPad: Record<string, { cut: number; fill: number }> } {
  const withPads = createTerrain(base.site, base.sculpt, pads, base.cuts)
  const perPad: Record<string, { cut: number; fill: number }> = {}
  let cut = 0, fill = 0
  const cell = res * res
  for (const p of pads) {
    const r = Math.hypot(p.w, p.d) / 2 + p.margin
    const e = { cut: 0, fill: 0 }
    const x0 = Math.max(0, p.cx - r), x1 = Math.min(base.site.width, p.cx + r), z0 = Math.max(0, p.cz - r), z1 = Math.min(base.site.depth, p.cz + r)
    // evaluate this pad alone to attribute volumes
    const solo = createTerrain(base.site, base.sculpt, [p], base.cuts)
    for (let x = x0 + res / 2; x < x1; x += res) for (let z = z0 + res / 2; z < z1; z += res) {
      const d = solo.heightAt(x, z) - base.heightAt(x, z)
      if (d > 1e-4) e.fill += d * cell
      else if (d < -1e-4) e.cut += -d * cell
    }
    perPad[p.id] = e
    cut += e.cut; fill += e.fill
  }
  void withPads
  return { cut, fill, perPad }
}

/** Colour ramp (0..1) for heatmaps -> [r,g,b] 0..255. Perceptually ordered: dark blue → teal → green → yellow → orange → red. */
export function heatColor(t: number): [number, number, number] {
  const stops: [number, [number, number, number]][] = [
    [0, [40, 40, 120]], [0.2, [40, 120, 190]], [0.4, [60, 170, 120]], [0.6, [190, 205, 70]], [0.8, [240, 160, 50]], [1, [210, 50, 40]],
  ]
  const x = Math.min(1, Math.max(0, t))
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [a, ca] = stops[i - 1], [b, cb] = stops[i]
      const k = (x - a) / (b - a)
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k]
    }
  }
  return stops[stops.length - 1][1]
}
