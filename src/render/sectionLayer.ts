import * as THREE from 'three'
import type { EngineContext, EngineLayer } from './engine'
import { landscapeHeight } from '../core/landscape'
import { lineDecal } from './decals'

/** Section view helpers: a soil "cap" at the cut plane with a height grid, and plan-view plot boundary + gate marks. */
export class SectionLayer implements EngineLayer {
  readonly group = new THREE.Group()
  private cap: THREE.Mesh | null = null
  private boundary = new THREE.Group()
  private lastKey = ''

  constructor() {
    this.group.add(this.boundary)
  }

  sync(ctx: EngineContext) {
    const e = ctx.engine
    const view = e.view
    const key = `${view}|${e.sectionX}|${ctx.terrainRev}`
    if (key === this.lastKey) return
    this.lastKey = key
    // section cap
    if (this.cap) { this.group.remove(this.cap); this.cap.geometry.dispose(); this.cap = null }
    if (view === 'section') {
      const t = ctx.terrain
      const x = e.sectionX
      const zs: number[] = []
      for (let z = -150; z <= 170; z += 0.5) zs.push(z)
      const pos: number[] = [], idx: number[] = []
      zs.forEach((z, i) => {
        const h = landscapeHeight(t, x, z)
        pos.push(x, h, z, x, h - 12, z)
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx)
      const m = new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `varying vec3 vP;
          void main(){
            vec3 soil = vec3(0.45, 0.34, 0.22);
            float gy = abs(fract(vP.y) - 0.5) * 2.0;
            float gz = abs(fract(vP.z / 5.0) - 0.5) * 2.0;
            float lineY = 1.0 - smoothstep(0.0, fwidth(vP.y) * 1.5, 0.5 - abs(fract(vP.y) - 0.5));
            float lineZ = 1.0 - smoothstep(0.0, fwidth(vP.z / 5.0) * 1.5, 0.5 - abs(fract(vP.z / 5.0) - 0.5));
            vec3 c = mix(soil, soil * 0.55, max(lineY, lineZ) * 0.7);
            gl_FragColor = vec4(c, 1.0);
          }`,
      })
      this.cap = new THREE.Mesh(g, m)
      this.cap.frustumCulled = false
      this.group.add(this.cap)
    }
    // plan-view boundary
    this.boundary.traverse((o: any) => o.geometry?.dispose?.())
    this.boundary.clear()
    if (view === 'plan') {
      const { width: W, depth: D } = ctx.project.site
      const loop = [{ x: 0, z: 0 }, { x: W, z: 0 }, { x: W, z: D }, { x: 0, z: D }, { x: 0, z: 0 }]
      const dense: { x: number; z: number }[] = []
      for (let i = 0; i < 4; i++) {
        const a = loop[i], b = loop[i + 1]
        const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5)
        for (let k = 0; k < n; k++) dense.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n })
      }
      dense.push(dense[0])
      this.boundary.add(lineDecal(dense, ctx.terrain, '#2b2b2b', 0.16, 0.12))
      // gate marks
      for (const g of ctx.project.site.gates) {
        const west = g.edge === 'west', east = g.edge === 'east'
        const pts = [0, 1].map((k) => {
          const s = g.offset + k * g.width
          return west ? { x: 0, z: s } : east ? { x: W, z: s } : g.edge === 'north' ? { x: s, z: 0 } : { x: s, z: D }
        })
        this.boundary.add(lineDecal([pts[0], pts[1]], ctx.terrain, '#d98a1f', 0.4, 0.14))
      }
    }
  }
}
