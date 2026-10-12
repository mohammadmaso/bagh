import { describe, it, expect } from 'vitest'
import { shapesOverlap, shapeDistance, polylineLength, samplePolyline, polygonArea, pointInShape, rotate } from '../src/core/geometry2d'

describe('geometry2d', () => {
  it('circle/circle', () => {
    expect(shapesOverlap({ type: 'circle', x: 0, z: 0, r: 1 }, { type: 'circle', x: 1.5, z: 0, r: 1 })).toBe(true)
    expect(shapesOverlap({ type: 'circle', x: 0, z: 0, r: 1 }, { type: 'circle', x: 2.5, z: 0, r: 1 })).toBe(false)
  })
  it('rect/rect with rotation', () => {
    const a = { type: 'rect' as const, x: 0, z: 0, w: 2, d: 2, rot: 0 }
    expect(shapesOverlap(a, { ...a, x: 1.9 })).toBe(true)
    expect(shapesOverlap(a, { ...a, x: 2.1 })).toBe(false)
    // a 45° rotated square reaches 1.414 from centre
    expect(shapesOverlap(a, { ...a, x: 2.3, rot: Math.PI / 4 })).toBe(true)
    expect(shapesOverlap(a, { ...a, x: 2.5, rot: Math.PI / 4 })).toBe(false)
  })
  it('clearance margin', () => {
    const a = { type: 'rect' as const, x: 0, z: 0, w: 2, d: 2, rot: 0 }
    expect(shapesOverlap(a, { ...a, x: 2.4 }, 0.5)).toBe(true)
    expect(shapesOverlap(a, { ...a, x: 2.6 }, 0.5)).toBe(false)
  })
  it('circle/rect', () => {
    const r = { type: 'rect' as const, x: 0, z: 0, w: 2, d: 2, rot: 0 }
    expect(shapesOverlap(r, { type: 'circle', x: 1.4, z: 0, r: 0.5 })).toBe(true)
    expect(shapesOverlap(r, { type: 'circle', x: 1.6, z: 1.6, r: 0.5 })).toBe(false)
  })
  it('distance', () => {
    expect(shapeDistance({ type: 'circle', x: 0, z: 0, r: 1 }, { type: 'circle', x: 5, z: 0, r: 1 })).toBeCloseTo(3)
    expect(shapeDistance({ type: 'rect', x: 0, z: 0, w: 2, d: 2, rot: 0 }, { type: 'rect', x: 5, z: 0, w: 2, d: 2, rot: 0 })).toBeCloseTo(3, 1)
  })
  it('polyline', () => {
    const pts = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }]
    expect(polylineLength(pts)).toBe(7)
    const s = samplePolyline(pts, 1)
    expect(s.length).toBe(8)
    expect(s[0]).toMatchObject({ x: 0, z: 0 })
    expect(s[7].x).toBeCloseTo(3); expect(s[7].z).toBeCloseTo(4)
  })
  it('area', () => { expect(polygonArea([{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }, { x: 0, z: 3 }])).toBe(12) })
  it('point in rotated rect & rotate matches three rotation.y', () => {
    expect(pointInShape({ type: 'rect', x: 0, z: 0, w: 4, d: 1, rot: Math.PI / 2 }, 0, 1.8)).toBe(true)
    const r = rotate(1, 0, Math.PI / 2) // three: rotation.y=+90° maps +x -> -z
    expect(r.x).toBeCloseTo(0); expect(r.z).toBeCloseTo(-1)
  })
})
