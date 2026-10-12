import * as THREE from 'three'
import { M, box, cyl, mat, cmat, drapedRect, groundRange, groundRel, group, rng, cropInstances, sphere } from './kit'
import { localDims, } from '../../core/footprint'
import { PLANTS } from '../../data/plants'
import { plantSizeAt } from '../../core/growth'
import { buildPlantClump } from './plantFactory'
import { getPlantMaterials } from './plantMaterials'
import { appendQuad, newBuf, toGeometry } from './geomUtil'
import { hashStr } from './index'
import type { Builder } from './structures'

const P = (o: { params: Record<string, number | string | boolean> }, k: string, d: number) => (typeof o.params[k] === 'number' ? (o.params[k] as number) : d)

let soilMat: THREE.MeshStandardMaterial | null = null
const soil = () => (soilMat ??= mat('#4a3626', 1))
const soilLight = () => cmat('#6b5238', 1)

export const raisedBed: Builder = (item, obj, ctx) => {
  const L = P(obj, 'length', 2.4), W = P(obj, 'width', 1.2), H = P(obj, 'height', 0.4)
  const g = new THREE.Group()
  const r = groundRange(ctx, obj, L, W)
  const top = H
  const bottom = Math.min(0, r.lo) - 0.05
  const hh = top - bottom
  const t = 0.04
  const wood = M().woodPlain
  g.add(box(L, hh, t, wood, 0, bottom + hh / 2, W / 2 - t / 2), box(L, hh, t, wood, 0, bottom + hh / 2, -W / 2 + t / 2))
  g.add(box(t, hh, W - 2 * t, wood, L / 2 - t / 2, bottom + hh / 2, 0), box(t, hh, W - 2 * t, wood, -L / 2 + t / 2, bottom + hh / 2, 0))
  // corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, hh + 0.02, 0.07, wood, sx * (L / 2 - 0.035), bottom + hh / 2 + 0.01, sz * (W / 2 - 0.035)))
  const s = box(L - 2 * t, 0.02, W - 2 * t, soil(), 0, top - 0.06, 0, false)
  g.add(s)
  const rnd = rng(obj)
  g.add(cropInstances(Math.round(L * W * 14), L - 0.2, W - 0.2, top - 0.05, rnd))
  return g
}

export const ingroundBed: Builder = (item, obj, ctx) => {
  const L = P(obj, 'length', 4), W = P(obj, 'width', 1.2)
  const g = new THREE.Group()
  g.add(drapedRect(ctx, obj, L, W, soil(), 0.05, (lx, lz) => 0.04 * Math.cos((lz / W) * Math.PI)))
  const rnd = rng(obj)
  const crops = cropInstances(Math.round(L * W * 10), L - 0.2, W - 0.2, 0, rnd, '#6aa63f')
  crops.position.y = groundRel(ctx, obj, 0, 0) + 0.06
  g.add(crops)
  return g
}

export const potatoRows: Builder = (item, obj, ctx) => {
  const L = P(obj, 'length', 6), W = P(obj, 'width', 2.4)
  const g = new THREE.Group()
  const rowSp = 0.75
  g.add(drapedRect(ctx, obj, L, W, soil(), 0.03, (lx, lz) => Math.max(0, Math.cos((lz / rowSp) * Math.PI * 2)) * 0.14, 0.3))
  const rnd = rng(obj)
  const n = Math.max(1, Math.floor(W / rowSp))
  const clumps = cropInstances(Math.round(L * n * 3), L - 0.2, W - 0.2, 0.18, rnd, '#4f8f35', 0.2)
  const o = new THREE.Object3D()
  for (let i = 0; i < clumps.count; i++) {
    const row = Math.floor(rnd() * n)
    o.position.set((rnd() - 0.5) * (L - 0.3), groundRel(ctx, obj, 0, 0) + 0.28, (row - (n - 1) / 2) * rowSp)
    const s = 0.16 + rnd() * 0.1
    o.scale.set(s, s * 1.1, s); o.rotation.y = rnd() * 6; o.updateMatrix(); clumps.setMatrixAt(i, o.matrix)
  }
  g.add(clumps)
  return g
}

