import * as THREE from 'three'
import { M, box, cyl, cmat, sphere, groundRel, drapedRect, rng, lathe, A } from './kit'
import { makeCabin } from '../siteLayer'
import { TANK_POLY } from '../../core/footprint'
import type { Builder } from './structures'

const P = (o: { params: Record<string, number | string | boolean> }, k: string, d: number) => (typeof o.params[k] === 'number' ? (o.params[k] as number) : d)

export const houseGable: Builder = (item, obj) => {
  const W = P(obj, 'width', 8), D = P(obj, 'depth', 6), wallH = P(obj, 'wallHeight', 2.8), pitch = P(obj, 'pitch', 30)
  const g = makeCabin({
    width: W, depth: D, wallHeight: wallH, roofPitchDeg: pitch, overhang: 0.5, setbackSouth: 0, offsetX: 0,
    door: { wall: 'south', offset: W > 6 ? -1.2 : 0, width: 1.0, height: 2.1 },
    windows: [
      { wall: 'south', offset: W > 6 ? 1.6 : 1.5, width: 1.4, height: 1.2, sill: 0.9 },
      { wall: 'south', offset: W > 6 ? -3 : -1.6, width: 1.0, height: 1.2, sill: 0.9 },
      { wall: 'north', offset: 0, width: 1.4, height: 1.2, sill: 0.9 },
      { wall: 'east', offset: 0, width: 1.2, height: 1.2, sill: 0.9 },
      { wall: 'west', offset: 0, width: 1.2, height: 1.2, sill: 0.9 },
    ],
  })
  g.position.y = 0.25
  return g
}

export const shed: Builder = (item, obj) => {
  const W = P(obj, 'width', 3), D = P(obj, 'depth', 2.4)
  const g = new THREE.Group()
  const H = 2.2, Hb = 1.9
  g.add(box(W, 0.2, D, M().concrete, 0, 0.1, 0))
  g.add(box(W, Hb - 0.0, D, M().wood, 0, 0.2 + Hb / 2, 0))
  // mono-pitch roof sloping to the back
  const roof = box(W + 0.4, 0.06, D + 0.5, M().roof, 0, 0.2 + (H + Hb) / 2 + 0.06, 0.0)
  roof.rotation.x = Math.atan2(H - Hb, D)
  g.add(roof)
  // taller front: use skirt walls
  const front = new THREE.Mesh(new THREE.BufferGeometry(), M().wood)
  front.visible = false
  g.add(box(0.9, 1.8, 0.04, M().woodDark, -W / 4, 0.2 + 0.9, D / 2 + 0.01))
  g.add(box(0.6, 0.6, 0.03, cmat('#26343a', 0.2), W / 4, 0.2 + 1.2, D / 2 + 0.01, false))
  g.add(box(0.7, 0.05, 0.04, M().trim, W / 4, 0.2 + 1.53, D / 2 + 0.02))
  return g
}

export const firewood: Builder = () => {
  const g = new THREE.Group()
  const post = M().woodDark
  for (const sx of [-1, 1]) { g.add(box(0.1, 1.8, 0.1, post, sx * 1.45, 0.9, 0.4)); g.add(box(0.1, 1.5, 0.1, post, sx * 1.45, 0.75, -0.4)) }
  const roof = box(3.3, 0.05, 1.3, M().roof, 0, 1.72, 0); roof.rotation.x = 0.2; g.add(roof)
  g.add(box(3, 0.08, 0.9, post, 0, 0.12, 0))
  const logs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8), M().bark, 360)
  logs.geometry.userData.owned = true
  const o = new THREE.Object3D(); let i = 0
  for (let row = 0; row < 9 && i < 360; row++) for (let c = 0; c < 20 && i < 360; c++) {
    o.position.set(-1.35 + c * 0.14 + (row % 2) * 0.07, 0.24 + row * 0.13, 0)
    o.rotation.set(Math.PI / 2, 0, 0)
    o.updateMatrix(); logs.setMatrixAt(i++, o.matrix)
  }
  logs.count = i; logs.castShadow = true
  g.add(logs)
  return g
}

export const pergola: Builder = (item, obj) => {
  const W = P(obj, 'width', 4), D = P(obj, 'depth', 3)
  const g = new THREE.Group()
  const wood = M().woodDark, H = 2.5
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.14, H, 0.14, wood, sx * W / 2, H / 2, sz * D / 2))
  for (const z of [-D / 2, D / 2]) g.add(box(W + 0.6, 0.14, 0.1, wood, 0, H + 0.02, z))
  const n = Math.round(W / 0.4)
  for (let i = 0; i <= n; i++) g.add(box(0.06, 0.08, D + 0.6, wood, -W / 2 + (W * i) / n, H + 0.13, 0))
  return g
}

