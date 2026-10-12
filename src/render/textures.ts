import * as THREE from 'three'
import { fbm, mulberry32, valueNoise } from '../core/noise'

/** Procedural, tileable canvas textures. Everything is generated at runtime: no network, no asset files. */

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d', { willReadFrequently: true })!]
}

function finish(c: HTMLCanvasElement, srgb = true, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}

function wrapLine(ctx: CanvasRenderingContext2D, size: number, x0: number, y0: number, x1: number, y1: number) {
  for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
    if (ox && x0 + ox > size + 20 && x0 + ox < -20) continue
    ctx.beginPath(); ctx.moveTo(x0 + ox, y0 + oy); ctx.lineTo(x1 + ox, y1 + oy); ctx.stroke()
  }
}

/** Short lawn: mottled greens with fine blade strokes. */
export function makeGrassTexture(size = 512, base: [number, number, number] = [74, 112, 40], seed = 1): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const img = ctx.createImageData(size, size)
  const P = 8
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size) * P, v = (y / size) * P
    const n = fbm(u, v, 5, seed, P)
    const m = fbm(u * 4, v * 4, 3, seed + 9, P * 4)
    const k = 0.62 + n * 0.55 + (m - 0.5) * 0.35
    const dry = Math.max(0, fbm(u * 0.7, v * 0.7, 3, seed + 5, 5) - 0.55) * 1.6
    const i = (y * size + x) * 4
    img.data[i] = Math.min(255, base[0] * k + dry * 70)
    img.data[i + 1] = Math.min(255, base[1] * k + dry * 30)
    img.data[i + 2] = Math.min(255, base[2] * k)
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const rnd = mulberry32(seed + 100)
  ctx.lineCap = 'round'
  for (let i = 0; i < size * 14; i++) {
    const x = rnd() * size, y = rnd() * size
    const l = 3 + rnd() * 7
    const a = -Math.PI / 2 + (rnd() - 0.5) * 1.3
    const g = rnd()
    ctx.strokeStyle = `rgba(${(base[0] * (0.5 + g * 0.9)) | 0},${(base[1] * (0.6 + g * 0.8)) | 0},${(base[2] * (0.4 + g * 0.7)) | 0},0.45)`
    ctx.lineWidth = 0.6 + rnd() * 0.8
    wrapLine(ctx, size, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l)
  }
  return finish(c)
}

/** Vertical weathered wood siding / planks. */
export function makeWoodTexture(size = 512, base: [number, number, number] = [150, 108, 70], plankCount = 8, seed = 3): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const rnd = mulberry32(seed)
  const pw = size / plankCount
  for (let p = 0; p < plankCount; p++) {
    const tone = 0.82 + rnd() * 0.3
    for (let x = 0; x < pw; x++) {
      for (let y = 0; y < size; y++) {
        const n = fbm((p * 7 + x * 0.11), y * 0.012 + p * 3, 4, seed + p)
        const ring = Math.sin((x / pw) * 12 + n * 9) * 0.5 + 0.5
        const k = tone * (0.78 + n * 0.3 + ring * 0.14)
        ctx.fillStyle = `rgb(${(base[0] * k) | 0},${(base[1] * k) | 0},${(base[2] * k) | 0})`
        ctx.fillRect(p * pw + x, y, 1, 1)
      }
    }
    ctx.fillStyle = 'rgba(20,12,5,0.55)'
    ctx.fillRect(p * pw, 0, 1.5, size)
  }
  return finish(c)
}

/** Standing-seam steel roofing. */
export function makeRoofTexture(size = 512, color: [number, number, number] = [92, 54, 46], seams = 8): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const w = size / seams
  for (let x = 0; x < size; x++) {
    const t = (x % w) / w
    const rib = t < 0.06 || t > 0.94 ? 1.25 : 0.92 + Math.sin(t * Math.PI) * 0.12
    for (let y = 0; y < size; y++) {
      const n = fbm(x * 0.05, y * 0.02, 3, 11, 0)
      const k = rib * (0.88 + n * 0.22)
      ctx.fillStyle = `rgb(${(color[0] * k) | 0},${(color[1] * k) | 0},${(color[2] * k) | 0})`
      ctx.fillRect(x, y, 1, 1)
    }
  }
  return finish(c)
}