export const squashPatch: Builder = (item, obj, ctx) => {
  const L = P(obj, 'length', 4), W = P(obj, 'width', 4)
  const g = new THREE.Group()
  g.add(drapedRect(ctx, obj, L, W, soil(), 0.03, (lx, lz) => 0.06 * Math.sin(lx * 2.2) * Math.sin(lz * 2.2), 0.4))
  const rnd = rng(obj)
  const mats = getPlantMaterials(PLANTS.fig)
  void mats
  const leaf = new THREE.MeshStandardMaterial({ color: 0x4f8a2f, roughness: 0.7, side: THREE.DoubleSide })
  const buf = newBuf()
  const n = Math.round(L * W * 3)
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * (L - 0.4), z = (rnd() - 0.5) * (W - 0.4)
    const y = groundRel(ctx, obj, x, z) + 0.18 + rnd() * 0.25
    const ang = rnd() * 6.28, s = 0.2 + rnd() * 0.18
    appendQuad(buf, new THREE.Vector3(x, y, z), new THREE.Vector3(Math.cos(ang) * s, 0.04, Math.sin(ang) * s), new THREE.Vector3(-Math.sin(ang) * s, 0.04, Math.cos(ang) * s), new THREE.Vector3(0, 1, 0), 0, 0)
  }
  const lm = new THREE.Mesh(toGeometry(buf), leaf); lm.geometry.userData.owned = true; lm.castShadow = true; lm.userData.seasonal = 'crop'
  g.add(lm)
  const fr = cmat('#e8892b', 0.55)
  for (let i = 0; i < Math.round(L * W * 0.35); i++) {
    const x = (rnd() - 0.5) * (L - 0.6), z = (rnd() - 0.5) * (W - 0.6)
    const s = sphere(0.14 + rnd() * 0.08, fr, x, groundRel(ctx, obj, x, z) + 0.2, z, 1, 0.8, 1)
    s.userData.seasonal = 'crop'
    g.add(s)
  }
  return g
}

export const herbSpiral: Builder = (item, obj, ctx) => {
  const D = P(obj, 'diameter', 2)
  const g = new THREE.Group()
  const R = D / 2
  const stone = M().stone
  // soil mound
  const mound = new THREE.Mesh(new THREE.ConeGeometry(R * 0.96, 0.9, 28, 1, false), soil()); mound.geometry.userData.owned = true
  mound.position.y = 0.45; mound.castShadow = mound.receiveShadow = true
  g.add(mound)
  // spiral wall as stacked stones along spiral
  const turns = 2.1, steps = 90
  const stoneGeo = new THREE.DodecahedronGeometry(1, 0)
  const rnd = rng(obj)
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const a = t * turns * Math.PI * 2
    const r = R * (1 - 0.82 * t)
    const hgt = 0.12 + 0.75 * t
    const layers = Math.max(1, Math.round(hgt / 0.12))
    for (let l = 0; l < layers; l++) {
      const m = new THREE.Mesh(stoneGeo, stone)
      m.scale.set(0.11 + rnd() * 0.04, 0.07 + rnd() * 0.02, 0.1 + rnd() * 0.04)
      m.position.set(Math.cos(a) * r, 0.05 + l * 0.11, Math.sin(a) * r)
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3)
      m.castShadow = m.receiveShadow = true
      g.add(m)
    }
  }
  // herbs
  const crops = cropInstances(60, R * 1.4, R * 1.4, 0, rnd, '#6ca747', 0.1)
  const o = new THREE.Object3D()
  for (let i = 0; i < crops.count; i++) {
    const t = rnd(), a = t * turns * Math.PI * 2 + 0.5
    const r = R * (1 - 0.82 * t) * 0.8
    const y = Math.max(0.06, 0.9 * (1 - (r / R)) * 1.05 + 0.1)
    o.position.set(Math.cos(a) * r, y, Math.sin(a) * r); o.scale.setScalar(0.08 + rnd() * 0.07); o.updateMatrix(); crops.setMatrixAt(i, o.matrix)
  }
  g.add(crops)
  return g
}

