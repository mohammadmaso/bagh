import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
import {
  EffectComposer, RenderPass, EffectPass, NormalPass, SSAOEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode, SMAAPreset,
} from 'postprocessing'
import { useStore, activeScenario, type UIState } from '../store/store'
import { createTerrain, type Terrain, type Pad, type Cut } from '../core/terrain'
import { decodeSculpt } from '../core/sculpt'
import type { Project } from '../core/project'
import { sunAt, siteLocalToDate } from '../core/sun'
import { seasonLook } from '../core/season'
import { TerrainLayer } from './terrainLayer'
import { buildFence, buildHouse, housePlacement } from './siteLayer'
import { SkyLayer } from './skyLayer'
import { QUALITY } from './quality'
import { treeQualityScale } from './models/plantFactory'
import { WalkController } from './walk'
import type { ViewMode } from '../store/store'

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
  terrainRev: number
  /** scenario rendered by this engine (the active plan unless overridden by the compare view) */
  scenarioId: string
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
  private sculptCache: { src: unknown; grid: ReturnType<typeof decodeSculpt> } | null = null
  terrainRev = 0
  scenarioOverride: string | null = null
  /** view-only engines (compare pane) skip analysis/interaction */
  readOnly = false
  private dirty = true
  private lastQuality = ''
  time = 0
  fps = 0
  private frames = 0
  private fpsT = 0
  private unsub: (() => void) | null = null
  private lookCache!: ReturnType<typeof seasonLook>
  onFrame: Array<(dt: number) => void> = []
  walk!: WalkController
  view: ViewMode = 'persp'
  private perspSaved: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null
  private anim: { t0: number; dur: number; from: { pos: THREE.Vector3; target: THREE.Vector3; zoom: number }; to: { pos: THREE.Vector3; target: THREE.Vector3; zoom: number }; cam: THREE.Camera; done?: () => void } | null = null
  sectionX = 16.5
  private lastTerrainHit: { x: number; z: number } | null = null
  lastPick() { return this.lastTerrainHit }

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
    if (this.readOnly) this.controls.enabled = false
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controls.addEventListener('change', () => (this.dirty = true))

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()

    this.walk = new WalkController(this)
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
    return { engine: this, project: s.project, ui: s.ui, terrain: this.terrain, look: this.lookCache, terrainRev: this.terrainRev, scenarioId: this.scenarioOverride ?? s.project.activeScenarioId }
  }

  /** collect pads from the site's house and from placed objects (extended by layers via `extraPads`). */
  extraPads: (base: Terrain) => Pad[] = () => []
  extraCuts: () => Cut[] = () => []

  private sync(force = false) {
    const { project, ui } = useStore.getState()
    const site = project.site
    const t = ui.time
    // --- terrain / site geometry
    let sculptG = null
    if (project.sculpt) {
      if (this.sculptCache?.src !== project.sculpt) this.sculptCache = { src: project.sculpt, grid: decodeSculpt(project.sculpt, site) }
      sculptG = this.sculptCache.grid
    }
    const baseT = createTerrain(site, sculptG)
    const pads = this.extraPads(baseT)
    const cuts = this.extraCuts()
    const key = JSON.stringify([site, project.sculpt?.data ? project.sculpt.data.length + ':' + strHash(project.sculpt.data) : 0, pads, cuts])
    const geomChanged = key !== this.siteKey || force
    if (geomChanged) {
      this.siteKey = key
      const sculpt = sculptG
      const hp = housePlacement(site, baseT)
      const housePad: Pad = { id: 'house', cx: hp.cx, cz: hp.cz, w: hp.w + 0.4, d: hp.d + 0.4, rotY: 0, level: hp.level, margin: 1.4 }
      this.terrain = createTerrain(site, sculpt, [housePad, ...pads], cuts)
      this.terrainRev++
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
    const sk = this.sky.update(sun, site.horizon)
    this.scene.environment = this.sky.envRT?.texture ?? null
    this.scene.environmentIntensity = 0.05 + 0.24 * sk.day
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
    treeQualityScale.value = q.treeDetail
    treeQualityScale.dist = 0.5 + q.treeDetail
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
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }))
    composer.addPass(new EffectPass(this.activeCamera, ...effects))
    if (q.smaa) composer.addPass(new EffectPass(this.activeCamera, new SMAAEffect({ preset: SMAAPreset.HIGH })))
    this.composer = composer
  }

  /** Smoothly move the active camera (and orbit target). */
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 900, zoom?: number, done?: () => void) {
    const cam = this.activeCamera
    this.anim = {
      t0: performance.now(), dur, cam, done,
      from: { pos: cam.position.clone(), target: this.controls.target.clone(), zoom: (cam as THREE.OrthographicCamera).zoom ?? 1 },
      to: { pos: pos.clone(), target: target.clone(), zoom: zoom ?? (cam as THREE.OrthographicCamera).zoom ?? 1 },
    }
  }

  private stepAnim(now: number) {
    const a = this.anim
    if (!a) return
    const k = Math.min(1, (performance.now() - a.t0) / a.dur)
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
    a.cam.position.lerpVectors(a.from.pos, a.to.pos, e)
    this.controls.target.lerpVectors(a.from.target, a.to.target, e)
    if ((a.cam as THREE.OrthographicCamera).isOrthographicCamera) { (a.cam as THREE.OrthographicCamera).zoom = a.from.zoom + (a.to.zoom - a.from.zoom) * e; (a.cam as THREE.OrthographicCamera).updateProjectionMatrix() }
    if (k >= 1) { this.anim = null; a.done?.() }
    void now
  }

  getCameraState() {
    return { pos: this.activeCamera.position.toArray(), target: this.controls.target.toArray(), view: this.view, zoom: (this.activeCamera as THREE.OrthographicCamera).zoom ?? 1 }
  }

  /** Switch between perspective / plan / section / walk. */
  setView(mode: ViewMode) {
    if (mode === this.view) return
    const prev = this.view
    if (prev === 'walk') this.walk.exit()
    if (prev === 'persp') this.perspSaved = { pos: this.camera.position.clone(), target: this.controls.target.clone() }
    this.view = mode
    const site = useStore.getState().project.site
    const cx = site.width / 2, cz = site.depth / 2, cy = this.terrain.heightAt(cx, cz)
    const c = this.controls
    c.enableRotate = mode === 'persp'
    c.mouseButtons = mode === 'persp' ? { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN } : { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    c.touches = mode === 'persp' ? { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN } : { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
    this.renderer.clippingPlanes = []
    this.renderer.localClippingEnabled = false
    this.terrainLayer.uniforms.uPlan.value = mode === 'plan' ? 1 : 0
    this.scene.fog = mode === 'plan' || mode === 'section' ? null : this.sky.fog
    if (mode === 'persp') {
      this.camera.up.set(0, 1, 0)
      this.setCameraType(this.camera)
      this.camera.near = 0.1; this.camera.updateProjectionMatrix()
      c.minPolarAngle = 0; c.maxPolarAngle = Math.PI * 0.495
      const s = this.perspSaved
      this.camera.position.copy(s?.pos ?? new THREE.Vector3(-16, 11, 50)); c.target.copy(s?.target ?? new THREE.Vector3(16, 2.5, 14))
      c.enabled = true
    } else if (mode === 'plan') {
      const o = this.orthoCamera
      o.up.set(0, 0, -1)
      this.setCameraType(o)
      const span = Math.max(site.depth + 10, (site.width + 10) / Math.max(0.5, o.right / o.top))
      o.top = span / 2; o.bottom = -span / 2; o.zoom = 1
      this.resize()
      o.position.set(cx, 600, cz)
      c.target.set(cx, 0, cz)
      c.minPolarAngle = 0; c.maxPolarAngle = 0.0001
      o.near = -1000; o.far = 3000
      c.enabled = true
    } else if (mode === 'section') {
      const o = this.orthoCamera
      o.up.set(0, 1, 0)
      this.setCameraType(o)
      o.top = 14; o.bottom = -14; o.zoom = 1
      this.resize()
      o.position.set(site.width + 200, cy + 3, cz)
      c.target.set(this.sectionX, cy + 3, cz)
      c.minPolarAngle = Math.PI / 2; c.maxPolarAngle = Math.PI / 2
      o.near = -1000; o.far = 3000
      this.applySectionClip()
      c.enabled = true
    } else if (mode === 'walk') {
      this.camera.up.set(0, 1, 0)
      this.setCameraType(this.camera)
      c.minPolarAngle = 0; c.maxPolarAngle = Math.PI
      this.walk.enter()
    }
    c.update()
    this.dirty = true
    this.sync(true)
  }

  /** Use a 360° photo as the sky (hides the procedural sky); pass null to restore it. */
  setSkyPhoto(tex: THREE.Texture | null) {
    this.sky.sky.visible = !tex
    this.scene.background = tex
    this.scene.backgroundIntensity = 1
    this.dirty = true
  }

  setSectionX(x: number) {
    this.sectionX = x
    this.applySectionClip()
    this.sync(true)
  }

  /** Slice the scene at x = sectionX when in section view; sees the N–S profile of terrain & objects. */
  applySectionClip() {
    if (this.view !== 'section') return
    this.renderer.localClippingEnabled = true
    this.renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), this.sectionX)]
    this.controls.target.x = this.sectionX
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
    this.stepAnim(t)
    if (this.walk.active) this.walk.update(dt)
    else this.controls.update()
    const ctx = this.ctx
    for (const l of this.layers) l.frame?.(dt, this.time, ctx)
    for (const f of this.onFrame) f(dt)
    if (this.composer) this.composer.render(dt)
    else this.renderer.render(this.scene, this.activeCamera)
    this.frames++
    this.fpsT += dt
    if (this.fpsT >= 1) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0 }
  }

  /** Project a world point to client pixel coordinates. */
  worldToScreen(x: number, y: number, z: number) {
    const v = new THREE.Vector3(x, y, z).project(this.activeCamera)
    const r = this.canvas.getBoundingClientRect()
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z > -1 && v.z < 1 }
  }

  /** Raycast screen position (client px) against terrain; returns local-frame point or null. */
  pickTerrain(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const rc = new THREE.Raycaster()
    rc.setFromCamera(ndc, this.activeCamera)
    const hit = rc.intersectObject(this.terrainLayer.mesh!, false)[0]
    if (hit) this.lastTerrainHit = { x: hit.point.x, z: hit.point.z }
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

function strHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += Math.max(1, (s.length / 2048) | 0)) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return h
}

export const engine = new Engine()
