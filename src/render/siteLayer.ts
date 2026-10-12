import * as THREE from 'three'
import type { Terrain } from '../core/terrain'
import type { GateDef, HouseDef, SiteConfig } from '../core/types'
import { mats } from './materials'

interface EdgeFrame {
  /** canonical start, direction, length */
  ox: number; oz: number; dx: number; dz: number; len: number
}

export function edgeFrame(site: SiteConfig, edge: GateDef['edge']): EdgeFrame {
  const W = site.width, D = site.depth
  switch (edge) {
    case 'north': return { ox: 0, oz: 0, dx: 1, dz: 0, len: W }
    case 'south': return { ox: 0, oz: D, dx: 1, dz: 0, len: W }
    case 'west': return { ox: 0, oz: 0, dx: 0, dz: 1, len: D }
    case 'east': return { ox: W, oz: 0, dx: 0, dz: 1, len: D }
  }
}

const EDGES: GateDef['edge'][] = ['north', 'east', 'south', 'west']

/** Positions along an edge (canonical param) where fence panels start/stop, excluding gate openings. */
export function fenceLayout(site: SiteConfig, edge: GateDef['edge']) {
  const f = edgeFrame(site, edge)
  const gates = site.gates.filter((g) => g.edge === edge).map((g) => ({ a: g.offset, b: g.offset + g.width, g }))
    .sort((p, q) => p.a - q.a)
  const n = Math.max(1, Math.round(f.len / site.fence.postSpacing))
  const pts = new Set<number>([0, f.len])
  for (let i = 1; i < n; i++) pts.add((f.len * i) / n)
  for (const g of gates) { pts.add(g.a); pts.add(g.b) }
  let arr = [...pts].sort((a, b) => a - b)
  // drop uniform posts inside gate spans or too near gate posts
  arr = arr.filter((s) => {
    const isGateBound = gates.some((g) => Math.abs(g.a - s) < 1e-6 || Math.abs(g.b - s) < 1e-6)
    if (isGateBound) return true
    if (gates.some((g) => s > g.a - 0.6 && s < g.b + 0.6)) return false
    return true
  })
  const panels: [number, number][] = []
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i], b = arr[i + 1]
    const mid = (a + b) / 2
    if (gates.some((g) => mid > g.a && mid < g.b)) continue
    panels.push([a, b])
  }
  return { frame: f, posts: arr, panels, gates }
}

function ribbon(terrain: Terrain, f: EdgeFrame, s0: number, s1: number, H: number, bottomOff: number, out: { p: number[]; uv: number[]; idx: number[] }) {
  const steps = Math.max(1, Math.ceil((s1 - s0) / 0.5))
  const base = out.p.length / 3
  for (let i = 0; i <= steps; i++) {
    const s = s0 + ((s1 - s0) * i) / steps
    const x = f.ox + f.dx * s, z = f.oz + f.dz * s
    const h = terrain.heightAt(x, z)
    out.p.push(x, h + bottomOff, z, x, h + H, z)
    out.uv.push(s, bottomOff, s, H)
  }
  for (let i = 0; i < steps; i++) {
    const a = base + i * 2
    out.idx.push(a, a + 1, a + 3, a, a + 3, a + 2)
  }
}

export interface SiteBuild {
  group: THREE.Group
  house: THREE.Group
  houseBox: { cx: number; cz: number; w: number; d: number; floorY: number }
  /** extra pad for the terrain under the house */
  housePad: { cx: number; cz: number; w: number; d: number; level: number }
}

export function housePlacement(site: SiteConfig, terrain: { baseHeightAt(x: number, z: number): number }) {
  const h = site.house
  const cx = site.width / 2 + h.offsetX
  const cz = site.depth - h.setbackSouth - h.depth / 2
  const level = terrain.baseHeightAt(cx, cz)
  return { cx, cz, w: h.width, d: h.depth, level }
}

