import * as THREE from 'three'
import type { EngineContext, EngineLayer } from './engine'
import { landscapeHeight } from '../core/landscape'
import { mulberry32, fbm } from '../core/noise'

/** Low-detail surroundings: neighbouring fenced plots with huts and trees, plus conifer forest on the hills. All instanced. */
export class ContextLayer implements EngineLayer {
  readonly group = new THREE.Group()
  private lastKey = ''

  constructor() { this.group.name = 'context' }

  sync(ctx: EngineContext) {
    const s = ctx.project.site
    const key = `${s.width}|${s.depth}|${s.aspectDeg}|${s.slopeDeg}|${s.crossSlopeDeg}|${ctx.terrainRev}`
    if (key === this.lastKey) return
    this.lastKey = key
    this.group.traverse((o: any) => { o.geometry?.dispose?.() })
    this.group.clear()
    const t = ctx.terrain
    const H = (x: number, z: number) => landscapeHeight(t, x, z)
    const rnd = mulberry32(12345)
    const W = s.width, D = s.depth

    // ---- neighbouring plots (same footprint as ours, offset by a 4 m lane)
    const lane = 4
    const plots: { x: number; z: number }[] = []
    for (const dx of [-1, 0, 1]) for (const dz of [-1, 0]) { if (dx || dz) plots.push({ x: dx * (W + lane), z: dz * (D + lane) }) } // none to the south: the slope drops away there
    plots.push({ x: -(W + lane) * 2, z: 0 }, { x: (W + lane) * 2, z: 0 }, { x: 0, z: -(D + lane) * 2 }, { x: (W + lane), z: -(D + lane) * 2 }, { x: -(W + lane), z: -(D + lane) * 2 }, { x: -(W + lane) * 2, z: D + lane })
    const hutGeo = new THREE.BoxGeometry(1, 1, 1)
    const roofGeo = (() => { const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0, 0.35); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g })()
    const huts = new THREE.InstancedMesh(hutGeo, new THREE.MeshStandardMaterial({ color: 0xb59a78, roughness: 0.9 }), plots.length * 2)
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x7a4a3c, roughness: 0.7, metalness: 0.3 }), plots.length * 2)
    const canopyGeo = new THREE.IcosahedronGeometry(1, 1)
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 5)
    const maxTrees = plots.length * 14
    const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), maxTrees)
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 1 }), maxTrees)
    const fenceVerts: number[] = []
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color()
    let hi = 0, ti = 0
    plots.forEach((p, pi) => {
      const x0 = p.x, z0 = p.z
      // fence: low-detail rails around the plot
      const edge = (ax: number, az: number, bx: number, bz: number) => {
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3))
        for (let i = 0; i < n; i++) {
          const x1 = ax + ((bx - ax) * i) / n, z1 = az + ((bz - az) * i) / n, x2 = ax + ((bx - ax) * (i + 1)) / n, z2 = az + ((bz - az) * (i + 1)) / n
          for (const hh of [0.3, 1.2]) fenceVerts.push(x1, H(x1, z1) + hh, z1, x2, H(x2, z2) + hh, z2)
          fenceVerts.push(x1, H(x1, z1), z1, x1, H(x1, z1) + 1.2, z1)
        }
      }
      edge(x0, z0, x0 + W, z0); edge(x0 + W, z0, x0 + W, z0 + D); edge(x0 + W, z0 + D, x0, z0 + D); edge(x0, z0 + D, x0, z0)
      // 1–2 huts
      const nh = rnd() > 0.35 ? 2 : 1
      for (let k = 0; k < nh; k++) {
        const hx = x0 + 4 + rnd() * (W - 10), hz = z0 + 4 + rnd() * (D - 10)
        const w = 3 + rnd() * 3, d = 3 + rnd() * 2, h = 2.4
        const gy = H(hx, hz)
        q.setFromEuler(new THREE.Euler(0, rnd() > 0.5 ? 0 : Math.PI / 2, 0))
        m.compose(new THREE.Vector3(hx, gy + h / 2, hz), q, new THREE.Vector3(w, h, d)); huts.setMatrixAt(hi, m)
        m.compose(new THREE.Vector3(hx, gy + h, hz), q, new THREE.Vector3(w + 0.5, h * 1.0, d + 0.4)); roofs.setMatrixAt(hi, m)
        c.setHSL(0.08 + rnd() * 0.04, 0.3, 0.55 + rnd() * 0.2, THREE.SRGBColorSpace); huts.setColorAt(hi, c)
        hi++
      }
      // orchard-ish trees
      const nt = 6 + Math.floor(rnd() * 8)
      for (let k = 0; k < nt && ti < maxTrees; k++) {
        const tx = x0 + 2 + rnd() * (W - 4), tz = z0 + 2 + rnd() * (D - 4)
        const gy = H(tx, tz), r = 1.1 + rnd() * 1.3, th = 1.4 + rnd() * 1.2
        m.compose(new THREE.Vector3(tx, gy + th / 2, tz), new THREE.Quaternion(), new THREE.Vector3(1, th, 1)); trunks.setMatrixAt(ti, m)
        m.compose(new THREE.Vector3(tx, gy + th + r * 0.7, tz), new THREE.Quaternion(), new THREE.Vector3(r, r * 0.85, r)); canopies.setMatrixAt(ti, m)
        c.setHSL(0.24 + rnd() * 0.07, 0.4, 0.2 + rnd() * 0.1, THREE.SRGBColorSpace); canopies.setColorAt(ti, c)
        ti++
      }
      void pi
    })
    huts.count = roofs.count = hi; canopies.count = trunks.count = ti
    for (const mm of [huts, roofs, canopies, trunks]) { mm.castShadow = false; mm.receiveShadow = false; mm.instanceMatrix.needsUpdate = true; if (mm.instanceColor) mm.instanceColor.needsUpdate = true; mm.frustumCulled = false }
    const fence = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(fenceVerts, 3)), new THREE.LineBasicMaterial({ color: 0x9aa09a, transparent: true, opacity: 0.8 }))
    fence.frustumCulled = false
    this.group.add(huts, roofs, canopies, trunks, fence)

    // ---- conifer forest on the surrounding hills (dense uphill, sparse elsewhere)
    const N = 4200
    const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6, 1), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), N)
    cone.frustumCulled = false
    let fi = 0
    const a = (s.aspectDeg * Math.PI) / 180
    for (let i = 0; i < N * 3 && fi < N; i++) {
      const ang = rnd() * Math.PI * 2
      const r = 90 + Math.pow(rnd(), 0.8) * 1700
      const x = W / 2 + Math.cos(ang) * r, z = D / 2 + Math.sin(ang) * r
      const up = -((x - W / 2) * Math.sin(a) + (z - D / 2) * -Math.cos(a))
      const density = 0.25 + 0.75 * Math.min(1, Math.max(0, up / 400 + 0.2))
      if (rnd() > density) continue
      if (fbm(x * 0.004, z * 0.004, 3, 41) < 0.4) continue // meadows / clearings
      const gy = H(x, z)
      const h = 7 + rnd() * 12 + r * 0.004
      m.compose(new THREE.Vector3(x, gy + h / 2 - 0.3, z), new THREE.Quaternion(), new THREE.Vector3(h * 0.28, h, h * 0.28))
      cone.setMatrixAt(fi, m)
      c.setHSL(0.30 + rnd() * 0.05, 0.38, 0.12 + rnd() * 0.08, THREE.SRGBColorSpace)
      cone.setColorAt(fi, c)
      fi++
    }
    cone.count = fi
    cone.instanceMatrix.needsUpdate = true
    if (cone.instanceColor) cone.instanceColor.needsUpdate = true
    this.group.add(cone)
  }
}
