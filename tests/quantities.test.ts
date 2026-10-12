import { describe, it, expect } from 'vitest'
import { computeQuantities, siteFenceLength, quantitiesToCSV } from '../src/core/quantities'
import { DEFAULT_SITE } from '../src/data/site'
import { defaultParams, CATALOG_BY_ID } from '../src/data/catalog'
import type { PlacedObject } from '../src/core/project'

const mk = (id: string, type: string, extra: Partial<PlacedObject> = {}): PlacedObject => ({ id, type, x: 5, z: 5, rotY: 0, scale: 1, params: defaultParams(CATALOG_BY_ID[type]), ageOffset: 0, ...extra })

describe('quantities', () => {
  it('site fence = perimeter (126 m) minus gate openings (3 m + 1 m)', () => {
    expect(siteFenceLength(DEFAULT_SITE)).toBeCloseTo(2 * (33 + 30) - 4, 6)
  })
  it('counts, areas, lengths, tank capacity', () => {
    const q = computeQuantities([
      mk('1', 'apple'), mk('2', 'apple'), mk('3', 'raised-bed'), mk('4', 'raised-bed', { params: { length: 3, width: 1, height: 0.4 } }),
      mk('5', 'path-gravel', { points: [{ x: 0, z: 0 }, { x: 3, z: 4 }], params: { width: 1 } }),
      mk('6', 'pipe', { points: [{ x: 0, z: 0 }, { x: 10, z: 0 }] }), mk('7', 'tank-poly', { params: { liters: '5000' } }), mk('8', 'tank-ibc'),
    ], DEFAULT_SITE)
    expect(q.rows.find((r) => r.typeId === 'apple')!.count).toBe(2)
    expect(q.totals.beds).toBe(2)
    expect(q.totals.bedArea).toBeCloseTo(2.4 * 1.2 + 3, 6)
    expect(q.totals.pathLength).toBeCloseTo(5, 6)
    expect(q.totals.pipeLength).toBeCloseTo(10, 6)
    expect(q.totals.tankCapacityL).toBe(6000)
    expect(q.rows.find((r) => r.typeId === 'path-gravel')!.area).toBeCloseTo(5, 6)
  })
  it('CSV escapes and includes the site fence row', () => {
    const q = computeQuantities([mk('1', 'apple')], DEFAULT_SITE)
    const csv = quantitiesToCSV(q, (id) => (id === 'apple' ? 'Apple, "red"' : id), ['Item', 'Category', 'Count', 'Area', 'Length', 'Litres'])
    expect(csv).toContain('"Apple, ""red"""')
    expect(csv).toContain('Site fence')
  })
})