export function buildFence(site: SiteConfig, terrain: Terrain): THREE.Group {
  const M = mats()
  const g = new THREE.Group()
  g.name = 'fence'
  const H = site.fence.height
  const mesh = { p: [] as number[], uv: [] as number[], idx: [] as number[] }
  const postMats: THREE.Matrix4[] = []
  const gatePostMats: THREE.Matrix4[] = []
  const railMats: THREE.Matrix4[] = []
  const tmp = new THREE.Object3D()

  const addCyl = (list: THREE.Matrix4[], x: number, y0: number, y1: number, z: number, sx = 1) => {
    tmp.position.set(x, (y0 + y1) / 2, z)
    tmp.scale.set(sx, y1 - y0, sx)
    tmp.rotation.set(0, 0, 0)
    tmp.updateMatrix()
    list.push(tmp.matrix.clone())
  }
  const addRail = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number) => {
    const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1)
    const len = a.distanceTo(b)
    tmp.position.copy(a).add(b).multiplyScalar(0.5)
    tmp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    tmp.scale.set(r, len, r)
    tmp.updateMatrix()
    railMats.push(tmp.matrix.clone())
  }

  for (const edge of EDGES) {
    const { frame: f, posts, panels, gates } = fenceLayout(site, edge)
    for (const [a, b] of panels) {
      ribbon(terrain, f, a, b, H - 0.05, 0.02, mesh)
      const steps = Math.max(1, Math.ceil((b - a) / 0.5))
      for (let i = 0; i < steps; i++) {
        const s0 = a + ((b - a) * i) / steps, s1 = a + ((b - a) * (i + 1)) / steps
        const p0 = [f.ox + f.dx * s0, f.oz + f.dz * s0], p1 = [f.ox + f.dx * s1, f.oz + f.dz * s1]
        const h0 = terrain.heightAt(p0[0], p0[1]), h1 = terrain.heightAt(p1[0], p1[1])
        addRail(p0[0], h0 + H, p0[1], p1[0], h1 + H, p1[1], 0.014)
        addRail(p0[0], h0 + 0.06, p0[1], p1[0], h1 + 0.06, p1[1], 0.006)
        addRail(p0[0], h0 + H * 0.5, p0[1], p1[0], h1 + H * 0.5, p1[1], 0.004)
      }
    }
    for (const s of posts) {
      const x = f.ox + f.dx * s, z = f.oz + f.dz * s
      const y = terrain.heightAt(x, z)
      const isGate = gates.some((gt) => Math.abs(gt.a - s) < 1e-6 || Math.abs(gt.b - s) < 1e-6)
      if (isGate) addCyl(gatePostMats, x, y - 0.4, y + H + 0.25, z, 0.05)
      else addCyl(postMats, x, y - 0.35, y + H + 0.08, z, site.fence.postRadius * 2)
    }
    // gates
    for (const gt of gates) g.add(buildGate(site, terrain, f, gt.g))
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(mesh.p, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uv, 2))
  geo.setIndex(mesh.idx)
  geo.computeVertexNormals()
  const wire = new THREE.Mesh(geo, M.wire)
  wire.name = 'fence-wire'
  g.add(wire)

  const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10)
  const mk = (list: THREE.Matrix4[], mat: THREE.Material, cast: boolean) => {
    const im = new THREE.InstancedMesh(cyl, mat, Math.max(1, list.length))
    list.forEach((m, i) => im.setMatrixAt(i, m))
    im.count = list.length
    im.castShadow = cast
    im.receiveShadow = true
    g.add(im)
  }
  mk(postMats, M.galvanised, true)
  mk(gatePostMats, M.gateGreen, true)
  mk(railMats, M.galvanised, false)
  return g
}

