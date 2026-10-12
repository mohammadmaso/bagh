import * as THREE from 'three'
import type { PlantSpecies } from '../../data/plants'
import { PLANTS } from '../../data/plants'
import { generateTree, type TreeGeo } from './treeGen'
import { getPlantMaterials, forEachPlantMaterial } from './plantMaterials'
import type { SeasonLook } from '../../core/season'
import { smoothstep } from '../../core/noise'

interface Cached { geo: TreeGeo; lod: number; key: string; last: number }
const cache = new Map<string, Cached>()
let tick = 0
const MAX_CACHE = 160

export const quantizeAge = (age: number) => Math.round(Math.max(0, age) * 2) / 2
export const treeQualityScale = { value: 1, dist: 1 }

function getGeo(sp: PlantSpecies, ageQ: number, lod: 0 | 1 | 2, variant: number): TreeGeo {
  const key = `${sp.id}:${ageQ}:${lod}:${variant}:${treeQualityScale.value}`
  const hit = cache.get(key)
  if (hit) { hit.last = ++tick; return hit.geo }
  const geo = generateTree(sp, ageQ, lod, variant + 1, treeQualityScale.value)
  cache.set(key, { geo, lod, key, last: ++tick })
  if (cache.size > MAX_CACHE) {
    let oldest: Cached | null = null
    for (const c of cache.values()) if (!oldest || c.last < oldest.last) oldest = c
    if (oldest) {
      const g = oldest.geo
      g.trunk.dispose(); g.leaves?.dispose(); g.blossoms?.dispose(); g.fruits?.dispose()
      cache.delete(oldest.key)
    }
  }
  return geo
}

const blobGeo = new THREE.IcosahedronGeometry(1, 2)
const rootGeo = new THREE.CylinderGeometry(1, 1.5, 1, 8)

/** Build a LOD tree object for a species at the given age. Origin = trunk base on the ground. */
export function buildTree(sp: PlantSpecies, age: number, variant: number): THREE.LOD {
  const mats = getPlantMaterials(sp)
  const ageQ = quantizeAge(age)
  const lod = new THREE.LOD()
  lod.name = 'tree-' + sp.id
  const geo0 = getGeo(sp, ageQ, 0, variant)
  const ds = treeQualityScale.dist
  const levels: [0 | 1 | 2, number][] = [[0, 0], [1, (28 + geo0.canopy * 5) * ds], [2, (90 + geo0.canopy * 9) * ds]]
  for (const [l, dist] of levels) {
    const g = l === 2 ? geo0 : getGeo(sp, ageQ, l, variant)
    const grp = new THREE.Group()
    if (l < 2) {
      const trunk = new THREE.Mesh(g.trunk, mats.bark)
      trunk.castShadow = true; trunk.receiveShadow = true
      grp.add(trunk)
      if (g.leaves) {
        const m = new THREE.Mesh(g.leaves, mats.leaf)
        m.castShadow = true; m.receiveShadow = true
        m.customDepthMaterial = mats.leafDepth
        grp.add(m)
      }
      if (g.blossoms) {
        const m = new THREE.Mesh(g.blossoms, mats.blossom)
        m.castShadow = false; m.customDepthMaterial = mats.blossomDepth
        m.name = 'blossoms'
        grp.add(m)
      }
      if (g.fruits) { const m = new THREE.Mesh(g.fruits, mats.fruit); m.castShadow = false; m.name = 'fruit'; grp.add(m) }
    } else {
      const t = new THREE.Mesh(rootGeo, mats.bark)
      t.scale.set(Math.max(0.05, geo0.canopy * 0.03), geo0.crownBase + 0.2, Math.max(0.05, geo0.canopy * 0.03))
      t.position.y = (geo0.crownBase + 0.2) / 2
      const b = new THREE.Mesh(blobGeo, mats.blob)
      b.scale.set(g.blob.rx, g.blob.ry, g.blob.rz)
      b.position.set(g.blob.cx, g.blob.cy, g.blob.cz)
      b.castShadow = true; b.receiveShadow = true
      grp.add(t, b)
    }
    lod.addLevel(grp, dist)
  }
  lod.userData.height = geo0.height
  lod.userData.canopy = geo0.canopy
  return lod
}

/** Geometry-only access used by rows/trellises (shrub clumps etc.). Returns a Group sharing cached geometry (LOD0 or LOD1). */
export function buildPlantClump(sp: PlantSpecies, age: number, variant: number, lodLevel: 0 | 1 = 0): THREE.Group {
  const mats = getPlantMaterials(sp)
  const g = getGeo(sp, quantizeAge(age), lodLevel, variant)
  const grp = new THREE.Group()
  const trunk = new THREE.Mesh(g.trunk, mats.bark); trunk.castShadow = true
  grp.add(trunk)
  if (g.leaves) { const m = new THREE.Mesh(g.leaves, mats.leaf); m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = mats.leafDepth; grp.add(m) }
  if (g.blossoms) { const m = new THREE.Mesh(g.blossoms, mats.blossom); m.customDepthMaterial = mats.blossomDepth; grp.add(m) }
  if (g.fruits) { const m = new THREE.Mesh(g.fruits, mats.fruit); grp.add(m) }
  grp.userData.height = g.height
  grp.userData.canopy = g.canopy
  return grp
}

/** Push season/time state into every plant material (cheap: uniforms only). */
export function applySeasonToPlants(look: SeasonLook, time: number, wind: number) {
  const doy = look.doy
  forEachPlantMaterial((m) => {
    const sp = m.species
    m.u.uTime.value = time
    m.u.uWind.value = wind
    m.u.uLeafCover.value = sp.deciduous ? look.leaf : 1
    m.u.uAutumnMix.value = look.autumn
    // bloom window in doy
    if (sp.bloom) {
      const a = (sp.bloom[0] - 1) * 30.4 + 1, b = sp.bloom[1] * 30.4
      const wrap = a > b
      const inside = wrap ? Math.max(smoothstep(a - 8, a + 6, doy), 1 - smoothstep(b - 6, b + 8, doy)) : smoothstep(a - 8, a + 6, doy) * (1 - smoothstep(b - 6, b + 8, doy))
      m.u.uBlossom.value = inside
    } else m.u.uBlossom.value = 0
    // fruit window
    if (sp.harvest) {
      const a = (sp.harvest[0] - 1) * 30.4 + 1, b = sp.harvest[1] * 30.4
      const start = a - 50
      const on = smoothstep(start - 1, start, doy) * (1 - smoothstep(b + 15, b + 16, doy))
      m.fruit.visible = on > 0.5
      m.u.uRipe.value = smoothstep(a - 40, a, doy)
    } else m.fruit.visible = false
  })
}

export function plantById(id: string) { return PLANTS[id] }
