import { describe, it, expect } from 'vitest'
import { sunAt, siteLocalToDate, horizonElevation, seasonOf } from '../src/core/sun'
import { DEFAULT_SITE } from '../src/data/site'

const { lat, lon, tzOffsetMinutes: tz } = DEFAULT_SITE

describe('sun', () => {
  it('summer solstice solar noon elevation ~ 90 - lat + 23.44', () => {
    let best = -90
    for (let m = 600; m < 840; m += 2) {
      const s = sunAt(siteLocalToDate(2026, 6, 21, m, tz), lat, lon)
      best = Math.max(best, s.elevationDeg)
    }
    expect(best).toBeCloseTo(90 - 36.5 + 23.44, 0)
  })
  it('winter solstice noon elevation ~ 90 - lat - 23.44', () => {
    let best = -90
    for (let m = 600; m < 840; m += 2) best = Math.max(best, sunAt(siteLocalToDate(2026, 12, 21, m, tz), lat, lon).elevationDeg)
    expect(best).toBeCloseTo(90 - 36.5 - 23.44, 0)
  })
  it('sun moves east -> south -> west and shadows swing west -> east', () => {
    const am = sunAt(siteLocalToDate(2026, 6, 21, 8 * 60, tz), lat, lon)
    const noon = sunAt(siteLocalToDate(2026, 6, 21, 12 * 60 + 5, tz), lat, lon)
    const pm = sunAt(siteLocalToDate(2026, 6, 21, 17 * 60, tz), lat, lon)
    expect(am.dir[0]).toBeGreaterThan(0.3) // sun to the east (+x)
    expect(pm.dir[0]).toBeLessThan(-0.3) // sun to the west
    expect(noon.dir[2]).toBeGreaterThan(0) // sun to the south (+z)
    expect(Math.abs(noon.azimuthDeg - 180)).toBeLessThan(10)
  })
  it('equinox sunrise is due east-ish', () => {
    const s = sunAt(siteLocalToDate(2026, 3, 21, 6 * 60 + 15, tz), lat, lon)
    expect(s.azimuthDeg).toBeGreaterThan(70)
    expect(s.azimuthDeg).toBeLessThan(110)
  })
  it('horizon interpolation wraps', () => {
    const h = [{ az: 350, el: 10 }, { az: 10, el: 20 }]
    expect(horizonElevation(h, 0)).toBeCloseTo(15, 6)
    expect(horizonElevation(h, 180)).toBeGreaterThanOrEqual(10)
  })
  it('seasons', () => {
    expect(seasonOf(4, 10)).toBe('spring')
    expect(seasonOf(7, 1)).toBe('summer')
    expect(seasonOf(10, 20)).toBe('autumn')
    expect(seasonOf(1, 5)).toBe('winter')
  })
})
