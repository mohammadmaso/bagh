import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import {
  EffectComposer, RenderPass, EffectPass, NormalPass, SSAOEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode, SMAAPreset,
} from 'postprocessing'
import { useStore, activeScenario, type UIState } from '../store/store'
import { createTerrain, makeSculptGrid, type Terrain, type Pad } from '../core/terrain'
import type { Project } from '../core/project'
import { sunAt, siteLocalToDate } from '../core/sun'
import { seasonLook } from '../core/season'
import { TerrainLayer } from './terrainLayer'
import { buildFence, buildHouse, housePlacement } from './siteLayer'
import { SkyLayer } from './skyLayer'
import { QUALITY } from './quality'

;(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree
;(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

export interface EngineLayer {
  group: THREE.Object3D
  /** called when project data or time changes */
  sync?(ctx: EngineContext): void
  /** called every frame */
  frame?(dt: number, t: number, ctx: EngineContext): void
}

export interface EngineContext {
  engine: Engine
  project: Project
  ui: UIState
  terrain: Terrain
  look: ReturnType<typeof seasonLook>
}

export class Engine {
  renderer!: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 6000)
  orthoCamera = new THREE.OrthographicCamera(-20, 20, 20, -20, -500, 2000)
  activeCamera: THREE.Camera = this.camera
  controls!: OrbitControls
  terrain!: Terrain
  terrainLayer = new TerrainLayer()
  sky!: SkyLayer
  siteGroup = new THREE.Group()
  layers: EngineLayer[] = []
  composer: EffectComposer | null = null
  private ssao: SSAOEffect | null = null
  private canvas!: HTMLCanvasElement
  private ro!: ResizeObserver
  private siteKey = ''
  private dirty = true
  private lastQuality = ''
  time = 0
  fps = 0
  private frames = 0
  private fpsT = 0
  private unsub: (() => void) | null = null
  private lookCache!: ReturnType<typeof seasonLook>
  onFrame: Array<(dt: number) => void> = []

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, stencil: false,
    })
    this.renderer = renderer
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.add(this.terrainLayer.group, this.siteGroup)
    this.sky = new SkyLayer(renderer)
    this.scene.add(this.sky.group)
    this.scene.fog = this.sky.fog

    this.camera.position.set(-16, 11, 50)
    this.camera.near = 0.1
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.set(16, 2.5, 14)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 220
    this.controls.screenSpacePanning = false
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controls.addEventListener('change', () => (this.dirty = true))

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()

    this.unsub = useStore.subscribe(() => this.sync())
    this.sync()
    renderer.setAnimationLoop((t) => this.loop(t))
  }

  addLayer(l: EngineLayer) {
    this.layers.push(l)
    this.scene.add(l.group)
    this.sync(true)
  }

  get ctx(): EngineContext {
    const s = useStore.getState()
    return { engine: this, project: s.project, ui: s.ui, terrain: this.terrain, look: this.lookCache }
  }

  /** collect pads from the site's house and from placed objects (extended by layers via `extraPads`). */
  extraPads: () => Pad[] = () => []

  private sync(force = false) {
    const { project, ui } = useStore.getState()
    const site = project.site
    const t = ui.time
    // --- terrain / site geometry
    const pads = this.extraPads()
    const key = JSON.stringify([site, project.sculpt?.data ? project.sculpt.data.length + ':' + hashArr(project.sculpt.data) : 0, pads])
    const geomChanged = key !== this.siteKey || force
    if (geomChanged) {
      this.siteKey = key
      let sculpt = null
      if (project.sculpt) {
        sculpt = makeSculptGrid(site.width, site.depth, project.sculpt.res)
        sculpt.data.set(project.sculpt.data)
      }
      const hp = housePlacement(site, createTerrain(site, sculpt))
      const housePad: Pad = { id: 'house', cx: hp.cx, cz: hp.cz, w: hp.w + 0.4, d: hp.d + 0.4, rotY: 0, level: hp.level, margin: 1.4 }
      this.terrain = createTerrain(site, sculpt, [housePad, ...pads])
      this.terrainLayer.rebuild(this.terrain)
      const m = this.terrainLayer.mesh as any
      m.geometry.disposeBoundsTree?.()
      m.geometry.computeBoundsTree?.()
      this.rebuildSite()
    }
    // --- time/season
    const date = siteLocalToDate(t.year, t.month, t.day, t.minutes, site.tzOffsetMinutes)
    const sun = sunAt(date, site.lat, site.lon)
    this.sky.shadowCenter.set(site.width / 2, this.terrain.heightAt(site.width / 2, site.depth / 2) + 2, site.depth / 2)
    this.sky.shadowRadius = Math.hypot(site.width, site.depth) / 2 + 4
    this.sky.update(sun, site.horizon)
    this.lookCache = seasonLook(t.year, t.month, t.day, t.seasonMode, t.snow)
    const u = this.terrainLayer.uniforms
    u.uSeasonTint.value.set(...this.lookCache.groundTint)
    u.uSnow.value = this.lookCache.snow
    u.uContours.value = ui.overlay === 'contours' ? 1 : 0
    this.applyQuality(ui)
    const ctx = this.ctx
    for (const l of this.layers) l.sync?.(ctx)
    this.dirty = true
  }

  private rebuildSite() {
    this.siteGroup.traverse((o: any) => { o.geometry?.dispose?.() })
    this.siteGroup.clear()
    const { site } = useStore.getState().project
    this.siteGroup.add(buildFence(site, this.terrain))
    const house = buildHouse(site, this.terrain)
    this.siteGroup.add(house.group)
    this.siteGroup.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o.name !== 'fence-wire') { o.castShadow = o.castShadow ?? true; o.receiveShadow = true }
    })
  }

  private applyQuality(ui: UIState) {
    const q = QUALITY[ui.quality]
    const key = ui.quality + (this.renderer ? this.renderer.getPixelRatio() : '')
    if (key === this.lastQuality) return
    this.lastQuality = key
    this.sky.setShadowMapSize(q.shadowMap)
    this.sky.sun.shadow.needsUpdate = true
    this.buildComposer()
    this.resize()
  }

  private buildComposer() {
    const ui = useStore.getState().ui
    const q = QUALITY[ui.quality]
    this.composer?.dispose()
    this.composer = null
    this.ssao = null
    const r = this.renderer
    if (!q.postprocessing) {
      r.toneMapping = THREE.ACESFilmicToneMapping
      r.toneMappingExposure = 0.9
      return
    }
    r.toneMapping = THREE.NoToneMapping
    const composer = new EffectComposer(r, { multisampling: q.msaa, frameBufferType: THREE.HalfFloatType })
    composer.addPass(new RenderPass(this.scene, this.activeCamera))
    const effects: any[] = []
    if (q.ao) {
      const normalPass = new NormalPass(this.scene, this.activeCamera)
      composer.addPass(normalPass)
      this.ssao = new SSAOEffect(this.activeCamera, normalPass.texture, {
        samples: q.aoSamples, rings: 7, radius: 0.09, intensity: 2.2, bias: 0.03, fade: 0.03, luminanceInfluence: 0.6,
        worldDistanceThreshold: 60, worldDistanceFalloff: 25, worldProximityThreshold: 1.2, worldProximityFalloff: 0.8,
        resolutionScale: 0.75,
      } as any)
      effects.push(this.ssao)
    }
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }))
    composer.addPass(new EffectPass(this.activeCamera, ...effects))
    if (q.smaa) composer.addPass(new EffectPass(this.activeCamera, new SMAAEffect({ preset: SMAAPreset.HIGH })))
    this.composer = composer
  }

  setCameraType(cam: THREE.Camera) {
    if (cam === this.activeCamera) return
    this.activeCamera = cam
    this.lastQuality = ''
    this.applyQuality(useStore.getState().ui)
    this.controls.object = cam as any
    this.dirty = true
  }

  resize() {
    const parent = this.canvas.parentElement ?? this.canvas
    const w = Math.max(2, parent.clientWidth), h = Math.max(2, parent.clientHeight)
    const q = QUALITY[useStore.getState().ui.quality]
    const pr = Math.min(window.devicePixelRatio || 1, q.pixelRatioMax)
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(w, h, false)
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    const a = w / h
    const hh = (this.orthoCamera.top - this.orthoCamera.bottom) / 2
    this.orthoCamera.left = -hh * a; this.orthoCamera.right = hh * a
    this.orthoCamera.updateProjectionMatrix()
    this.composer?.setSize(w, h, false)
    this.dirty = true
  }

  private lastT = 0
  private loop(t: number) {
    const dt = Math.min(0.1, (t - this.lastT) / 1000)
    this.lastT = t
    this.time = t / 1000
    this.controls.update()
    const ctx = this.ctx
    for (const l of this.layers) l.frame?.(dt, this.time, ctx)
    for (const f of this.onFrame) f(dt)
    if (this.composer) this.composer.render(dt)
    else this.renderer.render(this.scene, this.activeCamera)
    this.frames++
    this.fpsT += dt
    if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0 }
  }

  /** Raycast screen position (client px) against terrain; returns local-frame point or null. */
  pickTerrain(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const rc = new THREE.Raycaster()
    rc.setFromCamera(ndc, this.activeCamera)
    const hit = rc.intersectObject(this.terrainLayer.mesh!, false)[0]
    return hit ? hit.point : null
  }

  dispose() {
    this.unsub?.()
    this.ro.disconnect()
    this.renderer.setAnimationLoop(null)
    this.composer?.dispose()
    this.renderer.dispose()
  }
}

function hashArr(a: ArrayLike<number>): number {
  let h = 0
  for (let i = 0; i < a.length; i += Math.max(1, (a.length / 512) | 0)) h = (h * 31 + Math.round(a[i] * 1000)) | 0
  return h
}

export const engine = new Engine()
