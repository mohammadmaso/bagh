import { seasonPhase, dayOfYear, type Season } from './sun'
import { smoothstep } from './noise'

export interface SeasonLook {
  doy: number
  /** 0 = bare, 1 = full leaf cover */
  leaf: number
  blossom: number
  autumn: number
  snow: number
  /** multiplicative tint for ground/lawn */
  groundTint: [number, number, number]
}

const REPRESENTATIVE_DOY: Record<Season, number> = { spring: 110, summer: 190, autumn: 300, winter: 20 }

/** Look of the vegetation on a given date, optionally forced to a season. Northern-hemisphere (Iran). */
export function seasonLook(year: number, month: number, day: number, forced: 'auto' | Season, snowOn: boolean): SeasonLook {
  const doy = forced === 'auto' ? dayOfYear(year, month, day) : REPRESENTATIVE_DOY[forced]
  const ph = seasonPhase(doy)
  const leaf = forced === 'winter' ? 0 : ph.leaf
  const autumn = Math.min(1, ph.autumn * 1.4) * smoothstep(0.05, 0.6, leaf)
  const winter = 1 - smoothstep(0.1, 0.9, leaf)
  const dryness = Math.max(autumn * 0.8, winter * 0.9, smoothstep(170, 230, doy) * (1 - smoothstep(250, 290, doy)) * 0.5)
  const spring = ph.blossom * 0.4 + smoothstep(60, 110, doy) * (1 - smoothstep(130, 170, doy)) * 0.5
  const t: [number, number, number] = [
    1 + dryness * 0.38 - spring * 0.05,
    1 - dryness * 0.14 + spring * 0.18,
    1 - dryness * 0.38 - spring * 0.12,
  ]
  const snow = snowOn && winter > 0.5 ? 1 : 0
  return { doy, leaf, blossom: ph.blossom, autumn, snow, groundTint: t }
}
