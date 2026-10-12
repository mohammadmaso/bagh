import * as THREE from 'three'
import { M, box, cyl, cmat, sphere, groundRange, groundRel, drapedRect, rng, lathe, A } from './kit'
import { COOP_SIZES } from '../../core/footprint'
import type { Builder } from './structures'

const P = (o: { params: Record<string, number | string | boolean> }, k: string, d: number) => (typeof o.params[k] === 'number' ? (o.params[k] as number) : d)

function wireWall(w: number, h: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
  m.geometry.userData.owned = true
  m.material = mat
  return m
}

/** Low-poly hen. */
export function hen(color = '#a0522d', scale = 1): THREE.Group {
  const g = new THREE.Group()
  const body = cmat(color, 0.9)
  g.add(sphere(0.12, body, 0, 0.2, 0, 1.2, 1, 0.9))
  g.add(sphere(0.06, body, 0.13, 0.33, 0))
  g.add(sphere(0.02, cmat('#d4a020', 0.6), 0.2, 0.32, 0, 1.4, 0.8, 0.8))
  g.add(sphere(0.025, cmat('#c02020', 0.7), 0.13, 0.4, 0, 1, 1.5, 0.6))
  const tail = sphere(0.07, body, -0.14, 0.27, 0, 0.7, 1.3, 0.6); tail.rotation.z = 0.5; g.add(tail)
  for (const s of [-1, 1]) g.add(cyl(0.008, 0.008, 0.12, cmat('#d9a441', 0.7), 0, 0.06, s * 0.045, 5))
  g.scale.setScalar(scale)
  return g
}

export const coop: Builder = (item, obj, ctx) => {
  const sizeKey = String(obj.params.size ?? 'medium')
  const c = COOP_SIZES[sizeKey] ?? COOP_SIZES.medium
  const run = P(obj, 'runLength', 3), rw = P(obj, 'runWidth', 2)
  const total = c.w + run, D = Math.max(c.d, rw)
  const g = new THREE.Group()
  const wood = M().wood, roof = M().roof
  const legH = 0.55 // house raised on legs
  const x0 = -total / 2 // coop house at the west end (local -x)
  const hx = x0 + c.w / 2
  // house on legs
  const range = groundRange(ctx, obj, total, D)
  void range
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, legH, 0.08, M().woodDark, hx + sx * (c.w / 2 - 0.06), legH / 2, sz * (c.d / 2 - 0.06)))
  const floorY = legH
  g.add(box(c.w, 0.05, c.d, M().woodDark, hx, floorY, 0))
  g.add(box(c.w, c.h - 0.2, c.d, wood, hx, floorY + (c.h - 0.2) / 2 + 0.025, 0))
  // mono-pitch roof (slopes to the back)
  const roofM = box(c.w + 0.25, 0.05, c.d + 0.35, roof, hx, floorY + c.h - 0.1, 0)
  roofM.rotation.x = 0.14
  g.add(roofM)
  // pop door + ramp (front +z side facing run? place on +x end toward run)
  g.add(box(0.03, 0.4, 0.3, M().woodDark, x0 + c.w + 0.005, floorY + 0.3, 0))
  const ramp = box(0.04, 0.3, 0.55, M().woodDark, x0 + c.w + 0.2, floorY * 0.5, 0); ramp.rotation.z = -Math.atan2(floorY, 0.4); g.add(ramp)
  ramp.scale.set(1, 1, 1); ramp.geometry = new THREE.BoxGeometry(0.9, 0.03, 0.3); ramp.position.set(x0 + c.w + 0.38, floorY / 2, 0); ramp.rotation.set(0, 0, -Math.atan2(floorY, 0.8))
  // nest boxes on the back side
  const nb = Math.max(2, Math.round(c.hens / 6))
  for (let i = 0; i < nb; i++) {
    const z = -c.d / 2 - 0.16
    g.add(box(0.34, 0.3, 0.3, wood, hx - c.w / 2 + 0.3 + i * 0.4 * 0 + (i - (nb - 1) / 2) * 0.4, floorY + 0.35, z))
  }
  const nbRoof = box(0.4 * nb + 0.1, 0.03, 0.4, roof, hx, floorY + 0.53, -c.d / 2 - 0.18); nbRoof.rotation.x = 0.35; g.add(nbRoof)
  // window + perch
  g.add(box(0.4, 0.3, 0.02, cmat('#2a3a40', 0.2), hx, floorY + c.h * 0.6, c.d / 2 + 0.01, false))
  g.add(box(0.5, 0.03, 0.03, M().woodDark, hx - c.w / 4, floorY + 0.5, c.d / 2 + 0.1))
  // run: posts + wire + roof mesh
  const runX0 = x0 + c.w
  const runH = Math.min(1.8, c.h)
  const wire = M().wire
  const post = M().woodPlain
  const nPosts = Math.max(2, Math.round(run / 1.2) + 1)
  for (let i = 0; i < nPosts; i++) for (const s of [-1, 1]) g.add(box(0.07, runH, 0.07, post, runX0 + (run * i) / (nPosts - 1), runH / 2, s * (rw / 2)))
  for (const s of [-1, 1]) { const w = wireWall(run, runH - 0.1, wire); w.position.set(runX0 + run / 2, runH / 2, s * rw / 2); g.add(w) }
  const endW = wireWall(rw, runH - 0.1, wire); endW.rotation.y = Math.PI / 2; endW.position.set(runX0 + run, runH / 2, 0); g.add(endW)
  for (const s of [-1, 1]) g.add(box(run, 0.05, 0.05, post, runX0 + run / 2, runH, s * rw / 2))
  // roof: shade net / mesh
  const topNet = wireWall(run, rw, wire); topNet.rotation.x = -Math.PI / 2; topNet.position.set(runX0 + run / 2, runH, 0); g.add(topNet)
  const rnd = rng(obj)
  const hens = Math.min(8, Math.round(c.hens / 3))
  const colors = ['#a0522d', '#e8e0d0', '#333', '#b87333', '#8a8a8a']
  for (let i = 0; i < hens; i++) {
    const h = hen(colors[i % colors.length], 1)
    h.position.set(runX0 + 0.3 + rnd() * (run - 0.6), 0, (rnd() - 0.5) * (rw - 0.4))
    h.rotation.y = rnd() * 6.28
    g.add(h)
  }
  A(g, drapedRect(ctx, obj, run, rw, cmat('#8a7a5a', 1), 0.01), (m) => { m.position.x = runX0 + run / 2 })
  return g
}

