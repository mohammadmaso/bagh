import * as THREE from 'three'
import { PLANTS } from '../../data/plants'
import { getTreeGeo, quantizeAge, treeQualityScale } from './plantFactory'
import { getPlantMaterials } from './plantMaterials'

export interface TreeInstance { id: string; speciesId: string; age: number; variant: number; x: number; y: number; z: number; rot: number }

interface Slot { mesh: THREE.InstancedMesh; cap: number }

class Group {
  trunk0: Slot | null = null; leaves0: Slot | null = null; blossoms0: Slot | null = null; fruit0: Slot | null = null
  trunk1: Slot | null = null; leaves1: Slot | null = null; blossoms1: Slot | null = null
  trunk2: Slot | null = null; blob2: Slot | null = null
  items: TreeInstance[] = []
  lods: Uint8Array = new Uint8Array(0)
  geoKey = ''
  constructor(public speciesId: string, public ageQ: number, public variant: number) {}
}

const blobUnit = new THREE.IcosahedronGeometry(1, 2)
const trunkUnit = new THREE.CylinderGeometry(1, 1.5, 1, 8)

/**
 * Draws every tree with instancing: one InstancedMesh per (species, age, variant, LOD, part). Trees are re-assigned to
 * LOD0/1/2 by camera distance each frame (cheap) so 300+ trees cost a few dozen draw calls.
 */
export class TreeInstancer {
  readonly group = new THREE.Group()
  private groups = new Map<string, Group>()
  private dirty = true
  private lastCam = new THREE.Vector3(1e9, 1e9, 1e9)
  distScale = 1

  constructor() { this.group.name = 'trees' }

  setTrees(list: TreeInstance[]) {
    const next = new Map<string, TreeInstance[]>()
    for (const t of list) {
      const k = `${t.speciesId}|${quantizeAge(t.age)}|${t.variant}`
      let a = next.get(k)
      if (!a) next.set(k, (a = []))
      a.push(t)
    }
    for (const [k, g] of this.groups) if (!next.has(k)) { g.items = []; this.hide(g) }
    for (const [k, items] of next) {
      let g = this.groups.get(k)
      if (!g) { const [sp, ageQ, v] = k.split('|'); g = new Group(sp, +ageQ, +v); this.groups.set(k, g) }
      g.items = items
      g.lods = new Uint8Array(items.length).fill(255)
    }
    this.dirty = true
  }

  private hide(g: Group) { for (const s of [g.trunk0, g.leaves0, g.blossoms0, g.fruit0, g.trunk1, g.leaves1, g.blossoms1, g.trunk2, g.blob2]) if (s) s.mesh.count = 0 }

  private slot(cur: Slot | null, geo: THREE.BufferGeometry, mat: THREE.Material, need: number, cast: boolean, depth?: THREE.Material, name = ''): Slot {
    if (cur && cur.cap >= need) return cur
    if (cur) { this.group.remove(cur.mesh); cur.mesh.dispose() }
    const cap = Math.max(8, Math.ceil(need * 1.6))
    const mesh = new THREE.InstancedMesh(geo, mat, cap)
    mesh.castShadow = cast
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.count = 0
    mesh.name = name
    if (depth) mesh.customDepthMaterial = depth
    this.group.add(mesh)
    return { mesh, cap }
  }

