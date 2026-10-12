import type { PlantSpecies } from '../data/plants'

const logistic = (x: number) => 1 / (1 + Math.exp(-x))

/** Normalised growth 0..1 for a plant `age` years after planting (slow establishment, fast juvenile growth, levelling off). */
export function growthFraction(age: number, yearsToMature: number): number {
  if (age <= 0) return 0
  const m = yearsToMature * 0.38
  const w = yearsToMature / 7
  const L = (a: number) => logistic((a - m) / w)
  const lo = L(0)
  const hi = L(yearsToMature * 3)
  return Math.min(1, Math.max(0, (L(age) - lo) / (hi - lo)))
}

export interface PlantSize {
  fraction: number
  height: number
  canopy: number // diameter, m
  trunkHeight: number
  trunkRadius: number
}

export function plantSizeAt(sp: PlantSpecies, age: number): PlantSize {
  const f = growthFraction(age, sp.matureYears)
  const height = sp.h0 + (sp.matureHeight - sp.h0) * f
  const canopy = sp.c0 + (sp.matureCanopy - sp.c0) * f
  const trunkHeight = Math.min(height * 0.8, sp.h0 * 0.55 + (sp.trunkHeight - sp.h0 * 0.55) * f)
  // trunk diameter ~ proportional to height^1.2, ~0.3-0.5 m for mature large trees
  const trunkRadius = Math.max(0.012, sp.trunkRadius * Math.pow(Math.max(f, 0.04), 0.75) + 0.008)
  return { fraction: f, height, canopy, trunkHeight, trunkRadius }
}

/** True when the species is bearing fruit at the given age (years since planting). */
export const bearsFruit = (sp: PlantSpecies, age: number) => !!sp.fruit && age >= sp.yearsToFruit

/** Is a 1-12 month inside a possibly year-wrapping [from,to] range? */
export function inMonths(range: [number, number] | undefined, month: number): boolean {
  if (!range) return false
  const [a, b] = range
  return a <= b ? month >= a && month <= b : month >= a || month <= b
}