function bar(a: THREE.Vector3, b: THREE.Vector3, t: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b)
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function buildGate(site: SiteConfig, terrain: Terrain, f: EdgeFrame, gate: GateDef): THREE.Group {
  const M = mats()
  const g = new THREE.Group()
  g.name = `gate-${gate.id}`
  const H = site.fence.height
  const leaves = gate.kind === 'vehicle' ? 2 : 1
  const w = gate.width / leaves
  const pt = (s: number, y: number) => {
    const x = f.ox + f.dx * s, z = f.oz + f.dz * s
    return new THREE.Vector3(x, terrain.heightAt(x, z) + y, z)
  }
  const gap = 0.05, bottom = 0.12
  for (let l = 0; l < leaves; l++) {
    const s0 = gate.offset + l * w + (l === 0 ? gap : gap / 2), s1 = gate.offset + (l + 1) * w - (l === leaves - 1 ? gap : gap / 2)
    const bl = pt(s0, bottom), br = pt(s1, bottom), tl = pt(s0, H - 0.05), tr = pt(s1, H - 0.05)
    const t = 0.045
    g.add(bar(bl, tl, t, M.gateGreen), bar(br, tr, t, M.gateGreen), bar(bl, br, t, M.gateGreen), bar(tl, tr, t, M.gateGreen))
    g.add(bar(bl, tr, 0.03, M.gateGreen))
    const mid1 = pt((s0 + s1) / 2, H * 0.5)
    g.add(bar(pt(s0, H * 0.5), pt(s1, H * 0.5), 0.03, M.gateGreen))
    void mid1
    // mesh infill
    const out = { p: [] as number[], uv: [] as number[], idx: [] as number[] }
    ribbon(terrain, f, s0, s1, H - 0.08, bottom + 0.03, out)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out.p, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2))
    geo.setIndex(out.idx)
    geo.computeVertexNormals()
    g.add(new THREE.Mesh(geo, M.wire))
  }
  // latch
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), M.metalDark)
  latch.position.copy(pt(gate.offset + gate.width / 2, 1.0))
  g.add(latch)
  return g
}

// ------------------------------------------------------------------------------------------------

function wallShape(L: number, H: number, rise: number, openings: { cx: number; w: number; h: number; sill: number }[]) {
  const s = new THREE.Shape()
  s.moveTo(0, 0); s.lineTo(L, 0); s.lineTo(L, H)
  if (rise > 0) s.lineTo(L / 2, H + rise)
  s.lineTo(0, H); s.lineTo(0, 0)
  for (const o of openings) {
    const x0 = L / 2 + o.cx - o.w / 2, x1 = x0 + o.w, y0 = o.sill, y1 = o.sill + o.h
    const h = new THREE.Path()
    h.moveTo(x0, y0); h.lineTo(x0, y1); h.lineTo(x1, y1); h.lineTo(x1, y0); h.lineTo(x0, y0)
    s.holes.push(h)
  }
  return s
}

