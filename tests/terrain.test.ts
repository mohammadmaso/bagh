import { describe, it, expect } from 'vitest'
import { createTerrain, makeSculptGrid, pinSculptBorder } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'

describe('heightAt', () => {
  const t = createTerrain(DEFAULT_SITE)
  it('south edge is lowest (0) and north edge ~5.29 m higher', () => {
    expect(t.heightAt(10, 30)).toBeCloseTo(0, 6)
    expect(t.heightAt(10, 0)).toBeCloseTo(30 * Math.tan((10 * Math.PI) / 180), 6)
    expect(t.heightAt(10, 0)).toBeGreaterThan(5.2)
    expect(t.heightAt(10, 0)).toBeLessThan(5.4)
  })
  it('is constant east-west when there is no cross slope', () => {
    expect(t.heightAt(0, 12)).toBeCloseTo(t.heightAt(33, 12), 9)
  })
  it('slope and aspect', () => {
    const s = t.slopeAt(15, 15)
    expect(s.slopeDeg).toBeCloseTo(10, 4)
    expect(s.aspectDeg).toBeCloseTo(180, 3)
  })
  it('aspect east: east edge lowest', () => {
    const e = createTerrain({ ...DEFAULT_SITE, aspectDeg: 90 })
    expect(e.heightAt(33, 5)).toBeLessThan(e.heightAt(0, 5))
    expect(e.slopeAt(10, 10).aspectDeg).toBeCloseTo(90, 3)
  })
  it('terrain normal tilts toward downhill (south, +z)', () => {
    const n = t.normalAt(10, 10)
    expect(n[2]).toBeGreaterThan(0)
    expect(n[1]).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 4)
  })
  it('sculpt adds height but boundary stays exact', () => {
    const g = makeSculptGrid(33, 30)
    g.data.fill(1)
    pinSculptBorder(g)
    const s = createTerrain(DEFAULT_SITE, g)
    expect(s.heightAt(0, 10)).toBeCloseTo(t.heightAt(0, 10), 9)
    expect(s.heightAt(16, 15)).toBeCloseTo(t.heightAt(16, 15) + 1, 6)
  })
  it('extends the same slope beyond the plot', () => {
    expect(t.heightAt(10, -10)).toBeCloseTo(t.heightAt(10, 0) + 10 * Math.tan((10 * Math.PI) / 180), 6)
  })
})

describe('pads', () => {
  it('levels the terrain inside the pad and blends out', () => {
    const pad = { id: 'p', cx: 16, cz: 15, w: 5, d: 5, rotY: 0, level: 2.5, margin: 2 }
    const t = createTerrain(DEFAULT_SITE, null, [pad])
    expect(t.heightAt(14, 13)).toBeCloseTo(2.5, 9)
    expect(t.heightAt(18.5, 17.5)).toBeCloseTo(2.5, 9)
    expect(t.heightAt(16, 25)).toBeCloseTo(createTerrain(DEFAULT_SITE).heightAt(16, 25), 9)
  })
})