export const gazebo: Builder = (item, obj) => {
  const D = P(obj, 'diameter', 3.6)
  const g = new THREE.Group()
  const wood = M().woodDark, H = 2.3, R = D / 2
  g.add(cyl(R, R, 0.2, M().concrete, 0, 0.1, 0, 8))
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    g.add(box(0.12, H, 0.12, wood, Math.cos(a) * (R - 0.1), 0.2 + H / 2, Math.sin(a) * (R - 0.1)))
    if (i !== 0 && i !== 1) { const r = box(0.04, 0.9, 0.04, wood, Math.cos(a + Math.PI / 8) * (R - 0.1), 0.2 + 0.55, Math.sin(a + Math.PI / 8) * (R - 0.1)); void r }
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.5, 1.2, 8), M().roof); roof.geometry.userData.owned = true
  roof.position.y = 0.2 + H + 0.6; roof.rotation.y = Math.PI / 8; roof.castShadow = true
  g.add(roof)
  return g
}

export const compost: Builder = () => {
  const g = new THREE.Group()
  const w = M().woodPlain, post = M().woodDark
  for (let b = 0; b < 3; b++) {
    const x = (b - 1) * 1.2
    for (let k = 0; k < 4; k++) {
      g.add(box(1.14, 0.18, 0.025, w, x, 0.12 + k * 0.22, -0.55))
      g.add(box(0.025, 0.18, 1.0, w, x - 0.58, 0.12 + k * 0.22, 0))
      g.add(box(0.025, 0.18, 1.0, w, x + 0.58, 0.12 + k * 0.22, 0))
    }
    const h = [0.8, 0.45, 0.15][b]
    g.add(box(1.1, h, 0.95, cmat(['#4a3b25', '#3b2f1f', '#5a4a2a'][b], 1), x, h / 2 + 0.03, 0, false))
  }
  for (const x of [-1.8, -0.6, 0.6, 1.8]) for (const z of [-0.56, 0.5]) g.add(box(0.07, 1.05, 0.07, post, x, 0.52, z))
  return g
}

export const tankIBC: Builder = () => {
  const g = new THREE.Group()
  g.add(box(1.2, 0.15, 1.0, M().woodDark, 0, 0.075, 0))
  const plastic = new THREE.MeshStandardMaterial({ color: 0xdfe8e8, transparent: true, opacity: 0.6, roughness: 0.3 })
  g.add(box(1.14, 1.0, 0.94, plastic, 0, 0.65, 0, true))
  A(g, box(1.1, 0.7, 0.9, cmat('#9fc0c4', 0.3), 0, 0.6, 0, false))
  const cage = M().galvanised
  for (let i = 0; i <= 4; i++) { g.add(box(0.012, 1.02, 0.012, cage, -0.58 + i * 0.29, 0.66, 0.48)); g.add(box(0.012, 1.02, 0.012, cage, -0.58 + i * 0.29, 0.66, -0.48)) }
  for (let j = 0; j <= 4; j++) { g.add(box(1.18, 0.012, 0.012, cage, 0, 0.2 + j * 0.25, 0.48)); g.add(box(1.18, 0.012, 0.012, cage, 0, 0.2 + j * 0.25, -0.48)) }
  g.add(cyl(0.12, 0.12, 0.05, cmat('#222'), 0.2, 1.17, 0.2, 12))
  A(g, cyl(0.025, 0.025, 0.12, cmat('#222'), 0, 0.22, 0.55, 8), (m) => { m.rotation.x = Math.PI / 2 })
  return g
}

