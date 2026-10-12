import * as THREE from 'three'
import type { PlacedObject } from '../../core/project'
import type { CatalogItem } from '../../data/catalog'
import type { Terrain } from '../../core/terrain'
import { samplePolyline } from '../../core/geometry2d'
import { M, cmat, box } from './kit'
import { makePavingTexture, makeMulchTexture, makeGrassTexture } from '../textures'
import { appendTube, appendQuad, newBuf, toGeometry } from './geomUtil'
import { getPlantMaterials } from './plantMaterials'
import { PLANTS } from '../../data/plants'
import { mulberry32 } from '../../core/noise'

const P = (o: PlacedObject, k: string, d: number) => (typeof o.params[k] === 'number' ? (o.params[k] as number) : d)

const texCache = new Map<string, THREE.MeshStandardMaterial>()
function pathMaterial(kind: string): THREE.MeshStandardMaterial {
  let m = texCache.get(kind)
  if (m) return m
  const rep = (t: THREE.Texture, r: number) => { const c = t.clone(); c.repeat.set(r, r); c.needsUpdate = true; return c }
  switch (kind) {
    case 'stone': m = new THREE.MeshStandardMaterial({ map: rep(makePavingTexture(512), 1 / 1.2), roughness: 0.9 }); break
    case 'mulch': m = new THREE.MeshStandardMaterial({ map: rep(makeMulchTexture(256), 1 / 0.9), roughness: 1 }); break
    case 'grass': m = new THREE.MeshStandardMaterial({ map: rep(makeGrassTexture(256, [96, 138, 52], 77), 1 / 1.6), roughness: 1 }); break
    case 'swale': m = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }); break
    default: m = M().gravel.clone()
  }
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2
  texCache.set(kind, m)
  return m
}

