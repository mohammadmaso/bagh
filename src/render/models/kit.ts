import * as THREE from 'three'
import { mats } from '../materials'
import type { PlacedObject } from '../../core/project'
import type { BuildCtx } from './index'
import { mulberry32 } from '../../core/noise'

export const M = () => mats()

const boxGeoCache = new Map<string, THREE.BoxGeometry>()
export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
  const key = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`
  let g = boxGeoCache.get(key)
  if (!g) { g = new THREE.BoxGeometry(w, h, d); boxGeoCache.set(key, g) }
  const m = new THREE.Mesh(g, mat)
  m.position.set(x, y, z)
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

export function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 12): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat)
  m.geometry.userData.owned = true
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

export function sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat)
  m.geometry.userData.owned = true
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  m.castShadow = true
  return m
}

export const mat = (color: number | string, rough = 0.8, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal, ...extra })

const matCache = new Map<string, THREE.MeshStandardMaterial>()
export function cmat(color: string, rough = 0.8, metal = 0): THREE.MeshStandardMaterial {
  const k = `${color}|${rough}|${metal}`
  let m = matCache.get(k)
  if (!m) { m = mat(color, rough, metal); matCache.set(k, m) }
  return m
}

/** local (lx,lz) -> world (x,z) for an object, matching three's rotation.y. */
export function toWorld(obj: { x: number; z: number; rotY: number }, lx: number, lz: number) {
  const c = Math.cos(obj.rotY), s = Math.sin(obj.rotY)
  return { x: obj.x + lx * c + lz * s, z: obj.z - lx * s + lz * c }
}

/** terrain height at a local point, relative to the object's anchor ground height. */
export function groundRel(ctx: BuildCtx, obj: PlacedObject, lx: number, lz: number): number {
  const w = toWorld(obj, lx * obj.scale, lz * obj.scale)
  const w0 = ctx.terrain.heightAt(obj.x, obj.z)
  return (ctx.terrain.heightAt(w.x, w.z) - w0) / obj.scale
}

/** min/max ground height (relative) under a rectangle, sampling a coarse grid. */
export function groundRange(ctx: BuildCtx, obj: PlacedObject, w: number, d: number) {
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
    const g = groundRel(ctx, obj, (i / 4 - 0.5) * w, (j / 4 - 0.5) * d)
    lo = Math.min(lo, g); hi = Math.max(hi, g)
  }
  return { lo, hi }
}

/** A rectangle (local coords) draped over the terrain with optional height profile. */
export function drapedRect(ctx: BuildCtx, obj: PlacedObject, w: number, d: number, material: THREE.Material, lift = 0.02, profile?: (lx: number, lz: number) => number, cell = 0.4): THREE.Mesh {
  const nx = Math.max(1, Math.ceil(w / cell)), nz = Math.max(1, Math.ceil(d / cell))
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const lx = (i / nx - 0.5) * w, lz = (j / nz - 0.5) * d
    pos.push(lx, groundRel(ctx, obj, lx, lz) + lift + (profile ? profile(lx, lz) : 0), lz)
    uv.push(lx, lz)
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1
    idx.push(a, c, b, b, c, e)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.userData.owned = true
  const m = new THREE.Mesh(g, material)
  m.receiveShadow = true
  m.castShadow = false
  return m
}

/** Wooden frame boxes that sit level on sloping ground: the bottom reaches down to the lowest corner. */
export function levelBase(ctx: BuildCtx, obj: PlacedObject, w: number, d: number) {
  const r = groundRange(ctx, obj, w, d)
  return { low: r.lo, high: r.hi }
}

export function rng(obj: PlacedObject, salt = 0) {
  let h = salt + 17
  for (let i = 0; i < obj.id.length; i++) h = (h * 31 + obj.id.charCodeAt(i)) | 0
  return mulberry32(h >>> 0)
}

/** add `m` to `g` after applying `f` to it (g.add() returns the group, which makes chained property sets a trap). */
export function A<T extends THREE.Object3D>(g: THREE.Group, m: T, f?: (m: T) => void): T {
  f?.(m)
  g.add(m)
  return m
}

export function group(...kids: THREE.Object3D[]) {
  const g = new THREE.Group()
  for (const k of kids) g.add(k)
  return g
}

export function lathe(profile: [number, number][], material: THREE.Material, seg = 24): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), material)
  m.geometry.userData.owned = true
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Crop clumps (lettuce/cabbage-like rosettes) as one InstancedMesh. Tagged so the season system can hide them in winter. */
export function cropInstances(count: number, w: number, d: number, y: number, rnd: () => number, color = '#5f9a3a', size = 0.11, jitterColors = true): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1, 1)
  geo.userData.owned = true
  const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.75 }), count)
  const o = new THREE.Object3D(), c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const s = size * (0.7 + rnd() * 0.7)
    o.position.set((rnd() - 0.5) * w, y + s * 0.4, (rnd() - 0.5) * d)
    o.scale.set(s, s * (0.55 + rnd() * 0.3), s)
    o.rotation.y = rnd() * 6
    o.updateMatrix()
    m.setMatrixAt(i, o.matrix)
    c.set(color)
    if (jitterColors) c.offsetHSL((rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.12)
    m.setColorAt(i, c)
  }
  m.castShadow = true
  m.userData.seasonal = 'crop'
  return m
}