  update(cam: THREE.Vector3, force = false) {
    if (!force && !this.dirty && cam.distanceToSquared(this.lastCam) < 0.04) return
    this.lastCam.copy(cam)
    this.dirty = false
    const ds = this.distScale
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3()
    const scaleM = new THREE.Matrix4()
    for (const g of this.groups.values()) {
      if (!g.items.length) continue
      const sp = PLANTS[g.speciesId]
      const mats = getPlantMaterials(sp)
      const geo0 = getTreeGeo(sp, g.ageQ, 0, g.variant), geo1 = getTreeGeo(sp, g.ageQ, 1, g.variant)
      const key = `${treeQualityScale.value}`
      if (g.geoKey !== key) { g.geoKey = key; for (const s of [g.trunk0, g.leaves0, g.blossoms0, g.fruit0, g.trunk1, g.leaves1, g.blossoms1, g.trunk2, g.blob2]) if (s) { this.group.remove(s.mesh); s.mesh.dispose() } g.trunk0 = g.leaves0 = g.blossoms0 = g.fruit0 = g.trunk1 = g.leaves1 = g.blossoms1 = g.trunk2 = g.blob2 = null }
      const d1 = (28 + geo0.canopy * 5) * ds, d2 = (90 + geo0.canopy * 9) * ds
      const lists: TreeInstance[][] = [[], [], []]
      g.items.forEach((t, i) => {
        const d = Math.hypot(t.x - cam.x, t.z - cam.z, (t.y - cam.y) * 0.5)
        const lod = d < d1 ? 0 : d < d2 ? 1 : 2
        g.lods[i] = lod
        lists[lod].push(t)
      })
      const n0 = lists[0].length, n1 = lists[1].length, n2 = lists[2].length
      const fill = (slot: Slot | null, list: TreeInstance[], extra?: (t: TreeInstance, out: THREE.Matrix4) => void) => {
        if (!slot) return
        slot.mesh.count = list.length
        list.forEach((t, i) => {
          q.setFromAxisAngle(up, t.rot)
          m.compose(p.set(t.x, t.y, t.z), q, s1)
          if (extra) extra(t, m)
          slot.mesh.setMatrixAt(i, m)
        })
        slot.mesh.instanceMatrix.needsUpdate = true
      }
      // LOD0
      if (n0) {
        g.trunk0 = this.slot(g.trunk0, geo0.trunk, mats.bark, n0, true, undefined, 'trunk0')
        if (geo0.leaves) g.leaves0 = this.slot(g.leaves0, geo0.leaves, mats.leaf, n0, true, mats.leafDepth, 'leaves0')
        if (geo0.blossoms) g.blossoms0 = this.slot(g.blossoms0, geo0.blossoms, mats.blossom, n0, false, mats.blossomDepth, 'blossoms0')
        if (geo0.fruits) g.fruit0 = this.slot(g.fruit0, geo0.fruits, mats.fruit, n0, false, undefined, 'fruit0')
      }
      fill(g.trunk0, lists[0]); fill(g.leaves0, lists[0]); fill(g.blossoms0, lists[0]); fill(g.fruit0, lists[0])
      if (!n0) for (const sl of [g.trunk0, g.leaves0, g.blossoms0, g.fruit0]) if (sl) sl.mesh.count = 0
      // LOD1
      if (n1) {
        g.trunk1 = this.slot(g.trunk1, geo1.trunk, mats.bark, n1, true, undefined, 'trunk1')
        if (geo1.leaves) g.leaves1 = this.slot(g.leaves1, geo1.leaves, mats.leaf, n1, true, mats.leafDepth, 'leaves1')
        if (geo1.blossoms) g.blossoms1 = this.slot(g.blossoms1, geo1.blossoms, mats.blossom, n1, false, mats.blossomDepth, 'blossoms1')
      }
      fill(g.trunk1, lists[1]); fill(g.leaves1, lists[1]); fill(g.blossoms1, lists[1])
      if (!n1) for (const sl of [g.trunk1, g.leaves1, g.blossoms1]) if (sl) sl.mesh.count = 0
      // LOD2: crown blob + trunk stub
      if (n2) {
        const b = geo0.blob
        if (!g.blob2) { const bg = blobUnit.clone(); bg.scale(b.rx, b.ry, b.rz); bg.translate(b.cx, b.cy, b.cz); g.blob2 = this.slot(null, bg, mats.blob, n2, true, undefined, 'blob2') }
        else g.blob2 = this.slot(g.blob2, g.blob2.mesh.geometry, mats.blob, n2, true, undefined, 'blob2')
        if (!g.trunk2) { const tg = trunkUnit.clone(); const r = Math.max(0.05, geo0.canopy * 0.03), h = geo0.crownBase + 0.2; tg.scale(r, h, r); tg.translate(0, h / 2, 0); g.trunk2 = this.slot(null, tg, mats.bark, n2, true, undefined, 'trunk2') }
        else g.trunk2 = this.slot(g.trunk2, g.trunk2.mesh.geometry, mats.bark, n2, true, undefined, 'trunk2')
      }
      fill(g.blob2, lists[2]); fill(g.trunk2, lists[2])
      if (!n2) for (const sl of [g.blob2, g.trunk2]) if (sl) sl.mesh.count = 0
      void scaleM
    }
  }
}
