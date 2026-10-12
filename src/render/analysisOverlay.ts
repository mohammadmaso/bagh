import * as THREE from 'three'
import { useStore } from '../store/store'
import { useAnalysis } from '../store/analysis'
import { engine } from './engine'
import { heatColor } from '../core/analysis/terrainAnalysis'

export const SUN_MAX_HOURS = 14
export const SLOPE_BANDS = [
  { max: 3, color: [76, 175, 80] }, { max: 6, color: [156, 204, 101] }, { max: 10, color: [255, 235, 59] },
  { max: 15, color: [255, 152, 0] }, { max: 25, color: [229, 57, 53] }, { max: 90, color: [123, 31, 162] },
] as const

function texture(data: Uint8Array, nx: number, nz: number, linear = true): THREE.DataTexture {
  const t = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat)
  t.colorSpace = THREE.SRGBColorSpace
  t.magFilter = linear ? THREE.LinearFilter : THREE.NearestFilter
  t.minFilter = t.magFilter
  t.needsUpdate = true
  return t
}

let current: THREE.Texture | null = null

function apply(tex: THREE.Texture | null, mix: number) {
  const u = engine.terrainLayer.uniforms
  if (current && current !== tex) current.dispose()
  current = tex
  u.uOverlay.value = tex
  u.uOverlayMix.value = tex ? mix : 0
}

function build() {
  const ui = useStore.getState().ui
  const a = useAnalysis.getState()
  const mode = ui.overlay
  if (!engine.terrainLayer) return
  if (mode === 'sun' && a.sun.result) {
    const r = a.sun.result
    const id = ui.sunHoursPreset === 'today' ? 'today' : ui.sunHoursPreset
    const h = r.hours[id] ?? r.hours.today
    const d = new Uint8Array(r.nx * r.nz * 4)
    for (let i = 0; i < h.length; i++) { const [R, G, B] = heatColor(h[i] / SUN_MAX_HOURS); d[i * 4] = R; d[i * 4 + 1] = G; d[i * 4 + 2] = B; d[i * 4 + 3] = 255 }
    apply(texture(d, r.nx, r.nz), 0.78)
  } else if (mode === 'slope' && a.slope) {
    const g = a.slope
    const d = new Uint8Array(g.nx * g.nz * 4)
    for (let i = 0; i < g.data.length; i++) {
      const band = SLOPE_BANDS.find((b) => g.data[i] <= b.max) ?? SLOPE_BANDS[SLOPE_BANDS.length - 1]
      d[i * 4] = band.color[0]; d[i * 4 + 1] = band.color[1]; d[i * 4 + 2] = band.color[2]; d[i * 4 + 3] = 255
    }
    apply(texture(d, g.nx, g.nz, false), 0.6)
  } else if (mode === 'flow' && a.flow) {
    const f = a.flow
    const site = useStore.getState().project.site
    const res = 0.5
    const nx = Math.round(site.width / res), nz = Math.round(site.depth / res)
    const d = new Uint8Array(nx * nz * 4)
    let max = 1
    for (const v of f.accum) if (v > max) max = v
    const lmax = Math.log2(max)
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * res, z = (j + 0.5) * res
      const ci = Math.floor((x - f.grid.x0) / f.grid.res), cj = Math.floor((z - f.grid.z0) / f.grid.res)
      const k = cj * f.grid.nx + ci
      const acc = f.accum[k], pit = f.pits[k]
      const o = (j * nx + i) * 4
      const t = Math.max(0, Math.log2(acc) - 1) / Math.max(1, lmax - 1)
      if (pit > 0.05) { d[o] = 235; d[o + 1] = 60; d[o + 2] = 60; d[o + 3] = 230 }
      else { d[o] = 20; d[o + 1] = 110 + 100 * (1 - t); d[o + 2] = 255; d[o + 3] = Math.round(255 * Math.min(1, t * 1.6)) }
    }
    apply(texture(d, nx, nz), 0.95)
  } else apply(null, 0)
}

let lastKey = ''
/** Keeps the terrain's overlay texture in sync with the selected analysis layer. */
export function startOverlayController() {
  const refresh = () => {
    const ui = useStore.getState().ui
    const a = useAnalysis.getState()
    const key = [ui.overlay, ui.sunHoursPreset, a.sun.result ? 1 : 0, a.sun.progress === 1 ? 'd' : '', a.slope ? 1 : 0, a.flow ? a.flow.accum.length + ':' + a.flow.accum[1000] : 0, engine.terrainRev, a.slope?.data[100], a.flow?.accum[500]].join('|')
    if (key === lastKey) return
    lastKey = key
    build()
    // contour lines are handled by the terrain shader via uContours
  }
  useStore.subscribe(refresh)
  useAnalysis.subscribe(refresh)
  refresh()
}