export const chickenTractor: Builder = () => {
  const g = new THREE.Group()
  const wood = M().woodPlain, wire = M().wire
  const L = 2.4, W = 1.2, H = 0.9
  // A-frame
  for (const sx of [-1, 1]) {
    const a = box(0.05, 1.0, 0.05, wood, sx * L / 2, 0.45, W / 2 - 0.1); a.rotation.x = -0.45
    const b = box(0.05, 1.0, 0.05, wood, sx * L / 2, 0.45, -W / 2 + 0.1); b.rotation.x = 0.45
    g.add(a, b)
  }
  g.add(box(L, 0.05, 0.05, wood, 0, H + 0.02, 0))
  for (const s of [-1, 1]) {
    const m = wireWall(L, 1.0, wire); m.rotation.x = -s * 0.45; m.position.set(0, 0.46, s * (W / 4 + 0.05)); g.add(m)
    g.add(box(L, 0.05, 0.05, wood, 0, 0.05, s * (W / 2 - 0.05)))
  }
  const cover = box(0.8, 0.04, W * 0.6, M().roof, -L / 4, 0.82, 0); g.add(cover)
  A(g, cyl(0.1, 0.1, 0.04, cmat('#222'), -L / 2 - 0.05, 0.1, W / 2, 10), (m) => { m.rotation.x = Math.PI / 2 })
  const rnd = rng({ id: 'ct', x: 0, z: 0, rotY: 0, scale: 1, params: {}, type: '', ageOffset: 0 })
  for (let i = 0; i < 3; i++) { const h = hen('#b87333'); h.position.set((rnd() - 0.5) * L * 0.7, 0, (rnd() - 0.5) * 0.4); h.rotation.y = rnd() * 6; g.add(h) }
  return g
}

