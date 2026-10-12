import * as THREE from 'three'
import { activeScenario, type UIState } from '../store/store'
import { CATALOG_BY_ID } from '../data/catalog'
import type { PlacedObject } from '../core/project'
import { buildObjectModel, hashStr } from './models'
import { applySeasonToPlants, quantizeAge } from './models/plantFactory'
import type { EngineContext, EngineLayer } from './engine'
import type { Pad, Cut } from '../core/terrain'
import { localDims } from '../core/footprint'
import { mergeStatic } from './models/mergeStatic'
import { TreeInstancer, type TreeInstance } from './models/treeInstancer'
import { PLANTS } from '../data/plants'
import { plantSizeAt } from '../core/growth'
import { QUALITY } from './quality'

interface Entry {
  id: string
  key: string
  root: THREE.Group // positioned/rotated container
  model: THREE.Object3D | null
  pick: THREE.Mesh
  obj: PlacedObject
  /** crop clumps that are hidden in winter */
  crops: THREE.Object3D[]
}

/** Maps scenario objects to Object3Ds; rebuilds a model only when its visual parameters change. */
export class ObjectsLayer implements EngineLayer {
  readonly group = new THREE.Group()
  entries = new Map<string, Entry>()
  pickGroup = new THREE.Group()
  readonly trees = new TreeInstancer()
  private pickMat = new THREE.MeshBasicMaterial({ visible: false })
  constructor() {
    this.group.name = 'objects'
    this.group.add(this.pickGroup, this.trees.group)
  }

  /** Terrain pads for levelled objects. `base` is the terrain without pads (for stable levels). */
  padsFor(objects: PlacedObject[], base: { heightAt(x: number, z: number): number }): Pad[] {
    const pads: Pad[] = []
    for (const o of objects) {
      const item = CATALOG_BY_ID[o.type]
      if (!item?.pad || o.hidden) continue
      const d = localDims(item, o.params)
      const w = d.w * o.scale, dd = d.d * o.scale
      const pts = [[0, 0], [w / 2, dd / 2], [-w / 2, dd / 2], [w / 2, -dd / 2], [-w / 2, -dd / 2]].map(([lx, lz]) => {
        const c = Math.cos(o.rotY), s = Math.sin(o.rotY)
        return base.heightAt(o.x + lx * c + lz * s, o.z - lx * s + lz * c)
      })
      const level = pts.reduce((a, b) => a + b, 0) / pts.length
      pads.push({ id: o.id, cx: o.x, cz: o.z, w: w + 0.3, d: dd + 0.3, rotY: o.rotY, level, margin: 1.0 })
    }
    return pads
  }

  /** Cheap signature of the terrain under an object so terrain-conforming models rebuild only when their ground changed. */
  private groundSig(ctx: EngineContext, o: PlacedObject, item: (typeof CATALOG_BY_ID)[string]): string {
    const t = ctx.terrain
    const pts: [number, number][] = []
    if (o.points) {
      const n = Math.min(o.points.length, 24)
      for (let i = 0; i < n; i++) pts.push([o.points[i].x, o.points[i].z])
      if (o.points.length >= 2) for (let i = 1; i < o.points.length; i++) pts.push([(o.points[i].x + o.points[i - 1].x) / 2, (o.points[i].z + o.points[i - 1].z) / 2])
    } else {
      const d = localDims(item, o.params)
      const w = (d.w * o.scale) / 2, dd = (d.d * o.scale) / 2
      const c = Math.cos(o.rotY), s = Math.sin(o.rotY)
      for (const [lx, lz] of [[0, 0], [w, dd], [-w, dd], [w, -dd], [-w, -dd], [0, dd], [0, -dd], [w, 0], [-w, 0]]) pts.push([o.x + lx * c + lz * s, o.z - lx * s + lz * c])
    }
    let sig = ''
    for (const [x, z] of pts) sig += Math.round(t.heightAt(x, z) * 200).toString(36) + ','
    return sig
  }

  cutsFor(objects: PlacedObject[]): Cut[] {
    return objects.filter((o) => o.type === 'swale' && o.points && o.points.length > 1 && !o.hidden).map((o) => ({
      id: o.id, pts: o.points!, width: typeof o.params.width === 'number' ? (o.params.width as number) : 1.2, depth: typeof o.params.depth === 'number' ? (o.params.depth as number) : 0.35,
    }))
  }

  groundY(ctx: EngineContext, o: PlacedObject): number {
    const item = CATALOG_BY_ID[o.type]
    if (item?.pad) {
      const p = ctx.terrain.pads.find((q) => q.id === o.id)
      if (p) return p.level
    }
    return ctx.terrain.heightAt(o.x, o.z)
  }