/** Aluminium-framed glass greenhouse. */
export const greenhouse: Builder = (item, obj) => {
  const L = P(obj, 'length', 4), W = P(obj, 'width', 3)
  const g = new THREE.Group()
  const eave = 1.9, ridge = 2.8
  const frame = cmat('#c9ced1', 0.35, 0.8)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, envMapIntensity: 1.5, side: THREE.DoubleSide, depthWrite: false })
  g.add(box(L + 0.2, 0.12, W + 0.2, M().concrete, 0, 0.06, 0))
  // glass walls
  g.add(box(L, eave, 0.01, glass, 0, 0.12 + eave / 2, W / 2, false), box(L, eave, 0.01, glass, 0, 0.12 + eave / 2, -W / 2, false))
  g.add(box(0.01, eave, W, glass, L / 2, 0.12 + eave / 2, 0, false), box(0.01, eave, W, glass, -L / 2, 0.12 + eave / 2, 0, false))
  // gable ends
  const gab = new THREE.Shape(); gab.moveTo(-W / 2, 0); gab.lineTo(W / 2, 0); gab.lineTo(0, ridge - eave); gab.closePath()
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(gab), glass); m.geometry.userData.owned = true
    m.rotation.y = Math.PI / 2; m.position.set(sx * L / 2, 0.12 + eave, 0); g.add(m)
  }
  // roof panes
  const slope = Math.atan2(ridge - eave, W / 2), len = Math.hypot(ridge - eave, W / 2)
  for (const s of [-1, 1]) {
    const p = box(L, 0.01, len, glass, 0, 0, 0, false)
    p.rotation.x = s * slope
    p.position.set(0, 0.12 + eave + (ridge - eave) / 2, s * -W / 4 * 1)
    p.rotation.x = -s * slope
    g.add(p)
  }
  // frame: posts, rafters, ridge
  const bays = Math.max(1, Math.round(L / 1.0))
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + (L * i) / bays
    for (const s of [-1, 1]) g.add(box(0.04, eave, 0.04, frame, x, 0.12 + eave / 2, s * W / 2))
    for (const s of [-1, 1]) {
      const r = box(0.04, 0.04, len, frame, x, 0.12 + eave + (ridge - eave) / 2, -s * W / 4)
      r.rotation.x = s * slope; g.add(r)
    }
  }
  g.add(box(L, 0.05, 0.05, frame, 0, 0.12 + ridge, 0))
  for (const s of [-1, 1]) { g.add(box(L, 0.04, 0.04, frame, 0, 0.12 + eave, s * W / 2)); g.add(box(L, 0.04, 0.04, frame, 0, 0.7, s * W / 2)) }
  // door on front
  g.add(box(0.9, 1.9, 0.03, frame, 0, 0.12 + 0.95, W / 2 + 0.01, false))
  // benches and plants
  const rnd = rng(obj)
  for (const s of [-1, 1]) {
    g.add(box(L - 0.6, 0.05, 0.6, M().woodPlain, 0, 0.8, s * (W / 2 - 0.45)))
    const c = cropInstances(Math.round(L * 10), L - 0.8, 0.5, 0.85, rnd, '#59a03a', 0.1)
    c.position.z = s * (W / 2 - 0.45); g.add(c)
  }
  return g
}