export const tankPoly: Builder = (item, obj) => {
  const t = TANK_POLY[String(obj.params.liters ?? '3000')] ?? TANK_POLY['3000']
  const g = new THREE.Group()
  const wood = M().woodDark
  const R = t.dia / 2
  // stand
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; g.add(box(0.12, t.stand, 0.12, wood, Math.cos(a) * (R - 0.15), t.stand / 2, Math.sin(a) * (R - 0.15))) }
  g.add(box(t.dia, 0.1, t.dia, wood, 0, t.stand + 0.05, 0))
  const body = lathe([[0, 0], [R * 0.97, 0], [R, 0.1], [R, t.h - 0.2], [R * 0.9, t.h - 0.02], [R * 0.45, t.h + 0.04], [0, t.h + 0.04]], cmat('#2d4a3a', 0.45), 28)
  body.position.y = t.stand + 0.1
  g.add(body)
  g.add(cyl(R * 0.2, R * 0.2, 0.1, cmat('#1a1a1a'), 0, t.stand + 0.1 + t.h + 0.1, 0, 12))
  A(g, cyl(0.03, 0.03, 0.25, cmat('#222'), R + 0.05, t.stand + 0.35, 0, 8), (m) => { m.rotation.z = Math.PI / 2 })
  // ladder
  for (const s of [-1, 1]) g.add(box(0.03, t.stand + t.h, 0.03, M().galvanised, -R * 0.6 + s * 0.2, (t.stand + t.h) / 2, R * 0.85))
  for (let i = 0; i < 8; i++) g.add(box(0.4, 0.025, 0.025, M().galvanised, -R * 0.6, 0.3 + i * (t.stand + t.h - 0.4) / 8, R * 0.85))
  return g
}

export const well: Builder = () => {
  const g = new THREE.Group()
  const ring = lathe([[0.42, 0], [0.52, 0], [0.5, 0.8], [0.4, 0.8]], M().stone, 20)
  ring.position.y = 0.0; g.add(ring)
  g.add(cyl(0.4, 0.4, 0.04, M().woodDark, 0, 0.8, 0, 20))
  // hand pump
  const iron = cmat('#2b3a44', 0.45, 0.8)
  g.add(cyl(0.07, 0.09, 0.7, iron, 0, 1.15, 0, 10))
  g.add(cyl(0.12, 0.12, 0.12, iron, 0, 1.55, 0, 10))
  const handle = box(0.7, 0.04, 0.05, iron, 0.25, 1.66, 0); handle.rotation.z = 0.35; g.add(handle)
  A(g, cyl(0.025, 0.025, 0.25, iron, 0.22, 1.1, 0, 8), (m) => { m.rotation.z = Math.PI / 2 - 0.2 })
  return g
}

export const pond: Builder = (item, obj, ctx) => {
  const D = P(obj, 'diameter', 5)
  const g = new THREE.Group()
  const R = D / 2
  const bank = new THREE.Mesh(new THREE.TorusGeometry(R, 0.16, 8, 36), cmat('#7a6a55', 1)); bank.geometry.userData.owned = true
  bank.rotation.x = Math.PI / 2; bank.position.y = 0.04; bank.scale.set(1, 1, 0.9); g.add(bank)
  const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 36), new THREE.MeshStandardMaterial({ color: 0x2c5560, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.93, envMapIntensity: 2 })); water.geometry.userData.owned = true
  water.rotation.x = -Math.PI / 2; water.position.y = 0.1; g.add(water)
  const rnd = rng(obj)
  for (let i = 0; i < 40; i++) { const a = rnd() * 6.28; g.add(sphere(0.1 + rnd() * 0.12, M().stone, Math.cos(a) * (R + 0.05), 0.05, Math.sin(a) * (R + 0.05), 1, 0.6, 1)) }
  for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, r = rnd() * R * 0.7; const pad = cyl(0.18, 0.18, 0.01, cmat('#4a8a3a', 0.6), Math.cos(a) * r, 0.11, Math.sin(a) * r, 10); g.add(pad) }
  void ctx
  return g
}

export const solar: Builder = (item, obj) => {
  const W = P(obj, 'panels', 5)
  const g = new THREE.Group()
  const panelM = new THREE.MeshStandardMaterial({ color: 0x1a2744, roughness: 0.2, metalness: 0.6 })
  const tilt = (32 * Math.PI) / 180
  const frame = M().galvanised
  const n = Math.round(W)
  for (let i = 0; i < n; i++) {
    const p = box(1.0, 0.04, 2.0, panelM, -W / 2 + 0.5 + i, 0, 0)
    const holder = new THREE.Group()
    holder.add(p)
    holder.rotation.x = tilt // panel faces south (+z side lower => front edge low)
    holder.position.set(0, 1.0, 0)
    g.add(holder)
  }
  void frame
  for (let i = 0; i <= Math.max(1, Math.round(W / 2.5)); i++) {
    const x = -W / 2 + (W * i) / Math.max(1, Math.round(W / 2.5))
    g.add(box(0.06, 1.5, 0.06, frame, x, 0.7, -0.75))
    g.add(box(0.06, 0.5, 0.06, frame, x, 0.25, 0.8))
  }
  return g
}

