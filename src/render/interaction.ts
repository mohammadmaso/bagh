import * as THREE from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { useStore, updateObjects, type UIState } from '../store/store'
import { CATALOG_BY_ID, defaultParams } from '../data/catalog'
import { snapPosition } from '../core/snap'
import { collidesWithAny } from '../core/collision'
import { distPointPoly, polylineLength, polygonArea } from '../core/geometry2d'
import type { PlacedObject } from '../core/project'
import type { Vec2 } from '../core/types'
import { getObjects, placeObject, placePolyline, select, expandGroups } from '../store/actions'
import type { Engine } from './engine'
import type { ObjectsLayer } from './objectsLayer'
import type { OverlayLayer } from './overlayLayer'
import { snap as snapGrid } from '../core/geometry2d'
import { applyBrush, decodeSculpt, encodeSculpt } from '../core/sculpt'
import type { SculptGrid } from '../core/terrain'
import { calibrateOverlay } from '../core/imagery'
import { edgeFrame } from './siteLayer'

type Drag =
  | { kind: 'move'; session: string; primary: string; start: Map<string, { x: number; z: number; points?: Vec2[] }>; startHit: THREE.Vector3; lastDelta: { x: number; z: number }; moved: boolean }
  | { kind: 'vertex'; session: string; id: string; index: number }
  | { kind: 'gate'; session: string; id: string; grab: number }
  | { kind: 'house'; session: string; grabX: number; grabZ: number }
  | { kind: 'houseSize'; session: string; side: 'north' | 'south' | 'east' | 'west' }
  | { kind: 'box'; x0: number; y0: number; additive: boolean }
  | { kind: 'sculpt'; session: string; work: SculptGrid; target: number; last: number; lastCommit: number }

export class Interaction {
  private tc: TransformControls
  private pivot = new THREE.Object3D()
  private drag: Drag | null = null
  private downPos = { x: 0, y: 0 }
  private downButton = 0
  private ghostRot = 0
  private boxEl: HTMLDivElement
  private tcStart: { pivot: THREE.Vector3; objs: Map<string, PlacedObject>; rotY: number; scale: number } | null = null
  private unsub: () => void
  private lastPointer = { x: 0, y: 0 }
  private lastHit: THREE.Vector3 | null = null
  imageryGroup: THREE.Object3D | null = null

  constructor(private engine: Engine, private objects: ObjectsLayer, private overlay: OverlayLayer, private stage: HTMLElement) {
    this.tc = new TransformControls(engine.activeCamera as THREE.PerspectiveCamera, engine.renderer.domElement)
    this.tc.size = 0.8
    engine.scene.add(this.tc.getHelper())
    engine.scene.add(this.pivot)
    this.tc.attach(this.pivot)
    this.tc.enabled = false
    this.tc.getHelper().visible = false
    this.tc.addEventListener('dragging-changed', (e: any) => { engine.controls.enabled = !e.value })
    this.tc.addEventListener('mouseDown', () => this.tcDown())
    this.tc.addEventListener('objectChange', () => this.tcChange())
    this.tc.addEventListener('mouseUp', () => this.tcUp())

    this.boxEl = document.createElement('div')
    Object.assign(this.boxEl.style, { position: 'absolute', border: '1px dashed #ffd54a', background: 'rgba(255,213,74,0.12)', pointerEvents: 'none', display: 'none', zIndex: '3' })
    stage.appendChild(this.boxEl)

    stage.addEventListener('pointerdown', this.onDown, true)
    window.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    stage.addEventListener('dblclick', this.onDbl)
    stage.addEventListener('contextmenu', this.onContext)
    stage.addEventListener('dragover', this.onDragOver)
    stage.addEventListener('drop', this.onDrop)
    stage.addEventListener('pointerleave', () => { if (!this.drag) useStore.getState().setUI({ hoverId: null }) })
    window.addEventListener('keydown', this.onKey)
    this.unsub = useStore.subscribe(() => this.syncGizmo())
    this.syncGizmo()
  }

  dispose() {
    this.stage.removeEventListener('pointerdown', this.onDown, true)
    window.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    window.removeEventListener('keydown', this.onKey)
    this.unsub()
    this.tc.dispose()
  }

  private get ui(): UIState { return useStore.getState().ui }
  private get site() { return useStore.getState().project.site }
  private ctx() { return this.engine.ctx }

  // ---------------------------------------------------------------- helpers
  private rect() { return this.engine.renderer.domElement.getBoundingClientRect() }

