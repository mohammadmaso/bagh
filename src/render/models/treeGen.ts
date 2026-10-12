import * as THREE from 'three'
import { mulberry32 } from '../../core/noise'
import { plantSizeAt, bearsFruit } from '../../core/growth'
import type { PlantSpecies } from '../../data/plants'
import { appendTube, appendQuad, newBuf, toGeometry, type GeoBuf } from './geomUtil'

export interface TreeGeo {
  trunk: THREE.BufferGeometry
  leaves: THREE.BufferGeometry | null
  blossoms: THREE.BufferGeometry | null
  fruits: THREE.BufferGeometry | null
  height: number
  canopy: number
  crownBase: number
  crownHeight: number
  /** LOD2 blob parameters */
  blob: { cx: number; cy: number; cz: number; rx: number; ry: number; rz: number }
}

/** crown radius (m) at fraction t∈[0,1] up the crown, per growth form */
function crownRadius(form: PlantSpecies['form'], t: number, C: number): number {
  const R = C / 2
  const bell = Math.sin(Math.PI * Math.min(1, Math.max(0, t)))
  switch (form) {
    case 'round': return R * Math.pow(bell, 0.6) * (0.55 + 0.45 * Math.min(1, t * 2.5 + 0.4))
    case 'ovoid': return R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.8)
    case 'vase': return R * (0.3 + 0.7 * Math.pow(t, 0.6)) * (1 - 0.7 * Math.pow(t, 5))
    case 'columnar': return R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.55)), 0.55)
    case 'conical': return R * Math.pow(1 - t, 0.95) * (0.2 + 0.8 * Math.min(1, (t + 0.25) * 6))
    case 'spreading': return R * Math.pow(bell, 0.55) * (0.8 + 0.2 * (1 - t))
    case 'weeping': return R * Math.pow(bell, 0.5) * (1.0 - 0.15 * t)
    case 'multistem': case 'shrub': return R * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.7))
    default: return R * Math.pow(bell, 0.6)
  }
}

