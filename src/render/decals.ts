import * as THREE from 'three'
import type { Shape } from '../core/geometry2d'
import { rectCorners } from '../core/geometry2d'
import type { Terrain } from '../core/terrain'

const dc = new Map<string, THREE.MeshBasicMaterial>()
export function decalMat(color: string, opacity = 1): THREE.MeshBasicMaterial {
  const k = color + opacity
  let m = dc.get(k)
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide, toneMapped: false })
    dc.set(k, m)
  }
  return m
}

/** Dense outline points for a shape, resampled so the outline can drape over terrain. */
function outlinePoints(s: Shape, step = 0.3): { x: number; z: number }[] {
  if (s.type === 'circle') {
    const n = Math.max(24, Math.ceil((2 * Math.PI * s.r) / step))
    return Array.from({ length: n }, (_, i) => ({ x: s.x + Math.cos((i / n) * Math.PI * 2) * s.r, z: s.z + Math.sin((i / n) * Math.PI * 2) * s.r }))
  }
  const c = rectCorners(s)
  const out: { x: number; z: number }[] = []
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step))
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })
  }
  return out
}

/** Draped outline ring (thick line) hugging the terrain. */
export function outlineDecal(s: Shape, t: Terrain, color: string, width = 0.07, lift = 0.07): THREE.Mesh {
  const pts = outlinePoints(s)
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cz = pts.reduce((a, p) => a + p.z, 0) / pts.length
  const pos: number[] = [], idx: number[] = []
  pts.forEach((p) => {
    const dx = p.x - cx, dz = p.z - cz, l = Math.hypot(dx, dz) || 1
    const nx = dx / l, nz = dz / l
    for (const o of [-width / 2, width / 2]) { const x = p.x + nx * o, z = p.z + nz * o; pos.push(x, t.heightAt(x, z) + lift, z) }
  })
  const n = pts.length
  for (let i = 0; i < n; i++) { const a = i * 2, b = ((i + 1) % n) * 2; idx.push(a, a + 1, b, b, a + 1, b + 1) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx)
  const m = new THREE.Mesh(g, decalMat(color))
  m.renderOrder = 10
  return m
}

/** Filled translucent decal draped over the terrain. */
export function fillDecal(s: Shape, t: Terrain, color: string, opacity = 0.35, lift = 0.06): THREE.Mesh {
  const pts = outlinePoints(s, 0.5)
  const cx = s.x, cz = s.z
  const pos: number[] = [cx, t.heightAt(cx, cz) + lift, cz], idx: number[] = []
  pts.forEach((p) => pos.push(p.x, t.heightAt(p.x, p.z) + lift, p.z))
  for (let i = 0; i < pts.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % pts.length))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx)
  const m = new THREE.Mesh(g, decalMat(color, opacity))
  m.renderOrder = 9
  return m
}

/** Draped polyline strip. */
export function lineDecal(pts: { x: number; z: number }[], t: Terrain, color: string, width = 0.12, lift = 0.1): THREE.Mesh {
  const pos: number[] = [], idx: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
    let tx = b.x - a.x, tz = b.z - a.z
    const l = Math.hypot(tx, tz) || 1
    tx /= l; tz /= l
    for (const o of [-width / 2, width / 2]) { const x = pts[i].x - tz * o, z = pts[i].z + tx * o; pos.push(x, t.heightAt(x, z) + lift, z) }
    if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx)
  const m = new THREE.Mesh(g, decalMat(color))
  m.renderOrder = 10
  return m
}

export function dotMarker(x: number, z: number, t: Terrain, color: string, r = 0.18): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, toneMapped: false }))
  m.position.set(x, t.heightAt(x, z) + r, z)
  m.renderOrder = 20
  return m
}

/** Draped circular sector (hive flight cone): apex (x,z), heading `dir` (rad, three rotation.y convention: front = (sin, cos)). */
export function wedgeDecal(x: number, z: number, dir: number, halfAngle: number, radius: number, t: Terrain, color: string, opacity = 0.3, lift = 0.07): THREE.Mesh {
  const n = 28
  const pos: number[] = [x, t.heightAt(x, z) + lift, z], idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const a = dir - halfAngle + (2 * halfAngle * i) / n
    // subdivide the radius so the fan drapes on slopes
    const px = x + Math.sin(a) * radius, pz = z + Math.cos(a) * radius
    pos.push(px, t.heightAt(px, pz) + lift, pz)
  }
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 2 + i)
  // mid ring for better draping
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx)
  const m = new THREE.Mesh(g, decalMat(color, opacity))
  m.renderOrder = 8
  return m
}