export const tap: Builder = () => {
  const g = new THREE.Group()
  g.add(cyl(0.04, 0.04, 0.8, M().galvanised, 0, 0.4, 0, 8))
  A(g, cyl(0.02, 0.02, 0.12, M().galvanised, 0.05, 0.8, 0, 8), (m) => { m.rotation.z = Math.PI / 2 })
  g.add(box(0.5, 0.05, 0.5, M().gravel, 0, 0.025, 0.1))
  g.add(cyl(0.03, 0.03, 0.05, cmat('#c0392b'), 0, 0.85, 0, 8))
  return g
}

export const sink: Builder = () => {
  const g = new THREE.Group()
  g.add(box(1.4, 0.08, 0.7, M().woodPlain, 0, 0.9, 0))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.07, 0.9, 0.07, M().woodDark, sx * 0.65, 0.45, sz * 0.3))
  g.add(box(0.5, 0.03, 0.4, M().galvanised, -0.3, 0.94, 0))
  g.add(cyl(0.02, 0.02, 0.35, M().galvanised, -0.3, 1.1, -0.25, 8))
  g.add(box(1.4, 0.3, 0.03, M().woodPlain, 0, 1.1, -0.34))
  return g
}

export const bench: Builder = () => {
  const g = new THREE.Group()
  const w = M().woodPlain, d = M().woodDark
  g.add(box(1.6, 0.05, 0.45, w, 0, 0.45, 0), box(1.6, 0.4, 0.04, w, 0, 0.7, -0.22))
  for (const sx of [-1, 1]) { g.add(box(0.06, 0.45, 0.4, d, sx * 0.7, 0.22, 0)); g.add(box(0.06, 0.4, 0.05, d, sx * 0.7, 0.65, -0.22)) }
  return g
}

export const picnic: Builder = () => {
  const g = new THREE.Group()
  const w = M().woodPlain, d = M().woodDark
  g.add(box(2, 0.05, 0.75, w, 0, 0.75, 0))
  for (const s of [-1, 1]) g.add(box(2, 0.05, 0.3, w, 0, 0.45, s * 0.7))
  for (const sx of [-1, 1]) {
    const a = box(0.06, 0.9, 0.06, d, sx * 0.8, 0.4, 0.2); a.rotation.x = 0.35; g.add(a)
    const b = box(0.06, 0.9, 0.06, d, sx * 0.8, 0.4, -0.2); b.rotation.x = -0.35; g.add(b)
    g.add(box(0.06, 0.06, 1.55, d, sx * 0.8, 0.43, 0))
  }
  return g
}

export const lightPost: Builder = () => {
  const g = new THREE.Group()
  g.add(cyl(0.04, 0.05, 3, cmat('#2a2f33', 0.4, 0.7), 0, 1.5, 0, 8))
  g.add(sphere(0.12, new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffe9a0, emissiveIntensity: 0.6 }), 0, 3.05, 0))
  g.add(cyl(0.16, 0.12, 0.05, cmat('#2a2f33', 0.4, 0.7), 0, 3.2, 0, 10))
  return g
}

export const parking: Builder = (item, obj, ctx) => {
  const W = P(obj, 'width', 3), D = P(obj, 'depth', 5.5)
  const g = new THREE.Group()
  g.add(drapedRect(ctx, obj, W, D, M().gravel, 0.04, undefined, 0.5))
  return g
}

export const levelPad: Builder = (item, obj) => {
  const W = P(obj, 'width', 4), D = P(obj, 'depth', 4)
  const g = new THREE.Group()
  g.add(box(W, 0.04, D, cmat('#6f8a4a', 1), 0, 0.02, 0, false))
  const e = cmat('#8a8478', 0.95)
  g.add(box(W + 0.2, 0.12, 0.1, e, 0, 0.06, D / 2 + 0.05), box(W + 0.2, 0.12, 0.1, e, 0, 0.06, -D / 2 - 0.05), box(0.1, 0.12, D, e, W / 2 + 0.05, 0.06, 0), box(0.1, 0.12, D, e, -W / 2 - 0.05, 0.06, 0))
  return g
}