export function buildHouse(site: SiteConfig, terrain: Terrain): { group: THREE.Group; floorY: number } {
  const M = mats()
  const h: HouseDef = site.house
  const place = housePlacement(site, terrain)
  const W = h.width, D = h.depth, T = 0.12
  const floorY = place.level + 0.25
  const pitch = (h.roofPitchDeg * Math.PI) / 180
  const rise = (D / 2) * Math.tan(pitch)
  const group = new THREE.Group()
  group.name = 'house'
  group.position.set(place.cx, floorY, place.cz)

  // foundation plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.55, D + 0.1), M.concrete)
  plinth.position.y = -0.27
  plinth.castShadow = plinth.receiveShadow = true
  group.add(plinth)

  // interior shell (visible through windows)
  const inner = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T, h.wallHeight, D - 2 * T), M.interior)
  inner.position.y = h.wallHeight / 2
  group.add(inner)

  const walls: { wall: 'south' | 'north' | 'east' | 'west'; L: number; gable: boolean }[] = [
    { wall: 'south', L: W, gable: false }, { wall: 'north', L: W, gable: false },
    { wall: 'east', L: D, gable: true }, { wall: 'west', L: D, gable: true },
  ]
  for (const w of walls) {
    const openings: { cx: number; w: number; h: number; sill: number }[] = []
    if (h.door.wall === w.wall) openings.push({ cx: h.door.offset, w: h.door.width, h: h.door.height, sill: 0 })
    for (const win of h.windows) if (win.wall === w.wall) openings.push({ cx: win.offset, w: win.width, h: win.height, sill: win.sill })
    const shape = wallShape(w.L, h.wallHeight, w.gable ? rise : 0, openings)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
    const mesh = new THREE.Mesh(geo, M.wood)
    mesh.castShadow = mesh.receiveShadow = true
    const holder = new THREE.Group()
    holder.add(mesh)
    // frames, glass, door
    for (const o of openings) {
      const isDoor = h.door.wall === w.wall && o.sill === 0 && o.cx === h.door.offset && o.w === h.door.width
      const cx = w.L / 2 + o.cx
      if (isDoor) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.04, o.h - 0.02, 0.05), M.woodDark)
        door.position.set(cx, o.h / 2, T * 0.55)
        door.castShadow = true
        holder.add(door)
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), M.metalDark)
        knob.position.set(cx + o.w / 2 - 0.1, 1.0, T * 0.55 + 0.05)
        holder.add(knob)
      } else {
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), M.glass)
        pane.position.set(cx, o.sill + o.h / 2, T * 0.5)
        holder.add(pane)
      }
      const ft = 0.05
      const fz = T + 0.012
      const fr = (fw: number, fh: number, x: number, y: number) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.03), M.trim)
        b.position.set(x, y, fz)
        b.castShadow = true
        holder.add(b)
      }
      fr(o.w + 2 * ft, ft, cx, o.sill + o.h + ft / 2)
      if (!isDoor) fr(o.w + 2 * ft, ft, cx, o.sill - ft / 2)
      fr(ft, o.h, cx - o.w / 2 - ft / 2, o.sill + o.h / 2)
      fr(ft, o.h, cx + o.w / 2 + ft / 2, o.sill + o.h / 2)
      if (!isDoor) {
        fr(0.03, o.h, cx, o.sill + o.h / 2)
        fr(o.w, 0.03, cx, o.sill + o.h / 2)
      }
    }
    switch (w.wall) {
      case 'south': holder.position.set(-W / 2, 0, D / 2 - T); break
      case 'north': holder.rotation.y = Math.PI; holder.position.set(W / 2, 0, -D / 2 + T); break
      case 'east': holder.rotation.y = Math.PI / 2; holder.position.set(W / 2 - T, 0, D / 2); break
      case 'west': holder.rotation.y = -Math.PI / 2; holder.position.set(-W / 2 + T, 0, -D / 2); break
    }
    group.add(holder)
  }

  // roof
  const o = h.overhang
  const slopeLen = (D / 2 + o) / Math.cos(pitch)
  const th = 0.07
  const ridgeY = h.wallHeight + rise
  for (const side of [1, -1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * o, th, slopeLen), M.roof)
    slab.castShadow = slab.receiveShadow = true
    const pivot = new THREE.Group()
    slab.position.set(0, -th / 2, (side * slopeLen) / 2)
    pivot.add(slab)
    pivot.rotation.x = side * pitch
    pivot.position.set(0, ridgeY + th * 0.5, 0)
    group.add(pivot)
  }
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * o + 0.04, 0.09, 0.09), M.metalDark)
  cap.rotation.x = Math.PI / 4
  cap.position.set(0, ridgeY + th * 0.5 + 0.02, 0)
  cap.castShadow = true
  group.add(cap)
  // fascia boards at eaves
  for (const side of [1, -1]) {
    const fas = new THREE.Mesh(new THREE.BoxGeometry(W + 2 * o, 0.12, 0.03), M.trim)
    fas.position.set(0, h.wallHeight - (o * Math.tan(pitch)) - 0.03, side * (D / 2 + o))
    fas.castShadow = true
    group.add(fas)
  }
  // stove pipe
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 12), M.metalDark)
  const px = W / 4, pz = -D / 4
  pipe.position.set(px, ridgeY - (D / 2 - Math.abs(pz)) * Math.tan(pitch) + 0.4, pz)
  pipe.castShadow = true
  group.add(pipe)
  // door step
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.55), M.stone)
  step.position.set(h.door.wall === 'south' ? h.door.offset : 0, -0.18, D / 2 + 0.3)
  step.castShadow = step.receiveShadow = true
  group.add(step)
  return { group, floorY }
}
