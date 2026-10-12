import { describe, it, expect } from 'vitest'
import { computeCollisions, collidesWithAny, insidePlot } from '../src/core/collision'
import { snapPosition } from '../src/core/snap'
import { DEFAULT_SITE } from '../src/data/site'
import type { PlacedObject } from '../src/core/project'

const mk = (id: string, type: string, x: number, z: number, extra: Partial<PlacedObject> = {}): PlacedObject => ({ id, type, x, z, rotY: 0, scale: 1, params: { length: 2.4, width: 1.2, height: 0.4 }, ageOffset: 0, ...extra })

describe('collisions', () => {
  it('detects overlapping beds, ignores separated ones', () => {
    const a = mk('a', 'raised-bed', 5, 5), b = mk('b', 'raised-bed', 6, 5), c = mk('c', 'raised-bed', 12, 5)
    const col = computeCollisions([a, b, c], DEFAULT_SITE)
    expect(col.filter((x) => x.kind === 'object').map((x) => x.id).sort()).toEqual(['a', 'b'])
  })
  it('flags objects outside the plot and on the house', () => {
    const out = mk('o', 'raised-bed', 0.2, 5)
    expect(computeCollisions([out], DEFAULT_SITE).some((c) => c.kind === 'outside')).toBe(true)
    const onHouse = mk('h', 'raised-bed', 16.5, 26)
    expect(computeCollisions([onHouse], DEFAULT_SITE).some((c) => c.kind === 'house')).toBe(true)
  })
  it('collidesWithAny respects other objects', () => {
    const a = mk('a', 'raised-bed', 5, 5)
    expect(collidesWithAny(mk('n', 'raised-bed', 5.5, 5), [a], DEFAULT_SITE)).toBe(true)
    expect(collidesWithAny(mk('n', 'raised-bed', 10, 5), [a], DEFAULT_SITE)).toBe(false)
  })
  it('inside plot', () => {
    expect(insidePlot({ type: 'circle', x: 10, z: 10, r: 1 }, DEFAULT_SITE)).toBe(true)
    expect(insidePlot({ type: 'circle', x: 0.5, z: 10, r: 1 }, DEFAULT_SITE)).toBe(false)
  })
})

describe('snapping', () => {
  it('grid snap', () => {
    const o = mk('a', 'raised-bed', 0, 0)
    const r = snapPosition(o, 10.13, 9.9, [], DEFAULT_SITE, { grid: 0.5, edges: false })
    expect(r).toEqual({ x: 10, z: 10 })
  })
  it('snaps flush to the fence', () => {
    const o = mk('a', 'raised-bed', 0, 0)
    const r = snapPosition(o, 1.5, 10, [], DEFAULT_SITE, { grid: 0.5, edges: true })
    expect(r.x - 1.2).toBeCloseTo(0.2, 6) // west edge of the 2.4 m bed 0.2 m inside the fence
  })
  it('aligns edge to a neighbour', () => {
    const other = mk('b', 'raised-bed', 10, 10)
    const o = mk('a', 'raised-bed', 0, 0)
    const r = snapPosition(o, 12.5, 10.1, [other], DEFAULT_SITE, { grid: 0, edges: true })
    expect(r.x).toBeCloseTo(12.4, 6) // abuts east edge of neighbour (11.2) + half width 1.2
    expect(r.z).toBeCloseTo(10, 6)
  })
})
