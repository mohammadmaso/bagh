import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useStore } from '../../store/store'
import type { Builder } from './structures'

const loader = new GLTFLoader()
const cache = new Map<string, Promise<THREE.Group>>()

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u.buffer
}

export function loadGLBAsset(id: string): Promise<THREE.Group> {
  let p = cache.get(id)
  if (!p) {
    const a = useStore.getState().project.assets?.[id]
    if (!a) return Promise.reject(new Error('missing asset'))
    p = loader.parseAsync(b64ToBuf(a.data), '').then((g) => g.scene)
    cache.set(id, p)
  }
  return p
}

export async function importGLBFile(file: File): Promise<{ id: string; name: string; size: { x: number; y: number; z: number } }> {
  const buf = await file.arrayBuffer()
  const gltf = await loader.parseAsync(buf.slice(0), '')
  const box = new THREE.Box3().setFromObject(gltf.scene)
  const size = box.getSize(new THREE.Vector3())
  let s = ''
  const u = new Uint8Array(buf)
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  const id = 'glb' + Date.now().toString(36)
  useStore.getState().commit((d) => { d.assets[id] = { id, name: file.name, data: btoa(s) } })
  cache.set(id, Promise.resolve(gltf.scene))
  return { id, name: file.name, size }
}

/** Imported model: placeholder box until the glTF is parsed, then the model fitted to its stored footprint. */
export const glbModel: Builder = (item, obj) => {
  const g = new THREE.Group()
  const id = String(obj.params.assetId ?? '')
  const W = typeof obj.params.width === 'number' ? (obj.params.width as number) : 2
  const D = typeof obj.params.depth === 'number' ? (obj.params.depth as number) : 2
  const k = typeof obj.params.modelScale === 'number' ? (obj.params.modelScale as number) : 1
  const ph = new THREE.Mesh(new THREE.BoxGeometry(W * k, 1, D * k), new THREE.MeshStandardMaterial({ color: 0x8899aa, transparent: true, opacity: 0.5 }))
  ph.position.y = 0.5
  g.add(ph)
  if (id) {
    loadGLBAsset(id).then((scene) => {
      const m = scene.clone(true)
      const box = new THREE.Box3().setFromObject(m)
      const size = box.getSize(new THREE.Vector3())
      const sx = size.x > 1e-6 ? W / size.x : 1, sz = size.z > 1e-6 ? D / size.z : 1
      const s = Math.min(sx, sz) * k
      m.scale.setScalar(s)
      const b2 = new THREE.Box3().setFromObject(m)
      m.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2)
      m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
      g.remove(ph)
      g.add(m)
      g.userData.height = size.y * s
    }).catch(() => undefined)
  }
  return g
}