  private pickObject(cx: number, cy: number): string | null {
    const r = this.rect()
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    const rc = new THREE.Raycaster()
    rc.setFromCamera(ndc, this.engine.activeCamera)
    const hits = rc.intersectObjects(this.objects.pickGroup.children, false).filter((h) => h.object.visible)
    if (hits.length) {
      // nearest hit; skip if terrain is clearly in front of it
      return hits[0].object.userData.objectId as string
    }
    // polylines by ground proximity
    const hit = this.engine.pickTerrain(cx, cy)
    if (!hit) return null
    let best: { id: string; d: number } | null = null
    for (const o of Object.values(getObjects())) {
      if (!o.points || o.hidden || o.locked) continue
      const w = typeof o.params.width === 'number' ? (o.params.width as number) : CATALOG_BY_ID[o.type]?.polyline?.width ?? 1
      const d = distPointPoly({ x: hit.x, z: hit.z }, o.points, false)
      if (d <= Math.max(w / 2, 0.35) && (!best || d < best.d)) best = { id: o.id, d }
    }
    return best?.id ?? null
  }

  private snapOpts() { return { grid: this.ui.gridSnap, edges: this.ui.edgeSnap } }

  private setHud(text: string | null, cx = 0, cy = 0) {
    const r = this.rect()
    useStore.getState().setUI({ hud: text ? { text, x: cx - r.left + 14, y: cy - r.top + 14 } : null })
  }

  private ghostObject(type: string, x: number, z: number): PlacedObject {
    const item = CATALOG_BY_ID[type]
    return { id: 'ghost', type, x, z, rotY: this.ghostRot, scale: 1, params: { ...defaultParams(item), ...(this.ui.placingParams ?? {}) }, ageOffset: 0 }
  }

  // ---------------------------------------------------------------- pointer
  private onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.overlay-ui > *')) return
    this.downPos = { x: e.clientX, y: e.clientY }
    this.downButton = e.button
    this.lastPointer = { x: e.clientX, y: e.clientY }
    if (this.tc.axis) return // gizmo handles it
    if (e.button !== 0) return
    const ui = this.ui
    const hit = this.engine.pickTerrain(e.clientX, e.clientY)

    if (ui.view === 'walk') return

    if (ui.tool === 'place' && ui.placingType) {
      if (hit) this.engine.controls.enabled = false
      return
    }
    if (ui.tool === 'sculpt') {
      if (hit) {
        this.engine.controls.enabled = false
        const proj = useStore.getState().project
        const work = decodeSculpt(proj.sculpt, proj.site)
        this.drag = { kind: 'sculpt', session: 's' + Date.now(), work, target: this.engine.terrain.heightAt(hit.x, hit.z), last: performance.now(), lastCommit: 0 }
        this.sculptDab(this.drag, hit)
      }
      return
    }
    if (ui.tool === 'path' || ui.tool === 'measure') {
      this.engine.controls.enabled = false
      return
    }

    // vertex of a selected polyline?
    const sel = ui.selection.length === 1 ? getObjects()[ui.selection[0]] : null
    if (sel?.points) {
      const idx = this.nearestVertex(sel, e.clientX, e.clientY)
      if (idx >= 0) {
        this.drag = { kind: 'vertex', session: 'v' + Date.now(), id: sel.id, index: idx }
        this.engine.controls.enabled = false
        return
      }
    }

