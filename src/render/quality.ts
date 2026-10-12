import type { Quality } from '../store/store'

export interface QualitySettings {
  shadowMap: number
  ao: boolean
  aoSamples: number
  msaa: number
  smaa: boolean
  pixelRatioMax: number
  grassDensity: number // blades per m2 near camera
  grassRadius: number
  treeDetail: number // 0..1
  postprocessing: boolean
}

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { shadowMap: 1024, ao: false, aoSamples: 0, msaa: 0, smaa: false, pixelRatioMax: 1, grassDensity: 0, grassRadius: 0, treeDetail: 0.3, postprocessing: false },
  medium: { shadowMap: 2048, ao: true, aoSamples: 9, msaa: 0, smaa: true, pixelRatioMax: 1.5, grassDensity: 120, grassRadius: 22, treeDetail: 0.6, postprocessing: true },
  high: { shadowMap: 4096, ao: true, aoSamples: 13, msaa: 4, smaa: false, pixelRatioMax: 2, grassDensity: 260, grassRadius: 32, treeDetail: 0.85, postprocessing: true },
  ultra: { shadowMap: 4096, ao: true, aoSamples: 21, msaa: 8, smaa: false, pixelRatioMax: 2, grassDensity: 450, grassRadius: 42, treeDetail: 1, postprocessing: true },
}