/** Chain-link / welded diamond wire mesh with alpha. One tile = 8 diamonds. */
export function makeWireTexture(size = 256): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(190,196,200,1)'
  ctx.lineWidth = size / 42
  const n = 4
  const s = size / n
  ctx.beginPath()
  for (let i = -n; i <= 2 * n; i++) {
    ctx.moveTo(i * s, 0); ctx.lineTo(i * s + size, size)
    ctx.moveTo(i * s, size); ctx.lineTo(i * s + size, 0)
  }
  ctx.stroke()
  return finish(c, true)
}

export function makeNoiseTexture(size = 256, seed = 7): THREE.DataTexture {
  const d = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4
    d[i] = valueNoise((x / size) * 16, (y / size) * 16, seed, 16) * 255
    d[i + 1] = fbm((x / size) * 8, (y / size) * 8, 4, seed + 1, 8) * 255
    d[i + 2] = fbm((x / size) * 32, (y / size) * 32, 3, seed + 2, 32) * 255
    d[i + 3] = 255
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.magFilter = t.minFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/** Gravel / stone path texture. */
export function makeGravelTexture(size = 256, base: [number, number, number] = [150, 140, 125], seed = 5): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  ctx.fillStyle = `rgb(${base.join(',')})`
  ctx.fillRect(0, 0, size, size)
  const rnd = mulberry32(seed)
  for (let i = 0; i < size * 6; i++) {
    const x = rnd() * size, y = rnd() * size, r = 0.8 + rnd() * 2.6
    const k = 0.6 + rnd() * 0.7
    ctx.fillStyle = `rgb(${(base[0] * k) | 0},${(base[1] * k) | 0},${(base[2] * k * (0.95 + rnd() * 0.1)) | 0})`
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      ctx.beginPath(); ctx.ellipse(x + ox, y + oy, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, Math.PI * 2); ctx.fill()
    }
  }
  return finish(c)
}

export function makeBarkTexture(size = 256, base: [number, number, number] = [92, 70, 52], seed = 9): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm((x / size) * 12, (y / size) * 2.2, 4, seed, 0)
    const ridge = Math.abs(Math.sin((x / size) * 28 + n * 6)) * 0.5
    const k = 0.55 + n * 0.5 + ridge * 0.5
    const i = (y * size + x) * 4
    img.data[i] = base[0] * k; img.data[i + 1] = base[1] * k; img.data[i + 2] = base[2] * k; img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return finish(c)
}

/** Irregular flagstone paving. */
export function makePavingTexture(size = 512, seed = 21): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  ctx.fillStyle = '#6b665c'; ctx.fillRect(0, 0, size, size)
  const rnd = mulberry32(seed)
  const cells = 7
  const pts: [number, number][] = []
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) pts.push([(i + 0.15 + rnd() * 0.7) * (size / cells), (j + 0.15 + rnd() * 0.7) * (size / cells)])
  const img = ctx.getImageData(0, 0, size, size)
  const tone = pts.map(() => 0.8 + rnd() * 0.35)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let d1 = 1e9, d2 = 1e9, k = 0
    for (let n = 0; n < pts.length; n++) for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) {
      const dx = pts[n][0] + ox - x, dy = pts[n][1] + oy - y
      if (Math.abs(dx) > 120 || Math.abs(dy) > 120) continue
      const d = dx * dx + dy * dy
      if (d < d1) { d2 = d1; d1 = d; k = n } else if (d < d2) d2 = d
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1)
    const i = (y * size + x) * 4
    const g = edge < 3.5 ? 0.45 : tone[k] * (0.85 + fbm(x * 0.05, y * 0.05, 3, 3, 0) * 0.3)
    img.data[i] = 150 * g; img.data[i + 1] = 146 * g; img.data[i + 2] = 136 * g; img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return finish(c)
}

export function makeMulchTexture(size = 256, seed = 31): THREE.CanvasTexture {
  const [c, ctx] = canvas(size)
  ctx.fillStyle = '#4b3524'; ctx.fillRect(0, 0, size, size)
  const rnd = mulberry32(seed)
  for (let i = 0; i < size * 8; i++) {
    const x = rnd() * size, y = rnd() * size, l = 3 + rnd() * 9, a = rnd() * 3.14
    const k = 0.55 + rnd() * 0.8
    ctx.strokeStyle = `rgb(${(95 * k) | 0},${(66 * k) | 0},${(44 * k) | 0})`; ctx.lineWidth = 1 + rnd() * 1.5
    wrapLine(ctx, size, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l)
  }
  return finish(c)
}
