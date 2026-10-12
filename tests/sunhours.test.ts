import { describe, it, expect } from 'vitest'
import { computeSunHours, meanOverShape } from '../src/core/analysis/sunHours'
import { buildOccluders, type Occluder } from '../src/core/analysis/occluders'
import { createTerrain } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'
import type { PlacedObject } from '../src/core/project'

const site = { ...DEFAULT_SITE, horizon: [{ az: 0, el: 0 }, { az: 180, el: 0 }] }
const base = { site, sculpt: null, pads: [], cuts: [], dates: [{ id: 'jun', year: 2026, month: 6, day: 21 }, { id: 'dec', year: 2026, month: 12, day: 21 }], res: 2, stepMin: 20, sampleHeight: 0.3 }

describe('sun hours', () => {
  it('open lawn gets about full day length (flat horizon): ~14.5 h summer, ~9.7 h winter', () => {
    const flat = { ...site, slopeDeg: 0 }
    const r = computeSunHours({ ...base, site: flat, occluders: [] })
    const j = meanOverShape(r.hours.jun, r.nx, r.nz, r.res, { type: 'circle', x: 16, z: 15, r: 3 })
    const d = meanOverShape(r.hours.dec, r.nx, r.nz, r.res, { type: 'circle', x: 16, z: 15, r: 3 })
    expect(j).toBeGreaterThan(14); expect(j).toBeLessThan(15.2)
    expect(d).toBeGreaterThan(9.3); expect(d).toBeLessThan(10.3)
  })
  it('a south-facing slope gets more winter sun than a flat site? never less than flat', () => {
    const slope = computeSunHours({ ...base, occluders: [] })
    const flat = computeSunHours({ ...base, site: { ...site, slopeDeg: 0 }, occluders: [] })
    const a = meanOverShape(slope.hours.dec, slope.nx, slope.nz, slope.res, { type: 'circle', x: 16, z: 15, r: 3 })
    const b = meanOverShape(flat.hours.dec, flat.nx, flat.nz, flat.res, { type: 'circle', x: 16, z: 15, r: 3 })
    expect(a).toBeGreaterThanOrEqual(b - 0.05)
  })
  it('a tall wall shades the ground north of it (shadow falls north in the northern hemisphere), not south', () => {
    const wall: Occluder = { kind: 'box', id: 'w', cx: 16, cz: 15, w: 10, d: 0.3, rot: 0, y0: -5, y1: 20, opacity: 1 }
    const flat = { ...site, slopeDeg: 0 }
    const r = computeSunHours({ ...base, site: flat, occluders: [wall] })
    const north = meanOverShape(r.hours.dec, r.nx, r.nz, r.res, { type: 'circle', x: 16, z: 11, r: 1 })
    const south = meanOverShape(r.hours.dec, r.nx, r.nz, r.res, { type: 'circle', x: 16, z: 19, r: 1 })
    expect(north).toBeLessThan(south - 3)
  })
  it('summer foliage shades more than bare winter canopy', () => {
    const tree: PlacedObject = { id: 't', type: 'walnut', x: 16, z: 10, rotY: 0, scale: 1, params: {}, ageOffset: 15 }
    const t = createTerrain({ ...site, slopeDeg: 0 })
    const mk = (leaf: number) => buildOccluders([tree], { site: { ...site, slopeDeg: 0 }, terrain: t, ageYears: 0, leaf })
    const flat = { ...site, slopeDeg: 0 }
    const leafy = computeSunHours({ ...base, site: flat, occluders: mk(1), dates: [{ id: 'jun', year: 2026, month: 6, day: 21 }] })
    const bare = computeSunHours({ ...base, site: flat, occluders: mk(0), dates: [{ id: 'jun', year: 2026, month: 6, day: 21 }] })
    const s = { type: 'circle' as const, x: 16, z: 6, r: 2 }
    expect(meanOverShape(leafy.hours.jun, leafy.nx, leafy.nz, leafy.res, s)).toBeLessThan(meanOverShape(bare.hours.jun, bare.nx, bare.nz, bare.res, s) - 1)
  })
  it('horizon profile blocks low sun', () => {
    const high = { ...site, slopeDeg: 0, horizon: [{ az: 0, el: 25 }, { az: 180, el: 25 }] }
    const r = computeSunHours({ ...base, site: high, occluders: [], dates: [{ id: 'dec', year: 2026, month: 12, day: 21 }] })
    expect(r.openSky.dec).toBeLessThan(7)
  })
  it('house shades its north side in winter', () => {
    const t = createTerrain({ ...site, slopeDeg: 0 })
    const oc = buildOccluders([], { site: { ...site, slopeDeg: 0 }, terrain: t, ageYears: 0, leaf: 0 })
    const r = computeSunHours({ ...base, site: { ...site, slopeDeg: 0 }, occluders: oc, dates: [{ id: 'dec', year: 2026, month: 12, day: 21 }] })
    const north = meanOverShape(r.hours.dec, r.nx, r.nz, r.res, { type: 'circle', x: 16.5, z: 22, r: 0.8 }) // 1.2 m north of the 5 m cabin
    const open = meanOverShape(r.hours.dec, r.nx, r.nz, r.res, { type: 'circle', x: 16.5, z: 10, r: 0.8 })
    expect(north).toBeLessThan(open - 2)
  })
})