export const polytunnel: Builder = (item, obj) => {
  const L = P(obj, 'length', 8), W = P(obj, 'width', 3.5)
  const g = new THREE.Group()
  const R = W / 2, H = 2.4
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe9f1ee, transparent: true, opacity: 0.38, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false })
  const geo = new THREE.CylinderGeometry(R, R, L, 28, 1, true, 0, Math.PI)
  geo.userData.owned = true
  const sk = H / R
  const m = new THREE.Mesh(geo, plastic)
  m.rotation.set(0, 0, Math.PI / 2); m.rotation.order = 'ZYX'
  m.scale.set(1, 1, sk) // after rotation; flatten height
  // cylinder axis = Y; rotate so axis along X and half-arc faces up
  m.rotation.set(Math.PI / 2 * 0, 0, 0)
  const tunnel = new THREE.Group()
  tunnel.add(m)
  // easier: build hoops and a swept surface manually
  tunnel.clear()
  const seg = 24
  const pos: number[] = [], idx: number[] = []
  const bays = Math.max(2, Math.round(L / 1.2))
  for (let k = 0; k <= 1; k++) for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI
    pos.push(k ? L / 2 : -L / 2, Math.sin(a) * H, -Math.cos(a) * R)
  }
  for (let i = 0; i < seg; i++) { const a = i, b = i + 1, c = seg + 1 + i, d = c + 1; idx.push(a, b, c, b, d, c) }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals(); sg.userData.owned = true
  const skin = new THREE.Mesh(sg, plastic); skin.receiveShadow = true
  g.add(skin)
  const hoop = cmat('#aeb4b8', 0.4, 0.8)
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + (L * i) / bays
    const pts: THREE.Vector3[] = []
    for (let s = 0; s <= 16; s++) { const a = (s / 16) * Math.PI; pts.push(new THREE.Vector3(x, Math.sin(a) * H, -Math.cos(a) * R)) }
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.02, 6), hoop); t.geometry.userData.owned = true; t.castShadow = true
    g.add(t)
  }
  g.add(box(L, 0.04, 0.04, hoop, 0, H, 0))
  const rnd = rng(obj)
  g.add(cropInstances(Math.round(L * 8), L - 0.6, W - 1, 0.05, rnd, '#5fa23c', 0.12))
  return g
}

export const coldFrame: Builder = (item, obj) => {
  const g = new THREE.Group()
  const w = M().woodPlain
  g.add(box(1.2, 0.3, 0.03, w, 0, 0.15, 0.45 - 0.015), box(1.2, 0.5, 0.03, w, 0, 0.25, -0.45 + 0.015))
  g.add(box(0.03, 0.3, 0.9, w, 0.585, 0.2, 0), box(0.03, 0.3, 0.9, w, -0.585, 0.2, 0))
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfe8ee, transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false, envMapIntensity: 1.5 })
  const lid = box(1.2, 0.02, 0.98, glass, 0, 0, 0, false)
  lid.rotation.x = -Math.atan2(0.2, 0.9)
  lid.position.set(0, 0.42, 0.0)
  g.add(lid)
  g.add(box(1.14, 0.02, 0.84, soil(), 0, 0.22, 0, false))
  return g
}

export const ginsengBed: Builder = (item, obj, ctx) => {
  const L = P(obj, 'length', 4), W = P(obj, 'width', 1.5)
  const g = new THREE.Group()
  const r = groundRange(ctx, obj, L, W)
  g.add(drapedRect(ctx, obj, L, W, soil(), 0.04))
  const post = M().woodPlain, H = 1.8
  const cloth = new THREE.MeshStandardMaterial({ color: 0x1d2b20, transparent: true, opacity: 0.72, roughness: 1, side: THREE.DoubleSide })
  const n = Math.max(2, Math.round(L / 1.5) + 1)
  for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
    const x = -L / 2 + (L * i) / (n - 1)
    const gr = groundRel(ctx, obj, x, s * W / 2)
    g.add(box(0.07, H - gr + 0.1, 0.07, post, x, gr + (H - gr) / 2, s * (W / 2 + 0.05)))
  }
  g.add(box(L + 0.2, 0.02, W + 0.3, cloth, 0, H + 0.01 - Math.min(0, r.lo) * 0, 0, false))
  g.add(box(0.02, 0.9, W, cloth, L / 2 + 0.02, H - 0.45, 0, false), box(0.02, 0.9, W, cloth, -L / 2 - 0.02, H - 0.45, 0, false))
  const rnd = rng(obj)
  g.add(cropInstances(Math.round(L * W * 6), L - 0.2, W - 0.2, 0.03, rnd, '#3f7a35', 0.09))
  return g
}