  sync(ctx: EngineContext) {
    const sc = ctx.project.scenarios[ctx.scenarioId] ?? activeScenario(ctx.project)
    const seen = new Set<string>()
    const treeList: TreeInstance[] = []
    for (const id of sc.order) {
      const o = sc.objects[id]
      if (!o) continue
      const item = CATALOG_BY_ID[o.type]
      if (!item || item.kind === 'polyline' && !o.points) continue
      seen.add(id)
      const age = Math.max(0, ctx.ui.time.ageYears + o.ageOffset)
      const plantKey = item.plant ? `a${quantizeAge(age)}` : ''
      const key = [o.type, JSON.stringify(o.params), o.scale.toFixed(3), plantKey, o.points ? JSON.stringify(o.points) : '', item.plant ? '' : this.groundSig(ctx, o, item)].join('|')
      const isTree = item.model === 'plant-tree' && !!item.plant
      let e = this.entries.get(id)
      if (!e) {
        const root = new THREE.Group()
        root.name = 'obj-' + id
        const pick = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.pickMat)
        pick.userData.objectId = id
        e = { id, key: '', root, model: null, pick, obj: o, crops: [] }
        this.entries.set(id, e)
        this.group.add(root)
        this.pickGroup.add(pick)
      }
      e.obj = o
      if (isTree) {
        // trees are drawn by the instancer; the entry only carries the pick proxy
        const sp = PLANTS[item.plant!]
        const size = plantSizeAt(sp, age)
        const y = this.groundY(ctx, o)
        e.root.position.set(o.x, y, o.z)
        e.root.visible = false
        if (!o.hidden) treeList.push({ id, speciesId: sp.id, age, variant: hashStr(id) % 2, x: o.x, y, z: o.z, rot: o.rotY })
        const w = Math.max(0.6, size.canopy * 0.6), h = Math.max(0.4, size.height)
        e.pick.scale.set(w, h, w)
        e.pick.position.set(o.x, y + h / 2, o.z)
        e.pick.rotation.set(0, o.rotY, 0)
        e.pick.visible = !o.hidden && !o.locked
        e.pick.userData.locked = !!o.locked
        continue
      }
      if (e.key !== key) {
        e.key = key
        if (e.model) { e.root.remove(e.model); disposeModel(e.model) }
        const built = buildObjectModel(o, { terrain: ctx.terrain, age, quality: 1 })
        if (item.model !== 'plant-tree' && item.model !== 'glb') mergeStatic(built)
        e.model = built
        e.crops = []
        built.traverse((c) => { if (c.userData.seasonal === 'crop') e!.crops.push(c) })
        built.scale.setScalar(item.plant ? 1 : o.scale)
        e.root.add(built)
        built.traverse((c) => { if ((c as THREE.Mesh).isMesh && c.castShadow === false && !c.userData.noShadow) c.receiveShadow = true })
      }
      // transform
      if (item.kind === 'polyline') {
        e.root.position.set(0, 0, 0); e.root.rotation.set(0, 0, 0); e.root.visible = !o.hidden
        e.pick.visible = false
        continue
      }
      const y = this.groundY(ctx, o)
      e.root.position.set(o.x, y, o.z)
      e.root.rotation.set(0, o.rotY, 0)
      e.root.visible = !o.hidden
      // pick proxy
      const d = localDims(item, o.params)
      const model = e.model!
      const h = Math.max(0.4, item.plant ? (model.userData.height ?? item.height) : item.height * o.scale)
      const w = item.plant ? Math.max(0.6, (model.userData.canopy ?? 1) * 0.6) : d.w * o.scale
      const dd = item.plant ? w : d.d * o.scale
      e.pick.scale.set(w, h, dd)
      e.pick.position.set(o.x, y + h / 2, o.z)
      e.pick.rotation.set(0, o.rotY, 0)
      e.pick.visible = !o.hidden && !o.locked
      e.pick.userData.locked = !!o.locked
    }
    for (const [id, e] of this.entries) {
      if (!seen.has(id)) {
        this.group.remove(e.root); this.pickGroup.remove(e.pick)
        if (e.model) disposeModel(e.model)
        e.pick.geometry.dispose()
        this.entries.delete(id)
      }
    }
    this.pickGroup.updateMatrixWorld(true)
    this.trees.distScale = 0.5 + QUALITY[ctx.ui.quality].treeDetail
    this.trees.setTrees(treeList)
    applySeasonToPlants(ctx.look, ctx.engine.time, 0.6)
  }

  frame(_dt: number, t: number, ctx: EngineContext) {
    applySeasonToPlants(ctx.look, t, 0.6)
    this.trees.update(ctx.engine.activeCamera.position)
    const crops = ctx.look.leaf > 0.25
    for (const e of this.entries.values()) for (const c of e.crops) c.visible = crops
  }
}

/** Shared cached geometries/materials must not be disposed per object; only owned geometry flagged `owned`. */
function disposeModel(m: THREE.Object3D) {
  m.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (mesh.geometry?.userData?.owned) mesh.geometry.dispose()
  })
}

export { hashStr }
export type { UIState }
