import { getPosition } from 'suncalc'
import type { HorizonPoint } from './types'

export interface SunState {
  /** compass bearing of the sun, degrees clockwise from north */
  azimuthDeg: number
  elevationDeg: number
  /** unit vector pointing FROM the ground TOWARD the sun, local frame (x east, y up, z south) */
  dir: [number, number, number]
}

export function sunAt(date: Date, lat: number, lon: number): SunState {
  const p = getPosition(date, lat, lon)
  // suncalc v2: azimuth is a compass bearing (0 = N, clockwise) and altitude is apparent elevation, both in degrees
  const az = p.azimuth
  const el = p.altitude
  return { azimuthDeg: az, elevationDeg: el, dir: dirFromAzEl(az, el) }
}

export function dirFromAzEl(azDeg: number, elDeg: number): [number, number, number] {
  const a = (azDeg * Math.PI) / 180
  const e = (elDeg * Math.PI) / 180
  const ce = Math.cos(e)
  return [Math.sin(a) * ce, Math.sin(e), -Math.cos(a) * ce]
}

/** Convert a local wall-clock time at the site (fixed UTC offset, no DST) to a UTC Date. */
export function siteLocalToDate(year: number, month1: number, day: number, minutesOfDay: number, tzOffsetMinutes: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day, 0, minutesOfDay - tzOffsetMinutes, 0))
}

export function dayOfYear(year: number, month1: number, day: number): number {
  return Math.round((Date.UTC(year, month1 - 1, day) - Date.UTC(year, 0, 0)) / 86400000)
}

/** Elevation of the horizon at a compass azimuth (piecewise linear, wrapping). */
export function horizonElevation(profile: HorizonPoint[], azDeg: number): number {
  if (profile.length === 0) return 0
  if (profile.length === 1) return profile[0].el
  const pts = [...profile].sort((a, b) => a.az - b.az)
  const az = ((azDeg % 360) + 360) % 360
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const span = ((b.az - a.az + 360) % 360) || 360
    const off = (az - a.az + 360) % 360
    if (off <= span) return a.el + (b.el - a.el) * (off / span)
  }
  return pts[0].el
}

export interface SunSample { minutes: number; az: number; el: number; dir: [number, number, number] }

/** Sun positions across a local day at a fixed step; only samples above the geometric horizon are returned. */
export function sunDaySamples(year: number, month1: number, day: number, lat: number, lon: number, tz: number, stepMin = 10): SunSample[] {
  const out: SunSample[] = []
  for (let m = 0; m < 1440; m += stepMin) {
    const s = sunAt(siteLocalToDate(year, month1, day, m + stepMin / 2, tz), lat, lon)
    if (s.elevationDeg > 0) out.push({ minutes: m + stepMin / 2, az: s.azimuthDeg, el: s.elevationDeg, dir: s.dir })
  }
  return out
}

/** Key solar dates for presets. */
export const SOLAR_PRESETS = {
  springEquinox: { month: 3, day: 21 },
  summerSolstice: { month: 6, day: 21 },
  autumnEquinox: { month: 9, day: 22 },
  winterSolstice: { month: 12, day: 21 },
} as const

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** Meteorological-ish season for the northern hemisphere, with Iranian-friendly boundaries (equinox/solstice). */
export function seasonOf(month1: number, day: number): Season {
  const v = month1 * 100 + day
  if (v >= 321 && v < 621) return 'spring'
  if (v >= 621 && v < 922) return 'summer'
  if (v >= 922 && v < 1221) return 'autumn'
  return 'winter'
}

/** 0..1 blend values for seasonal looks (leaf cover, blossom, autumn colour). */
export function seasonPhase(doy: number) {
  const bell = (c: number, w: number) => Math.exp(-Math.pow(((doy - c + 183 + 365) % 365) - 183, 2) / (2 * w * w))
  return {
    blossom: bell(105, 12), // mid-April
    leaf: Math.max(0, Math.min(1, smooth(doy, 100, 135) - smooth(doy, 295, 330))),
    autumn: bell(300, 18) * 1,
    snow: bell(20, 25),
  }
}
function smooth(x: number, a: number, b: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
