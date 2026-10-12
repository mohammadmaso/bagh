import { describe, it, expect } from 'vitest'
import { calibrateOverlay, overlayToWorld } from '../src/core/imagery'

describe('overlay calibration', () => {
  it('recovers scale, rotation and position from two point pairs', () => {
    const truth = { cx: 20, cz: 12, widthM: 40, rotY: 0.35 }
    const w = 2000, h = 1500
    const a = { u: 300, v: 400 }, b = { u: 1700, v: 1100 }
    const A = overlayToWorld(truth, w, h, a.u, a.v), B = overlayToWorld(truth, w, h, b.u, b.v)
    const c = calibrateOverlay({ w, h, a, b, A, B })
    expect(c.widthM).toBeCloseTo(40, 6)
    expect(c.rotY).toBeCloseTo(0.35, 6)
    expect(c.cx).toBeCloseTo(20, 6); expect(c.cz).toBeCloseTo(12, 6)
    const p = overlayToWorld(c, w, h, 1000, 750)
    expect(p.x).toBeCloseTo(20, 6); expect(p.z).toBeCloseTo(12, 6)
  })
  it('north-up image with two points 10 m apart east-west', () => {
    const c = calibrateOverlay({ w: 1000, h: 1000, a: { u: 100, v: 500 }, b: { u: 600, v: 500 }, A: { x: 5, z: 15 }, B: { x: 15, z: 15 } })
    expect(c.widthM).toBeCloseTo(20, 6)
    expect(c.rotY).toBeCloseTo(0, 6)
  })
})
