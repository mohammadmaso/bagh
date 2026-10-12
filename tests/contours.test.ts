import { describe, it, expect } from 'vitest'
import { contourLines } from '../src/core/analysis/contours'
import { createTerrain } from '../src/core/terrain'
import { DEFAULT_SITE } from '../src/data/site'

describe('contour lines', () => {
  const t = createTerrain(DEFAULT_SITE)
  it('every segment lies on its level', () => {
    const c = contourLines(t.heightAt, 0, 0, 33, 30, 0.5, 0.5)
    expect(c.length).toBeGreaterThanOrEqual(10) // 5.29 m of relief / 0.5 m
    for (const lv of c) for (const s of lv.segments) { expect(t.heightAt(s[0], s[1])).toBeCloseTo(lv.level, 2); expect(t.heightAt(s[2], s[3])).toBeCloseTo(lv.level, 2) }
  })
  it('marks every 4th level (2 m) as major', () => {
    const c = contourLines(t.heightAt, 0, 0, 33, 30, 0.5, 0.5, 4)
    expect(c.filter((l) => l.major).every((l) => Math.abs(l.level / 2 - Math.round(l.level / 2)) < 1e-9)).toBe(true)
  })
})