export const shiitakeRack: Builder = () => {
  const g = new THREE.Group()
  const w = M().woodPlain
  for (const x of [-0.9, 0.9]) {
    const a = box(0.05, 1.15, 0.05, w, x, 0.55, 0.28); a.rotation.x = 0.25
    const b = box(0.05, 1.15, 0.05, w, x, 0.55, -0.28); b.rotation.x = -0.25
    g.add(a, b)
  }
  g.add(box(2, 0.05, 0.05, w, 0, 1.08, 0))
  const logMat = M().bark
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
    const l = cyl(0.055, 0.055, 1.5, logMat, -0.8 + i * 0.2, 0.55, 0, 8)
    l.rotation.set(0, 0, 0)
    l.rotation.x = s * 0.45
    l.rotation.z = Math.PI / 2 * 0
    l.position.set(-0.8 + i * 0.2, 0.55, s * 0.28)
    l.scale.set(1, 0.7, 1)
    g.add(l)
  }
  const mush = cmat('#8a6a4a', 0.8)
  for (let i = 0; i < 6; i++) g.add(sphere(0.035, mush, -0.7 + i * 0.28, 0.35 + (i % 2) * 0.15, (i % 2 ? 1 : -1) * 0.42, 1, 0.5, 1))
  return g
}

export const mushroomHouse: Builder = () => {
  const g = new THREE.Group()
  const cloth = new THREE.MeshStandardMaterial({ color: 0x1d2b20, transparent: true, opacity: 0.75, roughness: 1, side: THREE.DoubleSide })
  const w = M().woodPlain
  const W = 3, D = 2.4, H = 2.2
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, H, 0.08, w, sx * W / 2, H / 2, sz * D / 2))
  g.add(box(W + 0.2, 0.03, D + 0.2, cloth, 0, H, 0, false))
  g.add(box(W, H * 0.85, 0.02, cloth, 0, H * 0.45, -D / 2, false), box(0.02, H * 0.85, D, cloth, -W / 2, H * 0.45, 0, false), box(0.02, H * 0.85, D, cloth, W / 2, H * 0.45, 0, false))
  g.add(box(W - 0.4, 0.05, D - 0.4, M().concrete, 0, 0.03, 0))
  for (let i = 0; i < 6; i++) g.add(cyl(0.07, 0.07, 1.4, M().bark, -1 + (i % 3) * 1, 0.3 + Math.floor(i / 3) * 0.5, -0.2 + Math.floor(i / 3) * 0.2, 8))
  return g
}

export const nurseryTable: Builder = (item, obj) => {
  const L = P(obj, 'length', 2)
  const g = new THREE.Group()
  const w = M().woodPlain
  g.add(box(L, 0.05, 0.8, w, 0, 0.88, 0))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.06, 0.88, 0.06, w, sx * (L / 2 - 0.05), 0.44, sz * 0.35))
  const rnd = rng(obj)
  const pot = cmat('#b8643c', 0.8)
  for (let i = 0; i < Math.floor(L / 0.3); i++) {
    const x = -L / 2 + 0.2 + i * 0.3
    g.add(cyl(0.055, 0.04, 0.09, pot, x, 0.95, -0.15, 10))
    g.add(sphere(0.07 + rnd() * 0.03, cmat('#5fa23c', 0.7), x, 1.04, -0.15, 1, 0.8, 1))
    g.add(cyl(0.055, 0.04, 0.09, pot, x, 0.95, 0.15, 10))
    g.add(sphere(0.07 + rnd() * 0.03, cmat('#4f9433', 0.7), x, 1.04, 0.15, 1, 0.8, 1))
  }
  return g
}

// ---------------------------------------------------------------------------------------------
// plants on rows / pergolas

