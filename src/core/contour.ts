import type { Terrain } from './terrain'
import type { Vec2 } from './types'

/**
 * Walk along the contour line (constant height) through (x0,z0). `dir` = +1 / -1 selects which way along the contour.
 * Uses the local gradient to stay on the iso-line, with a small corrector toward the starting elevation.
 */
export function traceContour(t: Terrain, x0: number, z0: number, step: number, count: number, dir: 1 | -1 = 1): Vec2[] {
  const out: Vec2[] = [{ x: x0, z: z0 }]
  const h0 = t.heightAt(x0, z0)
  let x = x0, z = z0
  const e = 0.2
  let prevDx = 0, prevDz = 0
  for (let i = 0; i < count; i++) {
    const gx = (t.heightAt(x + e, z) - t.heightAt(x - e, z)) / (2 * e)
    const gz = (t.heightAt(x, z + e) - t.heightAt(x, z - e)) / (2 * e)
    const gl = Math.hypot(gx, gz)
    if (gl < 1e-6) break
    // tangent is perpendicular to the gradient; choose orientation so +dir runs west->east for a south-facing slope
    let tx = -gz / gl, tz = gx / gl
    if (i === 0 && (tx < -1e-9 || (Math.abs(tx) <= 1e-9 && tz < 0))) { tx = -tx; tz = -tz } // canonical orientation: toward +x (or +z)
    let sx = i === 0 ? dir * tx : tx, sz = i === 0 ? dir * tz : tz
    if (i > 0 && sx * prevDx + sz * prevDz < 0) { sx = -sx; sz = -sz }
    prevDx = sx; prevDz = sz
    x += sx * step; z += sz * step
    // corrector: project back to height h0 along the gradient
    for (let k = 0; k < 3; k++) {
      const h = t.heightAt(x, z)
      const ggx = (t.heightAt(x + e, z) - t.heightAt(x - e, z)) / (2 * e)
      const ggz = (t.heightAt(x, z + e) - t.heightAt(x, z - e)) / (2 * e)
      const g2 = ggx * ggx + ggz * ggz
      if (g2 < 1e-9) break
      x -= ((h - h0) * ggx) / g2
      z -= ((h - h0) * ggz) / g2
    }
    out.push({ x, z })
  }
  return out
}

/** Full-width contour polyline through (x0,z0) clipped to the plot rectangle. */
export function contourAcross(t: Terrain, x0: number, z0: number, step = 0.5): Vec2[] {
  const { width, depth } = t.site
  const fwd = traceContour(t, x0, z0, step, Math.ceil((width + depth) / step), 1)
  const back = traceContour(t, x0, z0, step, Math.ceil((width + depth) / step), -1)
  const all = [...back.slice(1).reverse(), ...fwd]
  return all.filter((p) => p.x >= 0 && p.x <= width && p.z >= 0 && p.z <= depth)
}
