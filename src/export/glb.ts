import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { engine } from '../render/engine'
import { makeGrassTexture } from '../render/textures'

/** glTF can't express a separate alpha map: bake map+alphaMap into one RGBA texture so leaves keep their cut-out shape. */
function bakeAlpha(src: THREE.MeshStandardMaterial, cache: Map<THREE.Material, THREE.Material>): THREE.Material {
  const hit = cache.get(src)
  if (hit) return hit
  const map = src.map?.image as HTMLCanvasElement | undefined
  const alpha = src.alphaMap?.image as HTMLCanvasElement | undefined
  if (!map || !alpha || !(map as any).getContext) return src
  const c = document.createElement('canvas')
  c.width = map.width; c.height = map.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(map, 0, 0)
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const a = document.createElement('canvas'); a.width = c.width; a.height = c.height
  const actx = a.getContext('2d')!; actx.drawImage(alpha, 0, 0, c.width, c.height)
  const ad = actx.getImageData(0, 0, c.width, c.height).data
  for (let i = 0; i < img.data.length; i += 4) img.data[i + 3] = ad[i]
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, color: src.color?.clone?.() ?? 0xffffff })
  cache.set(src, m)
  return m
}

function terrainMesh(): THREE.Mesh {
  const t = engine.terrain
  const { width: W, depth: D } = t.site
  const m = 20, res = 1
  const x0 = -m, z0 = -m, nx = Math.round((W + 2 * m) / res), nz = Math.round((D + 2 * m) / res)
  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * res, z = z0 + j * res; pos.push(x, t.heightAt(x, z), z); uv.push(x / 2.4, z / 2.4) }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d) }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
  const tex = makeGrassTexture(512)
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }))
  mesh.name = 'terrain'
  return mesh
}

/** Whole scene as a binary glTF: terrain, fence, gates, cabin and every placed object (highest LOD). */
export async function exportGLB(): Promise<Blob> {
  const root = new THREE.Group()
  root.name = 'garden'
  root.add(terrainMesh())
  const cache = new Map<THREE.Material, THREE.Material>()
  const prep = (src: THREE.Object3D) => {
    const c = src.clone(true)
    const lods: THREE.LOD[] = []
    c.traverse((o) => { if ((o as THREE.LOD).isLOD) lods.push(o as THREE.LOD) })
    for (const l of lods) { const first = l.levels[0]?.object; const parent = l.parent; if (parent && first) { first.removeFromParent(); first.position.copy(l.position); first.rotation.copy(l.rotation); first.scale.copy(l.scale); parent.add(first); l.removeFromParent() } }
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      if (mesh.material && (mesh.material as THREE.MeshStandardMaterial).alphaMap) mesh.material = bakeAlpha(mesh.material as THREE.MeshStandardMaterial, cache)
      if ((mesh.material as THREE.Material)?.name?.startsWith?.('blossom') || (mesh.material as THREE.Material)?.name?.startsWith?.('fruit')) mesh.visible = false
    })
    return c
  }
  root.add(prep(engine.siteGroup))
  for (const child of engine.layers) {
    if (child.group.name === 'objects') {
      for (const rootObj of child.group.children) {
        if (rootObj.name.startsWith('obj-')) root.add(prep(rootObj))
      }
    }
  }
  root.updateMatrixWorld(true)
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(root, { binary: true, onlyVisible: false, maxTextureSize: 2048 })
  return new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' })
}