    const id = this.pickObject(e.clientX, e.clientY)
    if (id) {
      const ids = expandGroups([id])
      let selection = ui.selection
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        selection = ids.every((i) => selection.includes(i)) ? selection.filter((i) => !ids.includes(i)) : [...new Set([...selection, ...ids])]
        select(selection)
        this.engine.controls.enabled = false
        this.drag = null
        return
      }
      if (!selection.includes(id)) { selection = ids; select(selection) }
      const objs = getObjects()
      if (selection.some((s) => objs[s]?.locked)) { this.engine.controls.enabled = false; return }
      if (hit) {
        const start = new Map<string, { x: number; z: number; points?: Vec2[] }>()
        for (const s of selection) if (objs[s]) start.set(s, { x: objs[s].x, z: objs[s].z, points: objs[s].points?.map((p) => ({ ...p })) })
        this.drag = { kind: 'move', session: 'd' + Date.now(), primary: id, start, startHit: hit.clone(), lastDelta: { x: 0, z: 0 }, moved: false }
        this.engine.controls.enabled = false
      }
      return
    }
    if (hit && ui.tool === 'select') {
      const sd = this.siteDragAt(hit)
      if (sd) {
        this.drag = sd
        this.engine.controls.enabled = false
        return
      }
    }
    if (e.shiftKey) {
      this.drag = { kind: 'box', x0: e.clientX, y0: e.clientY, additive: true }
      this.engine.controls.enabled = false
      return
    }
    // click on empty: handled on pointerup (deselect if not a camera drag)
  }

  private pickPin(cx: number, cy: number): string | null {
    if (!this.imageryGroup) return null
    const r = this.rect()
    const rc = new THREE.Raycaster()
    rc.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.engine.activeCamera)
    const sprites = this.imageryGroup.children.filter((o) => (o as THREE.Sprite).isSprite && o.userData.imageId)
    const hit = rc.intersectObjects(sprites, false)[0]
    return hit ? (hit.object.userData.imageId as string) : null
  }

  private nearestVertex(o: PlacedObject, cx: number, cy: number): number {
    const r = this.rect()
    const t = this.engine.terrain
    const v = new THREE.Vector3()
    let best = -1, bd = 16
    o.points!.forEach((p, i) => {
      v.set(p.x, t.heightAt(p.x, p.z), p.z).project(this.engine.activeCamera)
      const sx = r.left + ((v.x + 1) / 2) * r.width, sy = r.top + ((1 - v.y) / 2) * r.height
      const d = Math.hypot(sx - cx, sy - cy)
      if (d < bd) { bd = d; best = i }
    })
    return best
  }

  private onMove = (e: PointerEvent) => {
    this.lastPointer = { x: e.clientX, y: e.clientY }
    const r = this.rect()
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    const ui = this.ui
    const d = this.drag
    if (d?.kind === 'box') {
      const x0 = Math.min(d.x0, e.clientX), y0 = Math.min(d.y0, e.clientY)
      Object.assign(this.boxEl.style, { display: 'block', left: x0 - r.left + 'px', top: y0 - r.top + 'px', width: Math.abs(e.clientX - d.x0) + 'px', height: Math.abs(e.clientY - d.y0) + 'px' })
      return
    }
    if (!inside && !d) return
    const hit = this.engine.pickTerrain(e.clientX, e.clientY)
    this.lastHit = hit
    if (d?.kind === 'sculpt' && hit) { this.sculptDab(d, hit); return }
    if (ui.tool === 'sculpt' && hit && !d) { this.sculptCursor(hit); return }
    if (d?.kind === 'vertex' && hit) {
      const g = this.ui.gridSnap
      updateObjects([d.id], (o) => { if (o.points) o.points[d.index] = { x: snapGrid(hit.x, g), z: snapGrid(hit.z, g) } }, d.session)
      return
    }
    if (d?.kind === 'move' && hit) { this.dragMove(d, hit); return }
    if ((d?.kind === 'gate' || d?.kind === 'house' || d?.kind === 'houseSize') && hit) { this.dragSite(d, hit); return }

    // hover / ghosts
    if (ui.tool === 'place' && ui.placingType && hit) {
      const item = CATALOG_BY_ID[ui.placingType]
      if (item.kind === 'point') {
        const g = this.ghostObject(ui.placingType, hit.x, hit.z)
        const p = snapPosition(g, hit.x, hit.z, Object.values(getObjects()), this.site, this.snapOpts())
        g.x = p.x; g.z = p.z
        const valid = this.ui.allowOverlap || !collidesWithAny(g, Object.values(getObjects()), this.site)
        this.overlay.setGhost(this.ctx(), { obj: g, valid })
      }
      return
    }
    if ((ui.tool === 'path' || ui.tool === 'measure') && hit) {
      const draft = ui.tool === 'path' ? this.overlay.ghost.draft : this.overlay.ghost.measure
      if (draft && draft.length) {
        const p = this.snapPoint(hit)
        const pts = [...draft.slice(0, draft.length - (this.cursorPoint ? 1 : 0)), p]
        this.cursorPoint = true
        this.setDraft(pts)
        this.updateDraftHud(pts, e.clientX, e.clientY)
      }
      return
    }
    if (!d && inside && e.buttons === 0) {
      const id = this.pickObject(e.clientX, e.clientY)
      if (id !== ui.hoverId) useStore.getState().setUI({ hoverId: id })
    }
  }

  private cursorPoint = false

  /** Gate / cabin hit-test for direct manipulation in the viewport. */
  private siteDragAt(hit: THREE.Vector3): Drag | null {
    const site = this.site
    const session = 'site' + Date.now()
    for (const g of site.gates) {
      const f = edgeFrame(site, g.edge)
      const s = (hit.x - f.ox) * f.dx + (hit.z - f.oz) * f.dz
      const perp = Math.abs((hit.x - f.ox) * f.dz - (hit.z - f.oz) * f.dx)
      if (perp <= 1 && s >= g.offset - 0.3 && s <= g.offset + g.width + 0.3) return { kind: 'gate', session, id: g.id, grab: s - g.offset }
    }
    const h = site.house
    const cx = site.width / 2 + h.offsetX, cz = site.depth - h.setbackSouth - h.depth / 2
    const dx = hit.x - cx, dz = hit.z - cz
    const hw = h.width / 2, hd = h.depth / 2, tol = 0.4
    if (Math.abs(dx) <= hw + tol && Math.abs(dz) <= hd + tol) {
      const inner = Math.abs(dx) <= hw - tol && Math.abs(dz) <= hd - tol
      if (!inner) {
        const dE = Math.abs(dx - hw), dW = Math.abs(dx + hw), dN = Math.abs(dz + hd), dS = Math.abs(dz - hd)
        const m = Math.min(dE, dW, dN, dS)
        const side = m === dE ? 'east' : m === dW ? 'west' : m === dN ? 'north' : 'south'
        return { kind: 'houseSize', session, side }
      }
      return { kind: 'house', session, grabX: dx, grabZ: dz }
    }
    return null
  }

  private dragSite(d: Extract<Drag, { kind: 'gate' | 'house' | 'houseSize' }>, hit: THREE.Vector3) {
    const g = this.ui.gridSnap
    useStore.getState().commit((p) => {
      const site = p.site
      if (d.kind === 'gate') {
        const gate = site.gates.find((x) => x.id === d.id)
        if (!gate) return
        let best: { edge: typeof gate.edge; dist: number } | null = null
        for (const e of ['north', 'east', 'south', 'west'] as const) {
          const f = edgeFrame(site, e)
          const dist = Math.abs((hit.x - f.ox) * f.dz - (hit.z - f.oz) * f.dx)
          if (!best || dist < best.dist) best = { edge: e, dist }
        }
        const edge = best!.edge
        const f = edgeFrame(site, edge)
        const s = (hit.x - f.ox) * f.dx + (hit.z - f.oz) * f.dz
        const grab = edge === gate.edge ? d.grab : gate.width / 2
        gate.edge = edge
        gate.offset = Math.round(Math.max(0, Math.min(f.len - gate.width, snapGrid(s - grab, g))) * 100) / 100
        return
      }
      const h = site.house
      const cx = site.width / 2 + h.offsetX, cz = site.depth - h.setbackSouth - h.depth / 2
      const west = cx - h.width / 2, east = cx + h.width / 2, north = cz - h.depth / 2, south = cz + h.depth / 2
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
      if (d.kind === 'house') {
        const ncx = clamp(snapGrid(hit.x - d.grabX, g), h.width / 2, site.width - h.width / 2)
        const ncz = clamp(snapGrid(hit.z - d.grabZ, g), h.depth / 2, site.depth - h.depth / 2)
        h.offsetX = ncx - site.width / 2
        h.setbackSouth = site.depth - ncz - h.depth / 2
        return
      }
      const MIN = 2, MAX = 20
      if (d.side === 'east' || d.side === 'west') {
        const x = snapGrid(hit.x, g)
        const w = clamp(d.side === 'east' ? x - west : east - x, MIN, MAX)
        const nw = d.side === 'east' ? west : east - w
        h.width = w
        h.offsetX = nw + w / 2 - site.width / 2
      } else {
        const z = snapGrid(hit.z, g)
        const dep = clamp(d.side === 'south' ? z - north : south - z, MIN, MAX)
        const ns = d.side === 'south' ? north + dep : south
        h.depth = dep
        h.setbackSouth = Math.max(0, site.depth - ns)
      }
    }, d.session)
  }

  private sculptCursor(hit: THREE.Vector3) {
    this.overlay.setGhost(this.ctx(), { obj: null, brushAt: { x: hit.x, z: hit.z, r: this.ui.brush.radius } })
  }

  private sculptDab(d: Extract<Drag, { kind: 'sculpt' }>, hit: THREE.Vector3) {
    const now = performance.now()
    const dt = Math.min(0.12, (now - d.last) / 1000)
    d.last = now
    applyBrush(d.work, (x, z) => this.engine.terrain.baseHeightAt(x, z), this.ui.brush, hit.x, hit.z, Math.max(dt, 0.016), d.target)
    this.sculptCursor(hit)
    if (now - d.lastCommit > 60) {
      d.lastCommit = now
      useStore.getState().commit((p) => { p.sculpt = encodeSculpt(d.work) }, d.session)
    }
  }

  private snapPoint(hit: THREE.Vector3): Vec2 {
    const g = this.ui.gridSnap
    return { x: snapGrid(hit.x, g), z: snapGrid(hit.z, g) }
  }

  private setDraft(pts: Vec2[]) {
    if (this.ui.tool === 'measure') this.overlay.setGhost(this.ctx(), { measure: pts })
    else this.overlay.setGhost(this.ctx(), { draft: pts })
  }

  private updateDraftHud(pts: Vec2[], cx: number, cy: number) {
    const t = this.engine.terrain
    if (this.ui.tool === 'path') { this.setHud(`${polylineLength(pts).toFixed(1)} m`, cx, cy); return }
    // measure: distance, slope, area
    const parts: string[] = []
    const len = polylineLength(pts)
    parts.push(`${len.toFixed(2)} m`)
    if (pts.length >= 2) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1]
      const run = Math.hypot(b.x - a.x, b.z - a.z)
      const rise = t.heightAt(b.x, b.z) - t.heightAt(a.x, a.z)
      if (run > 0.01) parts.push(`${(rise >= 0 ? '+' : '') + rise.toFixed(2)} m · ${(Math.atan2(Math.abs(rise), run) * 180 / Math.PI).toFixed(1)}°`)
    }
    if (pts.length >= 3) parts.push(`${polygonArea(pts).toFixed(1)} m²`)
    this.setHud(parts.join('  |  '), cx, cy)
  }

  private dragMove(d: Extract<Drag, { kind: 'move' }>, hit: THREE.Vector3) {
    const objs = getObjects()
    const prim = objs[d.primary]
    const ps = d.start.get(d.primary)!
    let dx = hit.x - d.startHit.x, dz = hit.z - d.startHit.z
    if (Math.hypot(dx, dz) < 0.02 && !d.moved) return
    d.moved = true
    const selIds = new Set(d.start.keys())
    const others = Object.values(objs).filter((o) => !selIds.has(o.id))
    if (!prim.points) {
      const p = snapPosition(prim, ps.x + dx, ps.z + dz, others, this.site, this.snapOpts())
      dx = p.x - ps.x; dz = p.z - ps.z
    } else {
      const g = this.ui.gridSnap
      dx = snapGrid(dx, g); dz = snapGrid(dz, g)
    }
    // collision check for all moved objects
    let blocked = false
    if (!this.ui.allowOverlap) {
      for (const [id, s] of d.start) {
        const o = objs[id]
        if (o.points) continue
        if (collidesWithAny({ ...o, x: s.x + dx, z: s.z + dz }, others, this.site)) { blocked = true; break }
      }
    }
    if (blocked) {
      this.overlay.setGhost(this.ctx(), { obj: { ...prim, x: ps.x + dx, z: ps.z + dz, id: 'ghost' }, valid: false })
      return
    }
    this.overlay.setGhost(this.ctx(), { obj: null })
    d.lastDelta = { x: dx, z: dz }
    updateObjects([...selIds], (o) => {
      const s = d.start.get(o.id)!
      o.x = s.x + dx; o.z = s.z + dz
      if (s.points) o.points = s.points.map((p) => ({ x: p.x + dx, z: p.z + dz }))
    }, d.session)
  }

  private onUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y)
    const d = this.drag
    const ui = this.ui
    this.drag = null
    this.boxEl.style.display = 'none'
    if (!this.tc.dragging) this.engine.controls.enabled = ui.view !== 'walk'
    useStore.setState({ lastCoalesce: null })
    if (d?.kind === 'box') {
      this.finishBox(d, e)
      return
    }
    if (d?.kind === 'sculpt') { useStore.getState().commit((p) => { p.sculpt = encodeSculpt(d.work) }, d.session); useStore.setState({ lastCoalesce: null }); return }
    if (d?.kind === 'move' || d?.kind === 'vertex' || d?.kind === 'gate' || d?.kind === 'house' || d?.kind === 'houseSize') { this.overlay.setGhost(this.ctx(), { obj: null }); return }
    if (e.button !== 0 || (e.target as HTMLElement).closest?.('.overlay-ui > *')) return
    const r = this.rect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
    if (moved > 5) return // camera drag
    const hit = this.engine.pickTerrain(e.clientX, e.clientY)
    if (ui.tool === 'place' && ui.placingType && hit) {
      const item = CATALOG_BY_ID[ui.placingType]
      if (item.kind === 'point') {
        const g = this.ghostObject(ui.placingType, hit.x, hit.z)
        const p = snapPosition(g, hit.x, hit.z, Object.values(getObjects()), this.site, this.snapOpts())
        g.x = p.x; g.z = p.z
        if (!ui.allowOverlap && collidesWithAny(g, Object.values(getObjects()), this.site)) { useStore.getState().setUI({ toast: 'Overlap — blocked (enable “Allow overlaps” to place anyway)' }); return }
        placeObject(ui.placingType, p.x, p.z, this.ghostRot, ui.placingParams ? { params: { ...defaultParams(item), ...ui.placingParams } } : {})
        useStore.getState().setUI({ tool: 'place' })
      }
      return
    }
    if ((ui.tool === 'path' || ui.tool === 'measure') && hit) {
      const draft = ui.tool === 'path' ? this.overlay.ghost.draft : this.overlay.ghost.measure
      const p = this.snapPoint(hit)
      const base = draft ? draft.slice(0, draft.length - (this.cursorPoint ? 1 : 0)) : []
      this.cursorPoint = false
      const pts = [...base, p]
      this.setDraft(pts)
      this.updateDraftHud(pts, e.clientX, e.clientY)
      return
    }
    if (ui.pendingPin && hit) {
      const imgId = ui.pendingPin
      useStore.getState().commit((d) => { const im = d.images.find((x) => x.id === imgId); if (im) { im.cx = hit.x; im.cz = hit.z; im.visible = true } })
      useStore.getState().setUI({ pendingPin: null, toast: null })
      return
    }
    if (ui.calibrate && hit && (ui.calibrate.step === 'world-a' || ui.calibrate.step === 'world-b')) {
      const cal = ui.calibrate
      if (cal.step === 'world-a') useStore.getState().setUI({ calibrate: { ...cal, step: 'world-b', A: { x: hit.x, z: hit.z } }, toast: 'Now click the second reference point (B) on the terrain' })
      else if (cal.a && cal.b && cal.A) {
        const im = useStore.getState().project.images.find((x) => x.id === cal.imageId)
        if (im) {
          const size = (window as any).__imageSizes?.[im.id] as { w: number; h: number } | undefined
          if (size) {
            const c = calibrateOverlay({ w: size.w, h: size.h, a: cal.a, b: cal.b, A: cal.A, B: { x: hit.x, z: hit.z } })
            useStore.getState().commit((d) => { const t = d.images.find((x) => x.id === cal.imageId); if (t) Object.assign(t, c, { visible: true }) })
          }
        }
        useStore.getState().setUI({ calibrate: null, toast: 'Overlay calibrated' })
      }
      return
    }
    if (ui.tool === 'select') {
      const id = this.pickObject(e.clientX, e.clientY)
      const pin = !id ? this.pickPin(e.clientX, e.clientY) : null
      if (pin) { useStore.getState().setUI({ viewer: pin }); return }
      if (!id && !e.shiftKey) select([])
    }
  }

  private finishBox(d: Extract<Drag, { kind: 'box' }>, e: PointerEvent) {
    const r = this.rect()
    const x0 = Math.min(d.x0, e.clientX), x1 = Math.max(d.x0, e.clientX), y0 = Math.min(d.y0, e.clientY), y1 = Math.max(d.y0, e.clientY)
    if (x1 - x0 < 4 && y1 - y0 < 4) return
    const ids = [...useStore.getState().ui.selection]
    const v = new THREE.Vector3()
    for (const o of Object.values(getObjects())) {
      if (o.hidden || o.locked) continue
      const p = o.points ? o.points[0] : o
      v.set(p.x, this.engine.terrain.heightAt(p.x, p.z), p.z).project(this.engine.activeCamera)
      const sx = r.left + ((v.x + 1) / 2) * r.width, sy = r.top + ((1 - v.y) / 2) * r.height
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1 && v.z < 1 && !ids.includes(o.id)) ids.push(o.id)
    }
    select(expandGroups(ids))
  }

  private onDbl = (e: MouseEvent) => {
    const ui = this.ui
    if (ui.tool === 'path') { this.finishPath(); return }
    if (ui.tool === 'measure') { return }
    // double click on a selected polyline inserts a vertex
    const sel = ui.selection.length === 1 ? getObjects()[ui.selection[0]] : null
    if (sel?.points) {
      const hit = this.engine.pickTerrain(e.clientX, e.clientY)
      if (!hit) return
      const pts = sel.points
      let bi = 0, bd = Infinity
      for (let i = 0; i < pts.length - 1; i++) { const dd = distPointPoly({ x: hit.x, z: hit.z }, [pts[i], pts[i + 1]], false); if (dd < bd) { bd = dd; bi = i } }
      if (bd < 0.8) updateObjects([sel.id], (o) => { o.points!.splice(bi + 1, 0, { x: hit.x, z: hit.z }) })
    }
  }

  finishPath() {
    const ui = this.ui
    let pts = this.overlay.ghost.draft ?? []
    if (this.cursorPoint) pts = pts.slice(0, -1)
    this.cursorPoint = false
    // double-click adds the same point twice; drop duplicates
    pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.05)
    if (pts.length >= 2 && ui.placingType) placePolyline(ui.placingType, pts)
    this.overlay.setGhost(this.ctx(), { draft: null })
    this.setHud(null)
    useStore.getState().setUI({ tool: 'select', placingType: null })
  }

  cancelTool() {
    this.cursorPoint = false
    this.overlay.setGhost(this.ctx(), { obj: null, draft: null, measure: null, brushAt: null })
    this.setHud(null)
    this.ghostRot = 0
  }

  private onContext = (e: MouseEvent) => {
    e.preventDefault()
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y)
    if (moved > 5) return
    const ui = this.ui
    if (ui.tool !== 'select') { useStore.getState().setUI({ tool: 'select', placingType: null }); this.cancelTool(); return }
    const id = this.pickObject(e.clientX, e.clientY)
    if (id && !ui.selection.includes(id)) select(expandGroups([id]))
    const r = this.rect()
    useStore.getState().setUI({ contextMenu: { x: e.clientX - r.left, y: e.clientY - r.top, id } })
  }

  // ---------------------------------------------------------------- DnD from the library
  private onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('application/x-garden-item')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const hit = this.engine.pickTerrain(e.clientX, e.clientY)
    const type = this.ui.placingType
    if (!hit || !type) return
    const item = CATALOG_BY_ID[type]
    if (item.kind !== 'point') return
    const g = this.ghostObject(type, hit.x, hit.z)
    const p = snapPosition(g, hit.x, hit.z, Object.values(getObjects()), this.site, this.snapOpts())
    g.x = p.x; g.z = p.z
    this.overlay.setGhost(this.ctx(), { obj: g, valid: this.ui.allowOverlap || !collidesWithAny(g, Object.values(getObjects()), this.site) })
  }

  private onDrop = (e: DragEvent) => {
    const type = e.dataTransfer?.getData('application/x-garden-item')
    if (!type) return
    e.preventDefault()
    const hit = this.engine.pickTerrain(e.clientX, e.clientY)
    this.overlay.setGhost(this.ctx(), { obj: null })
    const item = CATALOG_BY_ID[type]
    if (!hit || !item) return
    if (item.kind === 'polyline') { useStore.getState().setUI({ tool: 'path', placingType: type }); return }
    const g = this.ghostObject(type, hit.x, hit.z)
    const p = snapPosition(g, hit.x, hit.z, Object.values(getObjects()), this.site, this.snapOpts())
    g.x = p.x; g.z = p.z
    if (!this.ui.allowOverlap && collidesWithAny(g, Object.values(getObjects()), this.site)) { useStore.getState().setUI({ toast: 'Overlap — blocked (enable “Allow overlaps” to place anyway)', tool: 'select', placingType: null }); return }
    placeObject(type, p.x, p.z)
    useStore.getState().setUI({ tool: 'select', placingType: null })
  }

  // ---------------------------------------------------------------- keyboard bits that need the interaction state
  private onKey = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    const ui = this.ui
    if (e.key === 'Escape') { this.cancelTool(); useStore.getState().setUI({ tool: 'select', placingType: null, contextMenu: null, arrayDialog: false }); return }
    if (e.key === 'Enter' && ui.tool === 'path') this.finishPath()
    if (e.key === 'Enter' && ui.tool === 'measure') { this.overlay.setGhost(this.ctx(), { measure: null }); this.setHud(null) }
    if (e.key === 'Backspace' && (ui.tool === 'path' || ui.tool === 'measure')) {
      const draft = ui.tool === 'path' ? this.overlay.ghost.draft : this.overlay.ghost.measure
      if (draft && draft.length > 1) { this.cursorPoint = false; this.setDraft(draft.slice(0, -2)) }
      e.preventDefault()
    }
    if ((e.key === 'r' || e.key === 'R') && ui.tool === 'place' && !e.ctrlKey) { this.ghostRot += Math.PI / 2 }
  }

  // ---------------------------------------------------------------- gizmo
  private syncGizmo() {
    const ui = this.ui
    const sel = ui.selection.map((id) => getObjects()[id]).filter((o) => o && !o.locked && !o.hidden)
    const show = ui.tool === 'select' && sel.length > 0 && ui.view !== 'walk' && !this.drag && (ui.gizmo !== 'translate' || true)
    this.tc.enabled = show
    this.tc.getHelper().visible = show
    this.tc.camera = this.engine.activeCamera as any
    if (!show) return
    this.tc.setMode(ui.gizmo)
    this.tc.setSpace('world')
    this.tc.showX = ui.gizmo !== 'rotate'
    this.tc.showY = ui.gizmo === 'rotate' || ui.gizmo === 'scale'
    this.tc.showZ = ui.gizmo !== 'rotate'
    if (ui.gizmo === 'rotate') { this.tc.showX = false; this.tc.showZ = false }
    if (ui.gizmo === 'translate') { this.tc.showY = false }
    this.tc.setTranslationSnap(ui.gridSnap || null)
    this.tc.setRotationSnap(THREE.MathUtils.degToRad(15))
    this.tc.setScaleSnap(0.05)
    if (this.tcStart) return
    let cx = 0, cz = 0
    for (const o of sel) { const p = o.points ? o.points[0] : o; cx += p.x; cz += p.z }
    cx /= sel.length; cz /= sel.length
    const y = this.engine.terrain ? this.engine.terrain.heightAt(cx, cz) : 0
    this.pivot.position.set(cx, y + 0.1, cz)
    this.pivot.rotation.set(0, 0, 0)
    this.pivot.scale.set(1, 1, 1)
  }

  private tcDown() {
    const objs = new Map<string, PlacedObject>()
    for (const id of this.ui.selection) { const o = getObjects()[id]; if (o) objs.set(id, structuredClone(o)) }
    this.tcStart = { pivot: this.pivot.position.clone(), objs, rotY: this.pivot.rotation.y, scale: this.pivot.scale.x }
  }

  private tcChange() {
    const s = this.tcStart
    if (!s) return
    const mode = this.ui.gizmo
    const ids = [...s.objs.keys()]
    const session = 'g' + ids.join('')
    if (mode === 'translate') {
      const dx = this.pivot.position.x - s.pivot.x, dz = this.pivot.position.z - s.pivot.z
      updateObjects(ids, (o) => { const b = s.objs.get(o.id)!; o.x = b.x + dx; o.z = b.z + dz; if (b.points) o.points = b.points.map((p) => ({ x: p.x + dx, z: p.z + dz })) }, session)
    } else if (mode === 'rotate') {
      const da = this.pivot.rotation.y - s.rotY
      const c = Math.cos(da), sn = Math.sin(da)
      updateObjects(ids, (o) => {
        const b = s.objs.get(o.id)!
        const rot = (x: number, z: number) => { const lx = x - s.pivot.x, lz = z - s.pivot.z; return { x: s.pivot.x + lx * c + lz * sn, z: s.pivot.z - lx * sn + lz * c } }
        const p = rot(b.x, b.z); o.x = p.x; o.z = p.z; o.rotY = b.rotY + da
        if (b.points) o.points = b.points.map((q) => rot(q.x, q.z))
      }, session)
    } else {
      const k = Math.max(0.1, this.pivot.scale.x / s.scale)
      updateObjects(ids, (o) => {
        const b = s.objs.get(o.id)!
        o.scale = Math.max(0.1, b.scale * k)
        o.x = s.pivot.x + (b.x - s.pivot.x) * k; o.z = s.pivot.z + (b.z - s.pivot.z) * k
        if (b.points) o.points = b.points.map((q) => ({ x: s.pivot.x + (q.x - s.pivot.x) * k, z: s.pivot.z + (q.z - s.pivot.z) * k }))
      }, session)
    }
  }

  private tcUp() {
    this.tcStart = null
    useStore.setState({ lastCoalesce: null })
    this.syncGizmo()
  }

  /** Set the active camera for gizmo projection (called by the view manager). */
  setCamera(cam: THREE.Camera) { this.tc.camera = cam as any }
  get hitPoint() { return this.lastHit }
}