export const rabbitHutches: Builder = (item, obj) => {
  const n = Math.round(P(obj, 'count', 3))
  const g = new THREE.Group()
  const wood = M().wood, wire = M().wire, post = M().woodDark
  const bw = 1.0, d = 0.9, h = 0.6, legH = 0.8
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * bw
    g.add(box(bw - 0.02, h, d, wood, x, legH + h / 2, 0))
    const door = wireWall(bw * 0.7, h * 0.7, wire); door.position.set(x - 0.08, legH + h / 2, d / 2 + 0.01); g.add(door)
    g.add(box(0.04, h * 0.8, 0.03, post, x + bw * 0.28, legH + h / 2, d / 2 + 0.015))
    g.add(box(bw * 0.7, 0.03, 0.03, post, x - 0.08, legH + h * 0.85, d / 2 + 0.02))
  }
  const roof = box(n * bw + 0.2, 0.04, d + 0.3, M().roof, 0, legH + h + 0.12, 0); roof.rotation.x = 0.12; g.add(roof)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, legH, 0.07, post, sx * (n * bw / 2 - 0.05), legH / 2, sz * (d / 2 - 0.05)))
  g.add(box(n * bw, 0.04, d, post, 0, legH * 0.55, 0))
  return g
}

export const gooseHouse: Builder = (item, obj, ctx) => {
  const g = new THREE.Group()
  const wood = M().wood
  // house at west end, pond at east end
  g.add(box(1.8, 1.2, 1.4, wood, -1.35, 0.6, 0))
  const roof = box(2.1, 0.05, 1.8, M().roof, -1.35, 1.32, 0); roof.rotation.z = 0.0; roof.rotation.x = 0.12; g.add(roof)
  g.add(box(0.5, 0.7, 0.03, cmat('#2a2018', 0.9), -1.35, 0.4, 0.71, false))
  // pond: shallow dish
  const pondMat = new THREE.MeshStandardMaterial({ color: 0x2f5f6a, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9, envMapIntensity: 1.8 })
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.07, 8, 28), M().stone); rim.geometry.userData.owned = true
  rim.rotation.x = Math.PI / 2; rim.position.set(1.2, 0.06, 0); rim.scale.set(1, 1.2, 1); g.add(rim)
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28), pondMat); water.geometry.userData.owned = true
  water.rotation.x = -Math.PI / 2; water.position.set(1.2, 0.05, 0); water.scale.set(1, 1.2, 1); g.add(water)
  for (let i = 0; i < 2; i++) {
    const goose = new THREE.Group()
    const b = cmat('#f2efe6', 0.8)
    goose.add(sphere(0.2, b, 0, 0.3, 0, 1.4, 0.9, 0.9))
    goose.add(A(new THREE.Group(), cyl(0.04, 0.05, 0.4, b, 0.22, 0.52, 0, 8), (m) => { m.rotation.z = -0.25 }))
    goose.add(sphere(0.07, b, 0.3, 0.74, 0, 1.2, 0.9, 0.9))
    goose.add(sphere(0.03, cmat('#e08a20', 0.6), 0.4, 0.72, 0, 1.6, 0.6, 0.6))
    goose.position.set(0.5 + i * 1.3, 0, i ? 0.6 : -0.5); goose.rotation.y = i * 2
    g.add(goose)
  }
  return g
}

export const goatShelter: Builder = () => {
  const g = new THREE.Group()
  const W = 4, D = 3, H = 2.2
  const w = M().wood, post = M().woodDark
  g.add(box(W, H, 0.08, w, 0, H / 2, -D / 2))
  g.add(box(0.08, H, D, w, -W / 2, H / 2, 0))
  g.add(box(0.08, H * 0.6, D, w, W / 2, H * 0.3, 0))
  for (const sx of [-1, 1]) g.add(box(0.12, H * 0.85, 0.12, post, sx * (W / 2 - 0.06), H * 0.425, D / 2 - 0.1))
  const roof = box(W + 0.5, 0.06, D + 0.6, M().roof, 0, H + 0.1, 0.05); roof.rotation.x = 0.16; g.add(roof)
  g.add(box(W - 0.2, 0.1, D - 0.2, cmat('#9a8456', 1), 0, 0.05, 0, false))
  g.add(box(1.4, 0.35, 0.4, post, 0.5, 0.4, -D / 2 + 0.4))
  return g
}

// -------- bees --------

