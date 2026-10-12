export interface ContourLevel { level: number; major: boolean; segments: [number, number, number, number][] }

/** Marching-squares contour lines of a height function over a rectangle. Pure; used by the PDF plan. */
export function contourLines(h: (x: number, z: number) => number, x0: number, z0: number, x1: number, z1: number, res: number, interval: number, majorEvery = 4): ContourLevel[] {
  const nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res)
  const g = new Float32Array((nx + 1) * (nz + 1))
  let lo = Infinity, hi = -Infinity
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const v = h(x0 + i * res, z0 + j * res); g[j * (nx + 1) + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v) }
  const out: ContourLevel[] = []
  const first = Math.ceil(lo / interval), last = Math.floor(hi / interval)
  for (let k = first; k <= last; k++) {
    const level = k * interval
    const segs: [number, number, number, number][] = []
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = g[j * (nx + 1) + i], b = g[j * (nx + 1) + i + 1], c = g[(j + 1) * (nx + 1) + i + 1], d = g[(j + 1) * (nx + 1) + i]
      const idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0)
      if (idx === 0 || idx === 15) continue
      const X = x0 + i * res, Z = z0 + j * res
      const lerp = (p: number, q: number) => (level - p) / (q - p)
      const top: [number, number] = [X + lerp(a, b) * res, Z]
      const right: [number, number] = [X + res, Z + lerp(b, c) * res]
      const bottom: [number, number] = [X + lerp(d, c) * res, Z + res]
      const left: [number, number] = [X, Z + lerp(a, d) * res]
      const add = (p: [number, number], q: [number, number]) => segs.push([p[0], p[1], q[0], q[1]])
      switch (idx) {
        case 1: case 14: add(left, top); break
        case 2: case 13: add(top, right); break
        case 3: case 12: add(left, right); break
        case 4: case 11: add(right, bottom); break
        case 5: add(left, top); add(right, bottom); break
        case 6: case 9: add(top, bottom); break
        case 7: case 8: add(left, bottom); break
        case 10: add(top, right); add(left, bottom); break
      }
    }
    if (segs.length) out.push({ level, major: k % majorEvery === 0, segments: segs })
  }
  return out
}