export const steps: Builder = (item, obj, ctx) => {
  const W = P(obj, 'width', 1.2), L = P(obj, 'length', 2.4)
  const g = new THREE.Group()
  const n = Math.max(2, Math.round(L / 0.32))
  const stone = M().stone
  for (let i = 0; i < n; i++) {
    const z0 = -L / 2 + (L * i) / n, z1 = -L / 2 + (L * (i + 1)) / n
    const gz = groundRel(ctx, obj, 0, (z0 + z1) / 2)
    const top = Math.round(gz / 0.17) * 0.17 + 0.05
    const lo = gz - 0.4
    g.add(box(W, top - lo, z1 - z0 + 0.0, stone, 0, (top + lo) / 2, (z0 + z1) / 2))
  }
  return g
}

export const gate: Builder = (item, obj) => {
  const W = P(obj, 'width', 1.2)
  const g = new THREE.Group()
  const green = M().gateGreen
  for (const s of [-1, 1]) g.add(box(0.1, 1.5, 0.1, M().woodDark, s * (W / 2 + 0.05), 0.75, 0))
  g.add(box(W, 0.05, 0.05, green, 0, 1.25, 0), box(W, 0.05, 0.05, green, 0, 0.2, 0))
  for (const s of [-1, 1]) g.add(box(0.05, 1.05, 0.05, green, s * (W / 2 - 0.03), 0.72, 0))
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, 1.0), M().wire); m.geometry.userData.owned = true; m.position.set(0, 0.72, 0); g.add(m)
  const br = box(Math.hypot(W, 1.05), 0.03, 0.03, green, 0, 0.72, 0); br.rotation.z = Math.atan2(1.05, W); g.add(br)
  return g
}

export const human: Builder = () => {
  const g = new THREE.Group()
  const skin = cmat('#d8a888', 0.8), shirt = cmat('#3c6e9e', 0.9), pants = cmat('#3a3a42', 0.9), shoe = cmat('#222', 0.8)
  for (const s of [-1, 1]) {
    g.add(cyl(0.055, 0.045, 0.85, pants, s * 0.09, 0.45, 0, 8))
    g.add(box(0.1, 0.07, 0.24, shoe, s * 0.09, 0.035, 0.04))
    g.add(cyl(0.04, 0.035, 0.6, shirt, s * 0.24, 1.2, 0, 8))
    g.add(sphere(0.04, skin, s * 0.24, 0.88, 0))
  }
  g.add(box(0.36, 0.56, 0.2, shirt, 0, 1.2, 0))
  g.add(cyl(0.05, 0.05, 0.08, skin, 0, 1.52, 0, 8))
  g.add(sphere(0.105, skin, 0, 1.64, 0, 0.9, 1.1, 0.95))
  g.add(sphere(0.108, cmat('#3a2a1e', 0.9), 0, 1.68, -0.01, 0.9, 0.8, 0.95))
  return g
}

export const car: Builder = () => {
  const g = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial({ color: 0x7d8a96, roughness: 0.3, metalness: 0.7 })
  g.add(box(4.4, 0.7, 1.8, paint, 0, 0.7, 0))
  const cab = box(2.3, 0.6, 1.62, paint, -0.2, 1.3, 0)
  g.add(cab)
  const glass = cmat('#10181c', 0.1, 0.4)
  g.add(box(2.1, 0.45, 1.64, glass, -0.2, 1.32, 0, false))
  for (const x of [-1.4, 1.4]) for (const z of [-0.85, 0.85]) {
    const w = cyl(0.33, 0.33, 0.22, cmat('#151515', 0.9), x, 0.33, z, 16); w.rotation.x = Math.PI / 2; g.add(w)
  }
  g.add(box(0.05, 0.12, 0.3, cmat('#fff4b0', 0.2), 2.2, 0.75, 0.6, false), box(0.05, 0.12, 0.3, cmat('#fff4b0', 0.2), 2.2, 0.75, -0.6, false))
  g.add(box(0.05, 0.12, 0.3, cmat('#a01818', 0.2), -2.2, 0.75, 0.6, false), box(0.05, 0.12, 0.3, cmat('#a01818', 0.2), -2.2, 0.75, -0.6, false))
  return g
}
export const glbPlaceholder: Builder = (item, obj) => {
  const W = P(obj, 'width', 2), D = P(obj, 'depth', 2)
  const g = new THREE.Group()
  const m = box(W, 1.5, D, new THREE.MeshStandardMaterial({ color: 0x8899aa, wireframe: false, transparent: true, opacity: 0.6 }), 0, 0.75, 0)
  g.add(m)
  g.userData.glb = true
  return g
}
