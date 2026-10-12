import { describe, it, expect } from 'vitest'
import { applyBrush, encodeSculpt, decodeSculpt, generateTerraces, addDelta, isFlat } from '../src/core/sculpt'
import { createTerrain, makeSculptGrid } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'

const site = DEFAULT_SITE
const base = createTerrain(site)

describe('sculpt brushes', () => {
  it('raise then lower returns toward zero; boundary stays exact', () => {
    const g = makeSculptGrid(site.width, site.depth)
    applyBrush(g, base.heightAt, { mode: 'raise', radius: 3, strength: 1 }, 16, 15, 1)
    const t = createTerrain(site, g)
    expect(t.heightAt(16, 15)).toBeCloseTo(base.heightAt(16, 15) + 1, 1)
    applyBrush(g, base.heightAt, { mode: 'lower', radius: 3, strength: 1 }, 16, 15, 1)
    expect(Math.abs(createTerrain(site, g).heightAt(16, 15) - base.heightAt(16, 15))).toBeLessThan(0.01)
    // brush at the fence must not move the boundary
    applyBrush(g, base.heightAt, { mode: 'raise', radius: 5, strength: 5 }, 0, 15, 2)
    const t2 = createTerrain(site, g)
    for (let z = 0; z <= 30; z += 2) expect(t2.heightAt(0, z)).toBeCloseTo(base.heightAt(0, z), 9)
  })
  it('flatten pulls the surface to the target height', () => {
    const g = makeSculptGrid(site.width, site.depth)
    const target = base.heightAt(16, 15)
    for (let i = 0; i < 20; i++) applyBrush(g, base.heightAt, { mode: 'flatten', radius: 4, strength: 1 }, 16, 15, 0.2, target)
    const t = createTerrain(site, g)
    expect(t.heightAt(16, 13.5)).toBeCloseTo(target, 1) // north of centre: was higher, now cut to level
    expect(t.heightAt(16, 16.5)).toBeCloseTo(target, 1) // south: was lower, now filled
  })
  it('smooth reduces a spike', () => {
    const g = makeSculptGrid(site.width, site.depth)
    g.data[30 * g.nx + 30] = 2
    for (let i = 0; i < 10; i++) applyBrush(g, base.heightAt, { mode: 'smooth', radius: 2, strength: 2 }, 15, 15, 0.3)
    expect(g.data[30 * g.nx + 30]).toBeLessThan(1)
  })
  it('encode/decode round-trips and flat grids stay flat', () => {
    const g = makeSculptGrid(site.width, site.depth)
    expect(isFlat(g)).toBe(true)
    applyBrush(g, base.heightAt, { mode: 'raise', radius: 3, strength: 1 }, 16, 15, 1)
    const d = decodeSculpt(encodeSculpt(g), site)
    expect(Array.from(d.data)).toEqual(Array.from(g.data))
    expect(isFlat(decodeSculpt(null, site))).toBe(true)
  })
})

describe('terraces', () => {
  it('produces level treads at multiples of the wall height and walls along contours', () => {
    const g = makeSculptGrid(site.width, site.depth)
    const r = generateTerraces(base, g, { region: { x0: 4, x1: 29, z0: 4, z1: 20 }, wallHeight: 0.6 })
    expect(r.walls.length).toBeGreaterThan(2)
    expect(r.cut).toBeGreaterThan(0); expect(r.fill).toBeGreaterThan(0)
    const t = createTerrain(site, addDelta(g, r.delta))
    // inside the region on a tread (away from the risers) the surface is a multiple of 0.6
    const samples: number[] = []
    for (let z = 5; z < 19; z += 0.5) samples.push(t.heightAt(16, z))
    const onTread = samples.filter((h) => Math.abs(h / 0.6 - Math.round(h / 0.6)) < 0.03)
    expect(onTread.length / samples.length).toBeGreaterThan(0.6)
    // each wall follows a contour of the natural ground
    for (const w of r.walls) { const h0 = base.heightAt(w[0].x, w[0].z); for (const p of w) expect(base.heightAt(p.x, p.z)).toBeCloseTo(h0, 1) }
    // boundary unchanged
    expect(t.heightAt(0, 12)).toBeCloseTo(base.heightAt(0, 12), 9)
  })
  it('cut and fill roughly balance on a plane', () => {
    const r = generateTerraces(base, makeSculptGrid(site.width, site.depth), { region: { x0: 4, x1: 29, z0: 4, z1: 24 }, wallHeight: 0.8 })
    expect(Math.abs(r.cut - r.fill) / (r.cut + r.fill)).toBeLessThan(0.25)
  })
})
