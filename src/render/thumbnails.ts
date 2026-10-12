import * as THREE from 'three'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { CATALOG_BY_ID, defaultParams } from '../data/catalog'
import { buildObjectModel } from './models'
import { createTerrain } from '../core/terrain'
import { DEFAULT_SITE } from '../data/site'
import type { PlacedObject } from '../core/project'
import { applySeasonToPlants } from './models/plantFactory'
import { seasonLook } from '../core/season'

const VERSION = 'v3'
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let holder: THREE.Group
const memo = new Map<string, string>()
const pending = new Map<string, Promise<string>>()
let chain: Promise<unknown> = Promise.resolve()

const SIZE = 192

function setup() {
  if (renderer) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(SIZE, SIZE, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.shadowMap.enabled = true
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500)
  const sun = new THREE.DirectionalLight(0xfff1dd, 3.2)
  sun.position.set(6, 10, 7)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xcfe3ff, 0x6b7b4a, 1.7))
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 1 }))
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  scene.background = new THREE.Color(0xdfeaf2)
  holder = new THREE.Group()
  scene.add(holder)
}

const flatTerrain = () => createTerrain({ ...DEFAULT_SITE, slopeDeg: 0, crossSlopeDeg: 0 })

function render(id: string): string {
  setup()
  const item = CATALOG_BY_ID[id]
  const terrain = flatTerrain()
  const obj: PlacedObject = { id: 'thumb-' + id, type: id, x: 16, z: 15, rotY: 0, scale: 1, params: defaultParams(item), ageOffset: 8, ...(item.kind === 'polyline' ? { points: [{ x: 12, z: 17 }, { x: 15, z: 14 }, { x: 18, z: 15.5 }, { x: 21, z: 13 }] } : {}) }
  const model = buildObjectModel(obj, { terrain, age: 8, quality: 1 })
  holder.clear()
  const root = new THREE.Group()
  root.add(model)
  if (item.kind === 'point') root.position.set(0, 0, 0)
  holder.add(root)
  root.updateMatrixWorld(true)
  applySeasonToPlants(seasonLook(2026, 6, 10, 'auto', false), 0, 0)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3())
  const r = Math.max(0.5, size.length() / 2)
  const dir = new THREE.Vector3(0.75, 0.55, 1.0).normalize()
  let dist = r * 3
  // fit: shrink/grow the distance until the box corners just fit inside ~92 % of the frame
  const corners = [0, 1].flatMap((a) => [0, 1].flatMap((b) => [0, 1].map((c) => new THREE.Vector3(a ? box.max.x : box.min.x, b ? box.max.y : box.min.y, c ? box.max.z : box.min.z))))
  for (let it = 0; it < 6; it++) {
    camera.position.copy(centre).addScaledVector(dir, dist)
    camera.lookAt(centre)
    camera.near = 0.1; camera.far = dist * 8; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true)
    let m = 0
    for (const c of corners) { const p = c.clone().project(camera); m = Math.max(m, Math.abs(p.x), Math.abs(p.y)) }
    dist *= Math.max(0.2, m / 0.92) ** 0.9
  }
  // keep ground under the object and the sun framing it
  const ground = scene.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh
  ground.position.set(centre.x, 0, centre.z)
  const sun = scene.children[0] as THREE.DirectionalLight
  sun.target.position.copy(centre)
  sun.position.copy(centre).add(new THREE.Vector3(6, 10, 7).multiplyScalar(Math.max(1, r / 4)))
  const sc = sun.shadow.camera as THREE.OrthographicCamera
  const ext = Math.max(4, r * 1.6)
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.far = 200 + r * 10; sc.updateProjectionMatrix()
  sun.target.updateMatrixWorld()
  renderer!.render(scene, camera)
  const url = renderer!.domElement.toDataURL('image/png')
  holder.clear()
  return url
}

/** Render (and cache) a catalog item's thumbnail off-screen. Calls are serialised. */
export function getThumbnail(id: string): Promise<string> {
  const hit = memo.get(id)
  if (hit) return Promise.resolve(hit)
  const p = pending.get(id)
  if (p) return p
  const job = chain.then(async () => {
    const key = `thumb:${VERSION}:${id}`
    try { const s = await idbGet<string>(key); if (s) { memo.set(id, s); return s } } catch { /* storage unavailable */ }
    await new Promise((r) => setTimeout(r, 0))
    let url = ''
    try { url = render(id) } catch (e) { console.warn('thumbnail failed', id, e) }
    if (url) { memo.set(id, url); try { await idbSet(key, url) } catch { /* ignore */ } }
    pending.delete(id)
    return url
  })
  chain = job.catch(() => undefined)
  pending.set(id, job)
  return job
}

/** Direct synchronous render for tests/tools (no caching). */
export const renderThumbnailNow = render