/** Row(s) of shrub clumps along local x with trellis posts & wires. */
export const plantRow: Builder = (item, obj, ctx) => {
  const sp = PLANTS[item.plant!]
  const L = P(obj, 'length', 5), rows = Math.round(P(obj, 'rows', 1))
  const g = new THREE.Group()
  const age = ctx.age
  const size = plantSizeAt(sp, age)
  const spacing = Math.max(0.3, sp.spacing)
  const n = Math.max(1, Math.floor(L / spacing) + 1)
  const variant0 = hashStr(obj.id)
  const rowGap = Math.max(0.9, size.canopy + 0.3)
  for (let r = 0; r < rows; r++) {
    const z = (r - (rows - 1) / 2) * rowGap
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + (n === 1 ? L / 2 : (L * i) / (n - 1))
      const clump = buildPlantClump(sp, age, (variant0 + i + r * 3) % 4, 0)
      clump.position.set(x, groundRel(ctx, obj, x, z), z)
      clump.rotation.y = ((variant0 + i * 37) % 628) / 100
      g.add(clump)
    }
    if (sp.id === 'raspberry' || sp.id === 'blackberry') {
      const wood = M().woodPlain
      for (const x of [-L / 2, L / 2]) g.add(box(0.07, 1.8, 0.07, wood, x, groundRel(ctx, obj, x, z) + 0.9, z))
      for (const y of [0.6, 1.1, 1.6]) g.add(box(L, 0.012, 0.012, M().galvanised, 0, groundRel(ctx, obj, 0, z) + y, z))
    }
  }
  return g
}

export const plantBed: Builder = (item, obj, ctx) => {
  const sp = PLANTS[item.plant!]
  const L = P(obj, 'length', 2), W = P(obj, 'width', 1.2)
  const g = new THREE.Group()
  g.add(drapedRect(ctx, obj, L, W, soil(), 0.05))
  const rnd = rng(obj)
  const nx = Math.max(1, Math.floor(L / 0.45)), nz = Math.max(1, Math.floor(W / 0.45))
  const variant0 = hashStr(obj.id)
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const clump = buildPlantClump(sp, ctx.age + 1, (variant0 + i * 5 + j) % 4, 0)
    const x = -L / 2 + (i + 0.5) * (L / nx) + (rnd() - 0.5) * 0.1, z = -W / 2 + (j + 0.5) * (W / nz) + (rnd() - 0.5) * 0.1
    clump.position.set(x, groundRel(ctx, obj, x, z) + 0.04, z)
    clump.scale.setScalar(0.55 + rnd() * 0.3)
    clump.rotation.y = rnd() * 6
    g.add(clump)
  }
  return g
}

const vineCache = new Map<string, THREE.BufferGeometry>()

