import { describe, it, expect } from 'vitest'
import { traceContour, contourAcross } from '../src/core/contour'
import { createTerrain } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'

describe('contours', () => {
  const t = createTerrain(DEFAULT_SITE)
  it('stays at constant elevation, runs east-west on a south-facing slope', () => {
    const pts = traceContour(t, 5, 15, 1, 20, 1)
    const h0 = t.heightAt(5, 15)
    for (const p of pts) expect(t.heightAt(p.x, p.z)).toBeCloseTo(h0, 3)
    expect(pts[pts.length - 1].x).toBeGreaterThan(20)
    expect(Math.abs(pts[pts.length - 1].z - 15)).toBeLessThan(0.01)
  })
  it('contourAcross spans the plot width', () => {
    const pts = contourAcross(t, 16, 12, 0.5)
    expect(pts[0].x).toBeLessThan(0.6)
    expect(pts[pts.length - 1].x).toBeGreaterThan(32.4)
  })
})
