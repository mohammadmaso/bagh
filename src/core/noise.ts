/** Small deterministic noise helpers (pure; used by procedural textures and geometry). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

/** value noise in [0,1]; optional integer `period` makes it tile. */
export function valueNoise(x: number, z: number, seed = 0, period = 0): number {
  const x0 = Math.floor(x), z0 = Math.floor(z)
  const fx = fade(x - x0), fz = fade(z - z0)
  const w = (v: number) => (period ? ((v % period) + period) % period : v)
  const a = hash2(w(x0), w(z0), seed), b = hash2(w(x0 + 1), w(z0), seed)
  const c = hash2(w(x0), w(z0 + 1), seed), d = hash2(w(x0 + 1), w(z0 + 1), seed)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}

export function fbm(x: number, z: number, octaves = 4, seed = 0, period = 0): number {
  let amp = 0.5, f = 1, sum = 0, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, z * f, seed + i * 17, period ? period * f : 0)
    norm += amp
    amp *= 0.5
    f *= 2
  }
  return sum / norm
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