const beeWhite = () => cmat('#efe8d8', 0.75)
export const hiveLangstroth: Builder = (item, obj) => {
  const boxes = Math.round(P(obj, 'boxes', 2))
  const g = new THREE.Group()
  const col = [cmat('#efe8d8', 0.75), cmat('#e8c75a', 0.75), cmat('#7aa6c8', 0.75)]
  const stand = M().woodDark
  const W = 0.52, D = 0.42
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, 0.4, 0.05, stand, sx * (W / 2 - 0.05), 0.2, sz * (D / 2 - 0.04)))
  g.add(box(W + 0.04, 0.04, D + 0.2, stand, 0, 0.42, 0.05))
  g.add(box(W, 0.05, D + 0.12, beeWhite(), 0, 0.47, 0.04))
  // entrance slot
  g.add(box(0.28, 0.018, 0.03, cmat('#1a1410', 1), 0, 0.505, D / 2 + 0.1, false))
  let y = 0.5
  for (let i = 0; i < boxes; i++) {
    const h = i === 0 ? 0.24 : 0.2
    g.add(box(W, h, D, col[i % col.length], 0, y + h / 2, 0))
    g.add(box(W + 0.02, 0.012, D + 0.02, cmat('#d9d1bd', 0.8), 0, y + h, 0, false))
    y += h
  }
  g.add(box(W + 0.07, 0.025, D + 0.07, M().galvanised, 0, y + 0.03, 0))
  g.add(box(0.12, 0.08, 0.1, cmat('#9a9a9a', 0.5, 0.6), 0, y + 0.08, 0))
  return g
}

export const hiveTopbar: Builder = () => {
  const g = new THREE.Group()
  const wood = M().woodPlain, leg = M().woodDark
  const L = 1.2
  // trapezoid body
  const shape = new THREE.Shape(); shape.moveTo(-0.24, 0); shape.lineTo(0.24, 0); shape.lineTo(0.12, -0.3); shape.lineTo(-0.12, -0.3); shape.closePath()
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false }), wood); body.geometry.userData.owned = true
  body.rotation.y = Math.PI / 2; body.position.set(-L / 2, 0.78, 0); body.castShadow = body.receiveShadow = true
  g.add(body)
  g.add(box(L + 0.05, 0.03, 0.54, cmat('#c7b79a', 0.8), 0, 0.795, 0))
  const roofShape = new THREE.Shape(); roofShape.moveTo(-0.34, 0); roofShape.lineTo(0.34, 0); roofShape.lineTo(0, 0.2); roofShape.closePath()
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: L + 0.3, bevelEnabled: false }), M().roof); roof.geometry.userData.owned = true
  roof.rotation.y = Math.PI / 2; roof.position.set(-L / 2 - 0.15, 0.85, 0); roof.castShadow = true
  g.add(roof)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = box(0.06, 0.8, 0.06, leg, sx * (L / 2 - 0.1), 0.4, sz * 0.2); l.rotation.z = sz * 0.0; g.add(l)
  }
  g.add(box(0.04, 0.02, 0.04, cmat('#1a1410'), 0, 0.72, 0.3, false))
  return g
}

export const hiveStand: Builder = () => {
  const g = new THREE.Group()
  const w = M().woodDark
  g.add(box(1.4, 0.06, 0.55, w, 0, 0.4, 0))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, 0.4, 0.07, w, sx * 0.6, 0.2, sz * 0.2))
  g.add(box(1.3, 0.04, 0.07, w, 0, 0.15, 0.2), box(1.3, 0.04, 0.07, w, 0, 0.15, -0.2))
  return g
}

export const beeWater: Builder = () => {
  const g = new THREE.Group()
  const basin = lathe([[0.0, 0.0], [0.28, 0.0], [0.32, 0.12], [0.3, 0.13], [0.26, 0.04], [0, 0.04]], cmat('#8a6a52', 0.9), 20)
  g.add(basin)
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.27, 20), new THREE.MeshStandardMaterial({ color: 0x3a6a7a, roughness: 0.05, transparent: true, opacity: 0.85 })); water.geometry.userData.owned = true
  water.rotation.x = -Math.PI / 2; water.position.y = 0.09; g.add(water)
  const rnd = rng({ id: 'bw', x: 0, z: 0, rotY: 0, scale: 1, params: {}, type: '', ageOffset: 0 })
  for (let i = 0; i < 14; i++) g.add(sphere(0.03 + rnd() * 0.03, M().stone, (rnd() - 0.5) * 0.4, 0.09, (rnd() - 0.5) * 0.4, 1, 0.6, 1))
  void groundRel
  return g
}
