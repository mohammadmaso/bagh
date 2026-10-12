import { describe, it, expect } from 'vitest'
import { computeFlow, slopeGrid, cutFill, heatColor } from '../src/core/analysis/terrainAnalysis'
import { createTerrain, makeSculptGrid } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'

describe('terrain analysis', () => {
  const t = createTerrain(DEFAULT_SITE)
  it('slope grid is ~10° everywhere on the plane', () => {
    const g = slopeGrid(t, 1)
    for (const v of g.data) expect(v).toBeCloseTo(10, 1)
  })
  it('flow runs south and accumulation grows downslope', () => {
    const f = computeFlow(t, 1)
    const { grid } = f
    const idx = (x: number, z: number) => Math.floor((z - grid.z0) / grid.res) * grid.nx + Math.floor((x - grid.x0) / grid.res)
    const north = f.accum[idx(16, 1)], south = f.accum[idx(16, 28)]
    expect(south).toBeGreaterThan(north)
    // direction of a mid cell is due south (index 2 = +z)
    expect(f.dir[idx(16, 15)]).toBe(2)
  })
  it('a bowl creates a pit and accumulation drains through it', () => {
    const sc = makeSculptGrid(33, 30, 0.5)
    // dig a 3 m deep bowl in the middle
    for (let j = 0; j < sc.nz; j++) for (let i = 0; i < sc.nx; i++) { const d = Math.hypot(i * 0.5 - 16, j * 0.5 - 15); sc.data[j * sc.nx + i] = -3 * Math.max(0, 1 - d / 4) }
    const bowl = createTerrain(DEFAULT_SITE, sc)
    const f = computeFlow(bowl, 1)
    expect(Math.max(...f.pits)).toBeGreaterThan(0.3)
    const total = f.accum.reduce((a, b) => Math.max(a, b), 0)
    expect(total).toBeGreaterThan(100)
  })
  it('cut/fill of a pad balances roughly on a plane', () => {
    const pad = { id: 'p', cx: 16, cz: 15, w: 4, d: 4, rotY: 0, level: t.baseHeightAt(16, 15), margin: 1 }
    const r = cutFill(t, [pad], 0.25)
    expect(r.cut).toBeGreaterThan(1); expect(r.fill).toBeGreaterThan(1)
    expect(Math.abs(r.cut - r.fill) / (r.cut + r.fill)).toBeLessThan(0.1)
  })
  it('heat colour ramp is continuous and clamped', () => {
    expect(heatColor(-1)).toEqual(heatColor(0)); expect(heatColor(2)).toEqual(heatColor(1))
  })
})
