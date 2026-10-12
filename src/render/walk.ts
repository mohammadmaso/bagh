import * as THREE from 'three'
import type { Engine } from './engine'
import { useStore, activeScenario } from '../store/store'
import { shapeOf } from '../core/footprint'
import { houseShape } from '../core/collision'
import { pointInShape, type Shape } from '../core/geometry2d'
import { CATALOG_BY_ID } from '../data/catalog'

const EYE = 1.7
const RADIUS = 0.3

/** First-person walking: WASD/arrows, drag (or pointer lock) to look, touch joysticks. Collides with fence, house and solid objects. */
export class WalkController {
  active = false
  yaw = 0
  pitch = 0
  private keys = new Set<string>()
  private pos = new THREE.Vector3()
  private dragging = false
  private lastX = 0
  private lastY = 0
  private touchMove = { x: 0, y: 0 }
  private touchLook: { id: number; x: number; y: number } | null = null
  private touchMoveId: number | null = null
  private touchMoveOrigin = { x: 0, y: 0 }
  private el: HTMLElement

  constructor(private engine: Engine) {
    this.el = engine.renderer.domElement
    window.addEventListener('keydown', (e) => { if (this.active) this.keys.add(e.key.toLowerCase()) })
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()))
    this.el.addEventListener('pointerdown', this.down)
    window.addEventListener('pointermove', this.move)
    window.addEventListener('pointerup', this.up)
  }

  enter() {
    const e = this.engine
    this.active = true
    const t = e.controls.target
    // start at the pedestrian door's inside, looking east/north-east into the garden
    const site = useStore.getState().project.site
    const door = site.gates.find((g) => g.kind === 'pedestrian') ?? site.gates[0]
    let x = 1.5, z = site.depth / 2
    if (door && door.edge === 'west') { x = 1.2; z = door.offset + door.width / 2 }
    this.pos.set(x, 0, z)
    this.yaw = -Math.PI / 2 // facing east (+x)
    this.pitch = 0
    void t
    e.controls.enabled = false
    this.apply()
  }

  exit() {
    this.active = false
    this.keys.clear()
    this.engine.controls.enabled = true
  }

  private down = (ev: PointerEvent) => {
    if (!this.active) return
    if (ev.pointerType === 'touch') {
      const r = this.el.getBoundingClientRect()
      if (ev.clientX - r.left < r.width / 2 && this.touchMoveId === null) { this.touchMoveId = ev.pointerId; this.touchMoveOrigin = { x: ev.clientX, y: ev.clientY } }
      else if (!this.touchLook) this.touchLook = { id: ev.pointerId, x: ev.clientX, y: ev.clientY }
      return
    }
    this.dragging = true; this.lastX = ev.clientX; this.lastY = ev.clientY
  }
  private move = (ev: PointerEvent) => {
    if (!this.active) return
    if (ev.pointerType === 'touch') {
      if (ev.pointerId === this.touchMoveId) {
        this.touchMove = { x: Math.max(-1, Math.min(1, (ev.clientX - this.touchMoveOrigin.x) / 50)), y: Math.max(-1, Math.min(1, (ev.clientY - this.touchMoveOrigin.y) / 50)) }
      } else if (this.touchLook && ev.pointerId === this.touchLook.id) {
        this.yaw -= (ev.clientX - this.touchLook.x) * 0.005; this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - (ev.clientY - this.touchLook.y) * 0.005))
        this.touchLook.x = ev.clientX; this.touchLook.y = ev.clientY
      }
      return
    }
    if (!this.dragging) return
    this.yaw -= (ev.clientX - this.lastX) * 0.004
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - (ev.clientY - this.lastY) * 0.004))
    this.lastX = ev.clientX; this.lastY = ev.clientY
  }
  private up = (ev: PointerEvent) => {
    this.dragging = false
    if (ev.pointerId === this.touchMoveId) { this.touchMoveId = null; this.touchMove = { x: 0, y: 0 } }
    if (this.touchLook && ev.pointerId === this.touchLook.id) this.touchLook = null
  }

  /** Solid footprints the walker must not enter. */
  private solids(): Shape[] {
    const { project } = useStore.getState()
    const out: Shape[] = [houseShape(project.site)]
    for (const o of Object.values(activeScenario(project).objects)) {
      if (o.hidden) continue
      const item = CATALOG_BY_ID[o.type]
      if (!item || item.role === 'path' || item.role === 'none' && o.type !== 'car' || item.kind === 'polyline') continue
      const s = shapeOf(o)
      if (s) out.push(s)
    }
    return out
  }

  /** Is the point inside an open gate gap on the given edge? */
  private inGate(x: number, z: number): boolean {
    const site = useStore.getState().project.site
    for (const g of site.gates) {
      if (g.edge === 'west' || g.edge === 'east') {
        const ex = g.edge === 'west' ? 0 : site.width
        if (Math.abs(x - ex) < 1.2 && z > g.offset - 0.1 && z < g.offset + g.width + 0.1) return true
      } else {
        const ez = g.edge === 'north' ? 0 : site.depth
        if (Math.abs(z - ez) < 1.2 && x > g.offset - 0.1 && x < g.offset + g.width + 0.1) return true
      }
    }
    return false
  }

  private blocked(x: number, z: number, solids: Shape[]): boolean {
    const site = useStore.getState().project.site
    if (!this.inGate(x, z)) {
      const m = RADIUS
      const outside = x < m || x > site.width - m || z < m || z > site.depth - m
      // allow being outside the fence completely (walking in the meadow) but not crossing the wire
      const inside = x >= 0 && x <= site.width && z >= 0 && z <= site.depth
      const nearFence = Math.min(Math.abs(x), Math.abs(x - site.width), Math.abs(z), Math.abs(z - site.depth)) < m
      if (nearFence && (inside || outside)) { if (inside ? outside : true) { if (nearFence) return true } }
    }
    for (const s of solids) {
      if (s.type === 'circle') { if (Math.hypot(x - s.x, z - s.z) < Math.min(s.r, 0.6) + RADIUS) return true }
      else { const inflated = { ...s, w: s.w + 2 * RADIUS, d: s.d + 2 * RADIUS }; if (pointInShape(inflated, x, z)) return true }
    }
    return false
  }

  update(dt: number) {
    if (!this.active) return
    const k = this.keys
    const speed = useStore.getState().ui.walkSpeed * (k.has('shift') ? 2.2 : 1)
    let f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0) - this.touchMove.y
    let s = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0) + this.touchMove.x
    if (k.has('q')) this.yaw += 1.5 * dt
    if (k.has('e')) this.yaw -= 1.5 * dt
    const len = Math.hypot(f, s)
    if (len > 0) {
      f /= Math.max(1, len); s /= Math.max(1, len)
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw)
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw)
      const dx = (fx * f + rx * s) * speed * dt, dz = (fz * f + rz * s) * speed * dt
      const solids = this.solids()
      if (!this.blocked(this.pos.x + dx, this.pos.z + dz, solids)) { this.pos.x += dx; this.pos.z += dz }
      else if (!this.blocked(this.pos.x + dx, this.pos.z, solids)) this.pos.x += dx
      else if (!this.blocked(this.pos.x, this.pos.z + dz, solids)) this.pos.z += dz
    }
    this.apply()
  }

  private apply() {
    const cam = this.engine.camera
    const h = this.engine.terrain.heightAt(this.pos.x, this.pos.z)
    cam.position.set(this.pos.x, h + EYE, this.pos.z)
    cam.rotation.order = 'YXZ'
    cam.rotation.set(this.pitch, this.yaw, 0)
    cam.near = 0.05
    cam.updateProjectionMatrix()
  }
}
