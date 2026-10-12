import { describe, it, expect } from 'vitest'
import { evaluateRules, frontBearing } from '../src/core/rules'
import { createTerrain } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'
import type { PlacedObject } from '../src/core/project'
import { defaultParams, CATALOG_BY_ID } from '../src/data/catalog'

const terrain = createTerrain(DEFAULT_SITE)
const mk = (id: string, type: string, x: number, z: number, extra: Partial<PlacedObject> = {}): PlacedObject => ({ id, type, x, z, rotY: 0, scale: 1, params: defaultParams(CATALOG_BY_ID[type]), ageOffset: 0, ...extra })
const run = (objects: PlacedObject[], cfg?: any) => evaluateRules({ site: DEFAULT_SITE, terrain, objects }, cfg)
const ids = (v: ReturnType<typeof run>, rule: string) => v.filter((x) => x.ruleId === rule)

describe('rules engine', () => {
  it('front bearing: rotY 0 faces south (180°), +90° rotation faces west (270°)', () => {
    expect(frontBearing(0)).toBeCloseTo(180, 6)
    expect(frontBearing(Math.PI / 2)).toBeCloseTo(90, 6) // three: +x -> -z; front (+z) becomes +x = east
  })
  it('canopy overlap at mature size', () => {
    const v = run([mk('a', 'apple', 10, 10), mk('b', 'apple', 12, 10), mk('c', 'apple', 22, 10)])
    expect(ids(v, 'canopyOverlap')).toHaveLength(1)
    expect(ids(v, 'canopyOverlap')[0].objectIds.sort()).toEqual(['a', 'b'])
  })
  it('tree too close to fence and to the house', () => {
    const v = run([mk('w', 'walnut', 2, 8), mk('h', 'apple', 16.5, 20.5)])
    expect(ids(v, 'treeFence').map((x) => x.objectIds[0])).toContain('w')
    expect(ids(v, 'treeHouse').map((x) => x.objectIds[0])).toContain('h')
  })
  it('walnut within 10 m of a vegetable bed is an error (juglone), configurable', () => {
    const objs = [mk('w', 'walnut', 10, 8), mk('b', 'raised-bed', 16, 8)]
    const v = run(objs)
    expect(ids(v, 'juglone')).toHaveLength(1)
    expect(ids(v, 'juglone')[0].severity).toBe('error')
    expect(ids(run(objs, { juglone: { params: { distance: 3 } } }), 'juglone')).toHaveLength(0)
    expect(ids(run(objs, { juglone: { enabled: false } }), 'juglone')).toHaveLength(0)
  })
  it('hive entrance should face south-east', () => {
    const north = mk('h1', 'hive-langstroth', 10, 10, { rotY: Math.PI }) // faces north (0°)
    const se = mk('h2', 'hive-langstroth', 20, 10, { rotY: Math.atan2(Math.sin((135 * Math.PI) / 180) , 0) })
    void se
    const good = mk('h3', 'hive-langstroth', 20, 10, { rotY: (45 * Math.PI) / 180 }) // front bearing = atan2(sin45, -cos45) = 135°
    expect(frontBearing(good.rotY)).toBeCloseTo(135, 3)
    const v = run([north, good])
    expect(ids(v, 'hiveFacing').map((x) => x.objectIds[0])).toEqual(['h1'])
  })
  it('hive needs 5 m from path/boundary unless a ≥2 m flight barrier is in front within 3 m', () => {
    const hive = mk('h', 'hive-langstroth', 10, 10, { rotY: (45 * Math.PI) / 180 })
    const path = mk('p', 'path-gravel', 0, 0, { points: [{ x: 7, z: 5 }, { x: 7, z: 15 }] })
    expect(ids(run([hive, path]), 'hiveClearance').length).toBeGreaterThan(0)
    // barrier in front (front vector = (sin45, cos45) -> south-east)
    const barrier = mk('b', 'flight-barrier', 0, 0, { points: [{ x: 11, z: 12.5 }, { x: 13, z: 10.5 }, { x: 13, z: 8 }], params: { height: 2.2 } })
    expect(ids(run([hive, path, barrier]), 'hiveClearance')).toHaveLength(0)
    // too-short barrier does not count
    const low = { ...barrier, params: { height: 1 } }
    expect(ids(run([hive, path, low]), 'hiveClearance').length).toBeGreaterThan(0)
  })
  it('hive needs a water source within 50 m', () => {
    const hive = mk('h', 'hive-langstroth', 5, 5)
    expect(ids(run([hive]), 'hiveWater')).toHaveLength(1)
    expect(ids(run([hive, mk('t', 'tap', 20, 20)]), 'hiveWater')).toHaveLength(0)
  })
  it('livestock uphill of a well is an error; downhill is fine (slope-aware)', () => {
    const coopUp = mk('c', 'chicken-coop', 16, 8) // north = uphill
    const well = mk('w', 'well', 16, 16)
    expect(ids(run([coopUp, well]), 'runoff')[0]?.severity).toBe('error')
    const coopDown = mk('c', 'chicken-coop', 16, 24)
    const well2 = mk('w', 'well', 16, 16)
    expect(ids(run([coopDown, well2]), 'runoff')).toHaveLength(0)
    // side-by-side across the slope is not "uphill"
    expect(ids(run([mk('c', 'chicken-coop', 6, 16), mk('w', 'well', 16, 16)]), 'runoff')).toHaveLength(0)
  })
  it('tall tree south of a bed shades it; north of the bed is fine', () => {
    const bed = mk('b', 'raised-bed', 16, 12)
    expect(ids(run([bed, mk('t', 'walnut', 16, 16)]), 'treeShadesBed')).toHaveLength(1)
    expect(ids(run([bed, mk('t', 'walnut', 16, 6)]), 'treeShadesBed')).toHaveLength(0)
  })
  it('path slope grading', () => {
    const steep = mk('p', 'path-gravel', 0, 0, { points: [{ x: 10, z: 5 }, { x: 10, z: 15 }] }) // straight downhill = 17.6 %
    const v = ids(run([steep]), 'pathLimits')
    expect(v.some((x) => x.vars.kind === 'slope' && x.severity === 'warning')).toBe(true)
    const across = mk('p', 'path-gravel', 0, 0, { points: [{ x: 5, z: 10 }, { x: 25, z: 10 }] })
    expect(ids(run([across]), 'pathLimits').filter((x) => x.vars.kind === 'slope')).toHaveLength(0)
    const narrow = mk('p', 'path-gravel', 0, 0, { points: [{ x: 5, z: 10 }, { x: 25, z: 10 }], params: { width: 0.6 } })
    expect(ids(run([narrow]), 'pathLimits').some((x) => x.vars.kind === 'width')).toBe(true)
  })
  it('coop clearance from beds and boundary', () => {
    const v = run([mk('c', 'chicken-coop', 20, 15), mk('b', 'raised-bed', 20, 18)])
    expect(ids(v, 'coopClearance').some((x) => x.vars.what === 'bed')).toBe(true)
    const v2 = run([mk('c', 'chicken-coop', 30.5, 15)])
    expect(ids(v2, 'coopClearance').some((x) => x.vars.what === 'boundary')).toBe(true)
  })
  it('frost pocket: none on a steady slope, appears when the bottom is flat', () => {
    const peach = mk('p', 'peach', 10, 29)
    expect(ids(run([peach]), 'frostPocket')).toHaveLength(0)
    const flat = createTerrain({ ...DEFAULT_SITE, slopeDeg: 2 })
    const v = evaluateRules({ site: { ...DEFAULT_SITE, slopeDeg: 2 }, terrain: flat, objects: [peach] })
    expect(ids(v, 'frostPocket')).toHaveLength(1)
  })
  it('bed sun rule uses the analysis grid', () => {
    const bed = mk('b', 'raised-bed', 10, 10)
    const grid = { nx: 66, nz: 60, res: 0.5, hours: new Float32Array(66 * 60).fill(3) }
    const v = evaluateRules({ site: DEFAULT_SITE, terrain, objects: [bed], growingSun: grid })
    expect(ids(v, 'bedSun')).toHaveLength(1)
    grid.hours.fill(8)
    expect(ids(evaluateRules({ site: DEFAULT_SITE, terrain, objects: [bed], growingSun: grid }), 'bedSun')).toHaveLength(0)
  })
})

describe('rules on levelled pads', () => {
  it('runoff rule uses natural ground, so a coop on a flat pad still counts as uphill', () => {
    const coop = mk('c', 'chicken-coop', 16, 8)
    const well = mk('w', 'well', 16, 16)
    const padded = createTerrain(DEFAULT_SITE, null, [{ id: 'c', cx: 16, cz: 8, w: 6, d: 4, rotY: 0, level: terrain.baseHeightAt(16, 8), margin: 1 }, { id: 'w', cx: 16, cz: 16, w: 2, d: 2, rotY: 0, level: terrain.baseHeightAt(16, 16), margin: 1 }])
    const v = evaluateRules({ site: DEFAULT_SITE, terrain: padded, objects: [coop, well] })
    expect(v.filter((x) => x.ruleId === 'runoff')).toHaveLength(1)
  })
})