export function generateTree(sp: PlantSpecies, age: number, lod: 0 | 1 | 2, seed = 1, qualityScale = 1): TreeGeo {
  const rnd = mulberry32(seed * 7919 + sp.id.length * 131 + Math.floor(age * 2))
  const size = plantSizeAt(sp, age)
  const H = size.height, C = size.canopy
  const shrubby = sp.form === 'shrub' || sp.form === 'multistem'
  const Tz = shrubby ? Math.min(0.25, H * 0.1) : size.trunkHeight
  const R0 = size.trunkRadius
  const crownBase = Tz * (sp.form === 'conical' ? 0.55 : 0.92)
  const crownH = Math.max(0.1, H - crownBase)

  const trunkBuf = newBuf()
  const leafBuf = newBuf(true)
  const blossomBuf = newBuf(true)
  const fruitBuf = newBuf()
  const seg = lod === 0 ? 6 : 4
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  // ---- trunk(s)
  const stems = shrubby ? (sp.form === 'shrub' ? Math.round(5 + 6 * Math.min(1, C)) : 4 + Math.round(C)) : 1
  const leaderTop = sp.form === 'conical' || sp.form === 'columnar' ? H * 0.97 : shrubby ? H * 0.6 : Math.min(H * 0.97, crownBase + crownH * 0.78)
  if (!shrubby) {
    const pts: THREE.Vector3[] = [], rad: number[] = []
    const n = 6
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const y = leaderTop * t
      pts.push(V((rnd() - 0.5) * 0.03 * R0 * 10 * t, y, (rnd() - 0.5) * 0.03 * R0 * 10 * t))
      rad.push(R0 * (1.18 * Math.pow(1 - t, 0.15) * (1 - 0.55 * t) + (i === 0 ? 0.25 : 0)) + 0.004)
    }
    rad[n] = 0.006
    appendTube(trunkBuf, pts, rad, seg, 1 / 0.5, true)
  }

  // ---- scaffold branches & stems
  const tips: { p: THREE.Vector3; dir: THREE.Vector3; r: number }[] = []
  const golden = 2.399963
  const nBranch = shrubby ? stems : Math.max(5, Math.min(sp.form === 'conical' ? 34 : 26, Math.round((5 + C * 2.2) * (lod === 0 ? 1 : 0.6))))
  for (let i = 0; i < nBranch; i++) {
    const t = shrubby ? 0.05 + 0.1 * rnd() : (i + 0.5) / nBranch
    const y0 = shrubby ? 0.05 : crownBase + (leaderTop - crownBase) * Math.pow(t, 0.9) * 0.97
    const tc = shrubby ? t : Math.min(1, Math.max(0, (y0 - crownBase) / crownH))
    const phi = i * golden + rnd() * 0.5
    let elev: number
    switch (sp.form) {
      case 'columnar': elev = 62 + rnd() * 18; break
      case 'conical': elev = 8 + 22 * tc + rnd() * 12; break // lower tiers droop outward
      case 'weeping': case 'spreading': elev = 28 + rnd() * 22 - 10 * (1 - tc); break
      case 'vase': elev = 42 + rnd() * 16; break
      case 'multistem': case 'shrub': elev = 55 + rnd() * 20; break
      default: elev = 55 - 30 * (1 - tc) + rnd() * 14 - (tc > 0.8 ? 0 : 0)
    }
    const targetR = shrubby ? crownRadius(sp.form, 0.5 + 0.4 * rnd(), C) : crownRadius(sp.form, tc, C)
    const ce = Math.cos((elev * Math.PI) / 180), se = Math.sin((elev * Math.PI) / 180)
    const dir = V(ce * Math.cos(phi), se, ce * Math.sin(phi))
    let len = shrubby ? Math.max(0.2, H * (0.7 + rnd() * 0.3)) / Math.max(0.35, se) * 0.62 : Math.max(0.12, targetR / Math.max(0.25, ce)) * 0.95
    if (!shrubby) len = Math.min(len, Math.max(0.15, (crownBase + crownH * 0.97 - y0) / Math.max(0.2, se)))
    const start = V(shrubby ? (rnd() - 0.5) * 0.15 * C : 0, y0, shrubby ? (rnd() - 0.5) * 0.15 * C : 0)
    const pts: THREE.Vector3[] = [start.clone()], rad: number[] = []
    const steps = lod === 0 ? 4 : 3
    const droop = sp.form === 'weeping' ? 0.5 : sp.form === 'spreading' ? 0.22 : sp.form === 'columnar' ? 0 : 0.14
    const d = dir.clone()
    const stepLen = len / steps
    const rb = Math.max(0.004, R0 * (shrubby ? 0.55 : 0.5) * Math.min(1, len / (C * 0.5 + 0.2)) * (1 - 0.35 * tc))
    for (let k = 1; k <= steps; k++) {
      d.y -= droop * (k / steps) * 0.5
      d.normalize()
      pts.push(pts[k - 1].clone().addScaledVector(d, stepLen))
    }
    for (let k = 0; k <= steps; k++) rad.push(Math.max(0.003, rb * (1 - 0.82 * (k / steps))))
    appendTube(trunkBuf, pts, rad, seg, 1 / 0.5)
    tips.push({ p: pts[steps].clone(), dir: d.clone(), r: rad[steps] })
    // sub-branches
    if (lod < 2 && !shrubby) {
      const nSub = lod === 0 ? 3 : 1
      for (let s = 0; s < nSub; s++) {
        const k = 2 + (s % Math.max(1, steps - 1))
        const base = pts[Math.min(k, steps)]
        const sd = d.clone().applyAxisAngle(V(0, 1, 0), (s % 2 ? 1 : -1) * (0.7 + rnd() * 0.5)).add(V(0, 0.25 * rnd(), 0)).normalize()
        const sl = len * (0.28 + rnd() * 0.18)
        const sp2 = [base.clone(), base.clone().addScaledVector(sd, sl * 0.5), base.clone().addScaledVector(sd, sl)]
        sp2[2].y -= droop * sl * 0.15
        appendTube(trunkBuf, sp2, [rad[Math.min(k, steps)] * 0.55 + 0.002, rad[Math.min(k, steps)] * 0.35 + 0.002, 0.002], 4, 1 / 0.5)
        tips.push({ p: sp2[2], dir: sd, r: 0.003 })
      }
    }
  }

  // ---- foliage cards placed in the crown envelope shell
  const lf = sp.leaf
  const cardW = Math.max(0.05, lf.size * (lf.kind === 'needle' ? 2.9 : 4.2)) * (lod === 0 ? 1 : lod === 1 ? 1.7 : 2.6) * Math.min(1, 0.45 + size.fraction * 0.6 + 0.2)
  const crownSurface = Math.PI * C * Math.max(C, crownH) * (shrubby ? 0.9 : 1)
  const density = lf.density * (shrubby ? 1.3 : 1)
  const maxCards = (lod === 0 ? 3200 : 700) * qualityScale
  const cardCount = Math.round(Math.min(maxCards, Math.max(24, (crownSurface * 2.3 * density) / (cardW * cardW))))
  const centre = V(0, crownBase + crownH * 0.5, 0)
  const nrm = V(0, 0, 0), right = V(0, 0, 0), up = V(0, 0, 0), pos = V(0, 0, 0)
  const addCard = (buf: GeoBuf, p: THREE.Vector3, outward: THREE.Vector3, w: number, rr: number, sway: number) => {
    nrm.copy(outward).multiplyScalar(0.75).add(V(rnd() - 0.5, rnd() - 0.5 + 0.15, rnd() - 0.5).multiplyScalar(0.9)).normalize()
    right.set(rnd() - 0.5, rnd() - 0.2, rnd() - 0.5).cross(nrm).normalize()
    if (right.lengthSq() < 1e-4) right.set(1, 0, 0)
    up.crossVectors(nrm, right).normalize()
    const roll = rnd() * Math.PI * 2, cs = Math.cos(roll), sn = Math.sin(roll)
    const r2 = right.clone().multiplyScalar(cs).addScaledVector(up, sn).multiplyScalar(w * 0.5)
    const u2 = up.clone().multiplyScalar(cs).addScaledVector(right, -sn).multiplyScalar(w * 0.5)
    appendQuad(buf, p, r2, u2, outward, rr, sway)
  }
  const placeInCrown = () => {
    const t = Math.pow(rnd(), 0.85)
    const rMax = crownRadius(sp.form, t, C)
    const rho = 0.25 + 0.75 * Math.sqrt(rnd())
    const phi = rnd() * Math.PI * 2
    const y = crownBase + t * crownH
    pos.set(Math.cos(phi) * rMax * rho, y, Math.sin(phi) * rMax * rho)
    if (sp.form === 'weeping') pos.y -= rho * rho * 0.35 * crownH * 0.3
    if (shrubby) pos.y = Math.max(0.08, pos.y)
    const out = pos.clone().sub(centre)
    out.y *= 0.6
    out.normalize()
    return { p: pos.clone(), out, rho, t }
  }
  const allDeciduousPlaceholder = true
  void allDeciduousPlaceholder
  for (let i = 0; i < cardCount; i++) {
    const c = placeInCrown()
    addCard(leafBuf, c.p, c.out, cardW * (0.85 + rnd() * 0.5), rnd(), 0.35 + c.rho * 0.65)
  }
  // a few cards at branch tips so twigs end in leaves
  for (const tp of tips) {
    const k = lod === 0 ? 2 : 1
    for (let j = 0; j < k; j++) addCard(leafBuf, tp.p.clone().add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(cardW * 0.4)), tp.dir.clone().add(V(0, 0.3, 0)).normalize(), cardW, rnd(), 0.9)
  }

  // ---- blossom cards
  if (sp.blossom && lod === 0) {
    const n = Math.round(cardCount * 0.7)
    const bw = Math.max(0.06, sp.blossom.size * 3.4) * Math.min(1, 0.5 + size.fraction)
    for (let i = 0; i < n; i++) {
      const c = placeInCrown()
      const p2 = c.p.clone().multiplyScalar(1.0).add(c.out.clone().multiplyScalar(cardW * 0.25))
      addCard(blossomBuf, p2, c.out, bw * (0.8 + rnd() * 0.6), rnd(), 0.4 + c.rho * 0.6)
    }
  }

  // ---- fruit
  if (sp.fruit && lod === 0 && bearsFruit(sp, age)) {
    const frac = Math.min(1, 0.25 + (age - sp.yearsToFruit) / (sp.matureYears * 0.7))
    const n = Math.max(3, Math.round(sp.fruit.count * Math.pow(size.fraction, 1.2) * frac))
    const fs = sp.fruit.size
    const ico = new THREE.IcosahedronGeometry(1, 1)
    for (let i = 0; i < n; i++) {
      const c = placeInCrown()
      const p = c.p.clone().add(c.out.clone().multiplyScalar(0.0))
      p.y -= 0.05 * cardW
      const base = fruitBuf.pos.length / 3
      const s = fs * (0.85 + rnd() * 0.3)
      const ip = ico.getAttribute('position'), inn = ico.getAttribute('normal')
      for (let k = 0; k < ip.count; k++) {
        fruitBuf.pos.push(p.x + ip.getX(k) * s, p.y + ip.getY(k) * s * (sp.id === 'pear' ? 1.25 : 1), p.z + ip.getZ(k) * s)
        fruitBuf.nor.push(inn.getX(k), inn.getY(k), inn.getZ(k))
        fruitBuf.uv.push(0, 0)
      }
      for (let k = 0; k < ip.count; k++) fruitBuf.idx.push(base + k)
    }
    ico.dispose()
  }

  const rho = crownRadius(sp.form, 0.5, C)
  return {
    trunk: toGeometry(trunkBuf),
    leaves: leafBuf.pos.length ? toGeometry(leafBuf) : null,
    blossoms: blossomBuf.pos.length ? toGeometry(blossomBuf) : null,
    fruits: fruitBuf.pos.length ? toGeometry(fruitBuf) : null,
    height: H, canopy: C, crownBase, crownHeight: crownH,
    blob: { cx: 0, cy: crownBase + crownH * 0.5, cz: 0, rx: Math.max(rho, C / 2) * 0.95, ry: crownH / 2, rz: Math.max(rho, C / 2) * 0.95 },
  }
}