/** Pergola with a vine whose coverage grows with age. */
export const pergolaVine: Builder = (item, obj, ctx) => {
  const sp = PLANTS[item.plant!]
  const W = P(obj, 'width', 4), D = P(obj, 'depth', 3)
  const g = new THREE.Group()
  const H = 2.4
  const wood = M().woodDark
  const posts: [number, number][] = [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]
  for (const [x, z] of posts) g.add(box(0.12, H + groundRel(ctx, obj, x, z) * -0 + 0.3, 0.12, wood, x, (H - 0.3) / 2 + groundRel(ctx, obj, x, z) * 0 + 0.0, z))
  for (const z of [-D / 2, D / 2]) g.add(box(W + 0.5, 0.12, 0.1, wood, 0, H, z))
  const slats = Math.round(W / 0.45)
  for (let i = 0; i <= slats; i++) g.add(box(0.05, 0.07, D + 0.6, wood, -W / 2 + (W * i) / slats, H + 0.09, 0))
  // vine foliage mass
  const size = plantSizeAt(sp, ctx.age)
  const cover = Math.max(0.12, Math.min(1, size.fraction * 1.1))
  const reach = Math.max(0.6, Math.hypot(W, D) * cover)
  const key = `${sp.id}:${W}:${D}:${Math.round(reach * 4)}:${hashStr(obj.id) % 3}`
  let geo = vineCache.get(key)
  const mats = getPlantMaterials(sp)
  if (!geo) {
    const rnd = rng(obj, 5)
    const buf = newBuf(true)
    const cw = Math.max(0.2, sp.leaf.size * 2.4)
    const n = Math.round(Math.min(2200, W * D * 16 * cover))
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * (W + 0.5), z = (rnd() - 0.5) * (D + 0.5)
      const d = Math.hypot(x + W / 2, z + D / 2)
      if (d > reach) { i--; if (rnd() > 0.995) break; continue }
      const y = H + 0.12 + rnd() * 0.45 - (rnd() > 0.82 ? 0.5 + rnd() * 0.5 : 0)
      const ang = rnd() * 6.28
      const s = cw * (0.7 + rnd() * 0.6)
      appendQuad(buf, new THREE.Vector3(x, y, z), new THREE.Vector3(Math.cos(ang) * s, 0.02, Math.sin(ang) * s), new THREE.Vector3(-Math.sin(ang) * s * 0.9, 0.12 * rnd(), Math.cos(ang) * s * 0.9), new THREE.Vector3(0, 1, 0), rnd(), 0.5 + rnd() * 0.5)
    }
    geo = toGeometry(buf); geo.userData.owned = true
    vineCache.set(key, geo)
  }
  const leaves = new THREE.Mesh(geo, mats.leaf)
  leaves.castShadow = true; leaves.receiveShadow = true; leaves.customDepthMaterial = mats.leafDepth
  g.add(leaves)
  // stem
  const stem = cyl(0.03 + size.fraction * 0.03, 0.04 + size.fraction * 0.03, H, M().bark, -W / 2 + 0.15, H / 2, -D / 2 + 0.15, 8)
  g.add(stem)
  return g
}

export const trellisVine: Builder = (item, obj, ctx) => {
  const sp = PLANTS[item.plant!]
  const L = P(obj, 'length', 9)
  const g = new THREE.Group()
  const wood = M().woodDark
  const posts = Math.max(2, Math.round(L / 3) + 1)
  for (let i = 0; i < posts; i++) {
    const x = -L / 2 + (L * i) / (posts - 1)
    g.add(box(0.1, 2.1, 0.1, wood, x, 1.0 + groundRel(ctx, obj, x, 0), 0))
  }
  for (const y of [0.6, 1.1, 1.6, 2.0]) g.add(box(L, 0.012, 0.012, M().galvanised, 0, y + groundRel(ctx, obj, 0, 0), 0))
  const size = plantSizeAt(sp, ctx.age)
  const n = Math.max(1, Math.floor(L / sp.spacing) + 1)
  const mats = getPlantMaterials(sp)
  const rnd = rng(obj, 9)
  const cover = Math.min(1, size.fraction * 1.1 + 0.1)
  const buf = newBuf(true)
  const cw = Math.max(0.15, sp.leaf.size * 2.2)
  for (let c = 0; c < n; c++) {
    const cx = -L / 2 + (n === 1 ? L / 2 : (L * c) / (n - 1))
    const reach = Math.max(0.4, (L / n) * 0.6 * cover + 0.4)
    for (let i = 0; i < Math.round(120 * cover * (reach)); i++) {
      const x = cx + (rnd() - 0.5) * 2 * reach
      const y = 0.5 + rnd() * (0.4 + 1.3 * cover)
      const ang = rnd() * 6.28, s = cw * (0.7 + rnd() * 0.6)
      appendQuad(buf, new THREE.Vector3(x, y, (rnd() - 0.5) * 0.3), new THREE.Vector3(Math.cos(ang) * s, 0.02, Math.sin(ang) * s), new THREE.Vector3(-Math.sin(ang) * s * 0.9, 0.1, Math.cos(ang) * s * 0.9), new THREE.Vector3(0, 0, 1), rnd(), 0.5 + rnd() * 0.5)
    }
  }
  const geo = toGeometry(buf); geo.userData.owned = true
  const leaves = new THREE.Mesh(geo, mats.leaf); leaves.castShadow = true; leaves.customDepthMaterial = mats.leafDepth
  leaves.position.y = groundRel(ctx, obj, 0, 0)
  g.add(leaves)
  return g
}
