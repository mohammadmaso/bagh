import * as THREE from 'three'
import { CATALOG_BY_ID, type CatalogItem } from '../../data/catalog'
import { PLANTS } from '../../data/plants'
import type { PlacedObject } from '../../core/project'
import type { Terrain } from '../../core/terrain'
import { buildTree } from './plantFactory'
import { STRUCTURE_BUILDERS } from './structures'
import { buildPolylineModel } from './polylines'

export interface BuildCtx {
  terrain: Terrain
  /** effective plant age in years (timeline + age at planting) */
  age: number
  quality: number
}

/** Build the visual model for a placed point object. Origin at the object's anchor on the ground; +Z of the model faces "front". */
export function buildObjectModel(obj: PlacedObject, ctx: BuildCtx): THREE.Object3D {
  const item = CATALOG_BY_ID[obj.type]
  if (!item) return fallback(obj)
  if (item.kind === 'polyline') return buildPolylineModel(item, obj, ctx.terrain)
  if (item.model === 'plant-tree' && item.plant) {
    const sp = PLANTS[item.plant]
    const variant = hashStr(obj.id) % 4
    return buildTree(sp, ctx.age, variant)
  }
  const b = STRUCTURE_BUILDERS[item.model]
  if (b) return b(item, obj, ctx)
  return fallback(obj, item)
}

function fallback(obj: PlacedObject, item?: CatalogItem): THREE.Object3D {
  const g = new THREE.Group()
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, item?.height ?? 1, 1), new THREE.MeshStandardMaterial({ color: 0xcc8844 }))
  m.position.y = (item?.height ?? 1) / 2
  m.castShadow = true
  g.add(m)
  void obj
  return g
}

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
