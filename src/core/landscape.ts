import { fbm, smoothstep } from './noise'
import type { Terrain } from './terrain'

/**
 * Height of the wider landscape. Inside ~150 m of the plot this equals terrain.heightAt (the plot's own slope continues);
 * further out, Alborz-style forested ridges rise to the north, spurs flank east/west, and the slope eases into a valley to the south.
 */
export function landscapeHeight(t: Terrain, x: number, z: number): number {
  const s = t.site
  const base = t.heightAt(x, z)
  const cx = s.width / 2, cz = s.depth / 2
  const dx = x - cx, dz = z - cz
  const r = Math.hypot(dx, dz)
  const k = smoothstep(130, 600, r)
  if (k <= 0) return base
  // direction "uphill" is opposite to the downhill aspect
  const a = (s.aspectDeg * Math.PI) / 180
  const up = -(dx * Math.sin(a) + dz * -Math.cos(a)) // metres uphill from plot centre (positive = uphill)
  const side = dx * Math.cos(a) + dz * Math.sin(a)
  const ridgeN = smoothstep(150, 1800, up) * 420
  const spurs = smoothstep(200, 1500, Math.abs(side)) * 150 * (0.4 + fbm(x * 0.0035, z * 0.0035, 3, 21))
  const rough = (fbm(x * 0.006, z * 0.006, 5, 4) - 0.5) * 2 * 110 * k
  const ridgeLines = Math.pow(Math.abs(fbm(x * 0.004 + 3, z * 0.004, 4, 8) - 0.5) * 2, 0.7) * -70 * k
  let h = base + (ridgeN * (0.7 + fbm(x * 0.003, z * 0.003, 3, 31) * 0.6) + spurs + rough + ridgeLines) * k
  // valley floor to the south (downhill) so the world doesn't keep falling forever
  const floor = -40 - 8 * fbm(x * 0.01, z * 0.01, 2, 5)
  if (up < 0) h = smoothMax(h, floor, 25)
  return h
}

function smoothMax(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + h * h * k * 0.25
}
