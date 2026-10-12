import * as THREE from 'three'
import type { EngineContext, EngineLayer } from './engine'
import { activeScenario } from '../store/store'
import { shapeOf } from '../core/footprint'
import { CATALOG_BY_ID } from '../data/catalog'
import { pointInShape, distPointPoly, type Shape } from '../core/geometry2d'
import { mulberry32, fbm } from '../core/noise'
import { QUALITY } from './quality'
import { houseShape } from '../core/collision'

const PATCH = 5 // metres

interface Patch { key: string; mesh: THREE.InstancedMesh; lod: number; x0: number; z0: number }

/** Animated, instanced lawn blades: 5 m patches around the camera with distance LOD; masked under objects/paths. */
export class GrassLayer implements EngineLayer {
  readonly group = new THREE.Group()
  private patches = new Map<string, Patch>()
  private geo: THREE.BufferGeometry
  private mat: THREE.MeshStandardMaterial
  private u = { uTime: { value: 0 }, uWind: { value: 0.6 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uSnow: { value: 0 }, uFade: { value: 25 } }
  private masks: Shape[] = []
  private pathLines: { pts: { x: number; z: number }[]; r: number }[] = []
  private masksKey = ''
  private terrainRev = -1
  private enabled = true

  constructor() {
    this.group.name = 'grass'
    // one blade: 4 vertices in a tapering strip, 2 triangles + tip
    const g = new THREE.BufferGeometry()
    const pos = [-0.5, 0, 0, 0.5, 0, 0, -0.38, 0.5, 0, 0.38, 0.5, 0, 0, 1, 0]
    const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4]
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1], 3))
    g.setIndex(idx)
    this.geo = g
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide })
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.u)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform float uFade; varying float vH; varying float vRnd; varying float vDist;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float h = position.y;
          vH = h;
          vRnd = fract(sin(dot(ip.xz, vec2(12.9898, 78.233))) * 43758.5453);
          float ph = uTime * 2.1 + ip.x * 0.7 + ip.z * 0.55 + vRnd * 6.28;
          float gust = 0.5 + 0.5 * sin(uTime * 0.45 + ip.x * 0.08 + ip.z * 0.05);
          float bend = h * h * (0.25 + 0.15 * vRnd);
          transformed.x += (sin(ph) * 0.35 + 0.35) * bend * uWind * (0.5 + gust);
          transformed.z += cos(ph * 0.8) * 0.18 * bend * uWind;
          transformed.z += bend * 0.3;
          vDist = length((modelViewMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz);`)
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH; varying float vRnd; varying float vDist; uniform vec3 uTint; uniform float uSnow; uniform float uFade;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 root = vec3(0.012, 0.03, 0.006);
          vec3 tip = vec3(0.07, 0.14, 0.022) * (0.7 + 0.6 * vRnd);
          vec3 gc = mix(root, tip, smoothstep(0.0, 1.0, vH)) * uTint;
          gc = mix(gc, vec3(0.9, 0.93, 0.97), uSnow);
          diffuseColor.rgb = gc;
          float fade = 1.0 - smoothstep(uFade * 0.75, uFade, vDist);
          if (fade < 0.02 || fract(vRnd * 91.7) > fade) discard;`)
    }
    this.mat = m
  }

  private rebuildMasks(ctx: EngineContext) {
    const sc = activeScenario(ctx.project)
    this.masks = [houseShape(ctx.project.site)]
    this.pathLines = []
    for (const o of Object.values(sc.objects)) {
      if (o.hidden) continue
      const item = CATALOG_BY_ID[o.type]
      if (!item) continue
      if (item.kind === 'polyline' && o.points) {
        if (item.role === 'path' || item.model === 'swale') this.pathLines.push({ pts: o.points, r: (typeof o.params.width === 'number' ? (o.params.width as number) : item.polyline!.width) / 2 + 0.1 })
        continue
      }
      if (item.plant && item.model === 'plant-tree') continue
      if (item.role === 'none' && o.type !== 'car') continue
      const s = shapeOf(o)
      if (!s) continue
      this.masks.push(s.type === 'circle' ? { ...s, r: s.r + 0.1 } : { ...s, w: s.w + 0.2, d: s.d + 0.2 })
    }
  }

  private masked(x: number, z: number): boolean {
    for (const s of this.masks) if (pointInShape(s, x, z)) return true
    for (const p of this.pathLines) if (distPointPoly({ x, z }, p.pts, false) < p.r) return true
    return false
  }

  private build(ctx: EngineContext, px: number, pz: number, lod: number, density: number): THREE.InstancedMesh | null {
    const site = ctx.project.site
    const t = ctx.terrain
    const x0 = px * PATCH, z0 = pz * PATCH
    const rnd = mulberry32((px * 73856093) ^ (pz * 19349663) ^ lod)
    const count = Math.round(PATCH * PATCH * density * (lod === 0 ? 1 : 0.28))
    const m = new THREE.InstancedMesh(this.geo, this.mat, count)
    const o = new THREE.Object3D()
    let n = 0
    const w = lod === 0 ? 0.035 : 0.075
    for (let i = 0; i < count; i++) {
      const x = x0 + rnd() * PATCH, z = z0 + rnd() * PATCH
      if (x < 0.05 || x > site.width - 0.05 || z < 0.05 || z > site.depth - 0.05) {
        // meadow just outside the fence: thinner
        if (rnd() > 0.35 || x < -6 || x > site.width + 6 || z < -6 || z > site.depth + 6) continue
      }
      if (this.masked(x, z)) continue
      const patchy = fbm(x * 0.15, z * 0.15, 3, 3)
      if (patchy < 0.22 && rnd() > 0.5) continue // thin bare spots
      const h = (0.08 + rnd() * 0.1) * (0.7 + patchy * 0.7)
      o.position.set(x, t.heightAt(x, z) - 0.01, z)
      o.rotation.set(0, rnd() * Math.PI * 2, 0)
      o.scale.set(w * (0.8 + rnd() * 0.5), h, 1)
      o.updateMatrix()
      m.setMatrixAt(n++, o.matrix)
    }
    m.count = n
    m.castShadow = false
    m.receiveShadow = true
    m.frustumCulled = true
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
    return n ? m : null
  }

  sync(ctx: EngineContext) {
    const key = JSON.stringify([...activeScenario(ctx.project).order.map((id) => { const o = activeScenario(ctx.project).objects[id]; return [o.type, o.x, o.z, o.rotY, o.scale, o.hidden, o.points?.length, JSON.stringify(o.params)] })])
    if (key !== this.masksKey || ctx.terrainRev !== this.terrainRev) {
      this.masksKey = key
      this.terrainRev = ctx.terrainRev
      this.rebuildMasks(ctx)
      for (const p of this.patches.values()) { this.group.remove(p.mesh); p.mesh.dispose() }
      this.patches.clear()
    }
    this.u.uTint.value.set(...ctx.look.groundTint)
    this.u.uSnow.value = ctx.look.snow
    this.enabled = QUALITY[ctx.ui.quality].grassDensity > 0 && ctx.engine.view !== 'plan' && ctx.engine.view !== 'section'
    this.group.visible = this.enabled
  }

  frame(_dt: number, t: number, ctx: EngineContext) {
    this.u.uTime.value = t
    if (!this.enabled) return
    const q = QUALITY[ctx.ui.quality]
    const cam = ctx.engine.activeCamera.position
    const target = ctx.engine.controls.target
    const R = q.grassRadius
    this.u.uFade.value = R
    // centre the active window between camera and orbit target (so close-ups on distant objects get grass too)
    const cx = ctx.engine.walk.active ? cam.x : (cam.x + target.x) / 2, cz = ctx.engine.walk.active ? cam.z : (cam.z + target.z) / 2
    const reach = ctx.engine.walk.active ? R : Math.min(R, Math.max(10, cam.distanceTo(target) * 0.8 + 8))
    const need = new Set<string>()
    const wanted: { k: string; px: number; pz: number; lod: number; d: number }[] = []
    const pxMin = Math.floor((cx - reach) / PATCH), pxMax = Math.floor((cx + reach) / PATCH)
    const pzMin = Math.floor((cz - reach) / PATCH), pzMax = Math.floor((cz + reach) / PATCH)
    let built = 0
    for (let px = pxMin; px <= pxMax; px++) for (let pz = pzMin; pz <= pzMax; pz++) {
      const mx = (px + 0.5) * PATCH, mz = (pz + 0.5) * PATCH
      const d = Math.hypot(mx - cam.x, mz - cam.z)
      if (d > R + PATCH) continue
      const lod = d < R * 0.45 ? 0 : 1
      const k = `${px},${pz},${lod}`
      need.add(k)
      if (!this.patches.has(k)) wanted.push({ k, px, pz, lod, d })
    }
    wanted.sort((a, b) => a.d - b.d)
    for (const w of wanted) {
      if (built >= 2) break
      const mesh = this.build(ctx, w.px, w.pz, w.lod, q.grassDensity)
      built++
      this.patches.set(w.k, { key: w.k, mesh: mesh ?? new THREE.InstancedMesh(this.geo, this.mat, 0), lod: w.lod, x0: w.px, z0: w.pz })
      if (mesh) this.group.add(mesh)
    }
    for (const [k, p] of this.patches) {
      if (!need.has(k)) { this.group.remove(p.mesh); p.mesh.dispose(); this.patches.delete(k) }
    }
    // avoid showing both LODs of a patch at once
    for (const p of this.patches.values()) p.mesh.visible = true
    for (const [k, p] of this.patches) {
      const other = `${p.x0},${p.z0},${p.lod ? 0 : 1}`
      if (p.lod === 1 && this.patches.has(other)) p.mesh.visible = false
      void k
    }
  }
}