/** Draped ribbon along a polyline. uv.x = across (0..1), uv.y = metres along. */
function ribbon(pts: { x: number; z: number }[], width: number, terrain: Terrain, lift: number, step = 0.45) {
  const s = samplePolyline(pts, step)
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  let along = 0
  for (let i = 0; i < s.length; i++) {
    // averaged tangent for smooth corners
    const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)]
    let tx = b.x - a.x, tz = b.z - a.z
    const l = Math.hypot(tx, tz) || 1
    tx /= l; tz /= l
    const nx = -tz, nz = tx
    if (i > 0) along += Math.hypot(s[i].x - s[i - 1].x, s[i].z - s[i - 1].z)
    for (const side of [-1, 0, 1]) {
      const x = s[i].x + nx * side * width / 2, z = s[i].z + nz * side * width / 2
      pos.push(x, terrain.heightAt(x, z) + lift, z)
      uv.push((side + 1) / 2, along)
    }
  }
  for (let i = 0; i < s.length - 1; i++) for (let k = 0; k < 2; k++) {
    const a = i * 3 + k, b = a + 1, c = a + 3, d = c + 1
    idx.push(a, b, c, b, d, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.userData.owned = true
  return { geo: g, samples: s }
}

export function buildPolylineModel(item: CatalogItem, obj: PlacedObject, terrain: Terrain): THREE.Object3D {
  const g = new THREE.Group()
  const pts = obj.points ?? []
  if (pts.length < 2) return g
  const width = P(obj, 'width', item.polyline?.width ?? 1)
  const mat = item.polyline?.material ?? 'gravel'
  switch (item.model) {
    case 'path': {
      const { geo } = ribbon(pts, width, terrain, 0.035)
      // wider-than-uv: map UV so texture repeats metrically (uv.x spans width)
      const uv = geo.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * width)
      const m = new THREE.Mesh(geo, pathMaterial(mat))
      m.receiveShadow = true
      g.add(m)
      break
    }
    case 'swale': {
      const { geo } = ribbon(pts, width * 0.9, terrain, 0.015)
      const m = new THREE.Mesh(geo, pathMaterial('swale')); m.receiveShadow = true
      g.add(m)
      break
    }
    case 'pipe': {
      const s = samplePolyline(pts, 0.5)
      const pp = s.map((p) => new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z) + width / 2 + 0.01, p.z))
      const buf = newBuf()
      appendTube(buf, pp, pp.map(() => width / 2), 6, 1)
      const col = mat === 'drip' ? '#1d1d1f' : '#2d6fb0'
      const m = new THREE.Mesh(toGeometry(buf), cmat(col, 0.5)); m.geometry.userData.owned = true; m.castShadow = true
      g.add(m)
      if (mat === 'drip') {
        const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 6, 4), cmat('#c0392b'), pp.length * 2)
        dots.geometry.userData.owned = true
        const o = new THREE.Object3D()
        pp.forEach((p, i) => { o.position.set(p.x, p.y + 0.02, p.z); o.updateMatrix(); dots.setMatrixAt(i, o.matrix) })
        dots.count = pp.length
        g.add(dots)
      }
      break
    }
    case 'retaining-wall': {
      const H = P(obj, 'height', item.meta?.wallHeight as number ?? 0.8)
      const s = samplePolyline(pts, 0.5)
      const stone = M().stone
      for (let i = 0; i < s.length - 1; i++) {
        const a = s[i], b = s[i + 1]
        const dx = b.x - a.x, dz = b.z - a.z
        const len = Math.hypot(dx, dz)
        if (len < 1e-3) continue
        const nx = -dz / len, nz = dx / len
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2
        const grounds = [1, -1].map((sd) => terrain.heightAt(mx + nx * sd * 0.6, mz + nz * sd * 0.6))
        const low = Math.min(...grounds, terrain.heightAt(mx, mz))
        const top = low + H
        const bottom = low - 0.25
        const m = box(len + 0.02, top - bottom, width, stone, 0, 0, 0)
        m.position.set(mx, (top + bottom) / 2, mz)
        m.rotation.y = -Math.atan2(dz, dx)
        g.add(m)
        const cap = box(len + 0.04, 0.06, width + 0.08, cmat('#9a948a', 0.9), 0, 0, 0)
        cap.position.set(mx, top + 0.03, mz); cap.rotation.y = m.rotation.y
        g.add(cap)
      }
      break
    }
    case 'fence-line': {
      const H = P(obj, 'height', 1.2)
      const s = samplePolyline(pts, 2.5)
      for (const p of s) {
        const y = terrain.heightAt(p.x, p.z)
        g.add(box(0.07, H + 0.3, 0.07, M().galvanised, p.x, y + H / 2 - 0.05, p.z))
      }
      const { geo } = ribbon(pts, 0.001, terrain, 0.02, 0.5)
      // build wire panel: vertical ribbon
      const ss = samplePolyline(pts, 0.5)
      const pos: number[] = [], uv: number[] = [], idx: number[] = []
      let along = 0
      ss.forEach((p, i) => {
        if (i > 0) along += Math.hypot(p.x - ss[i - 1].x, p.z - ss[i - 1].z)
        const y = terrain.heightAt(p.x, p.z)
        pos.push(p.x, y + 0.02, p.z, p.x, y + H, p.z); uv.push(along, 0, along, H)
        if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2) }
      })
      geo.dispose()
      const wg = new THREE.BufferGeometry()
      wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wg.setIndex(idx); wg.computeVertexNormals(); wg.userData.owned = true
      g.add(new THREE.Mesh(wg, M().wire))
      break
    }
    case 'hedgerow': case 'flight-barrier': {
      const H = P(obj, 'height', item.height)
      const sp = mat === 'screen' ? PLANTS.cypress : PLANTS.rosehedge
      const mats = getPlantMaterials(sp)
      const rnd = mulberry32(obj.id.length * 131 + Math.round(pts[0].x * 17))
      const buf = newBuf(true)
      const s = samplePolyline(pts, 0.3)
      const cw = mat === 'screen' ? 0.55 : 0.4
      const dense = mat === 'screen' ? 9 : 6
      for (const p of s) {
        const y0 = terrain.heightAt(p.x, p.z)
        const tx = p.dx, tz = p.dz, nx = -tz, nz = tx
        for (let k = 0; k < dense; k++) {
          const u = (rnd() - 0.5) * 2, v = rnd()
          const hh = v * H
          const wMax = (width / 2) * Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, hh / H - 0.65) / 0.35, 2)))
          const off = u * wMax
          const pos = new THREE.Vector3(p.x + nx * off + (rnd() - 0.5) * 0.2, y0 + hh + 0.05, p.z + nz * off + (rnd() - 0.5) * 0.2)
          const ang = rnd() * 6.28, sz = cw * (0.7 + rnd() * 0.6)
          const out = new THREE.Vector3(nx * u, (hh / H - 0.4) * 0.6, nz * u).normalize()
          appendQuad(buf, pos, new THREE.Vector3(Math.cos(ang) * sz, (rnd() - 0.5) * 0.3 * sz, Math.sin(ang) * sz).multiplyScalar(0.5), new THREE.Vector3(-Math.sin(ang) * sz * 0.5, 0.5 * sz * 0.9, Math.cos(ang) * sz * 0.5), out, rnd(), 0.5 + rnd() * 0.4)
        }
      }
      const m = new THREE.Mesh(toGeometry(buf), mats.leaf)
      m.geometry.userData.owned = true
      m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = mats.leafDepth
      g.add(m)
      // woody stems
      const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.03, 1, 5), mats.bark, s.length)
      stems.geometry.userData.owned = true
      const o = new THREE.Object3D()
      s.forEach((p, i) => { const y0 = terrain.heightAt(p.x, p.z); o.position.set(p.x, y0 + H * 0.3, p.z); o.scale.set(1, H * 0.6, 1); o.updateMatrix(); stems.setMatrixAt(i, o.matrix) })
      g.add(stems)
      break
    }
  }
  return g
}
