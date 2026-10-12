import * as THREE from 'three'
import type { EngineContext, EngineLayer } from './engine'
import { activeScenario, useStore } from '../store/store'
import { useAnalysis } from '../store/analysis'
import { CATALOG_BY_ID } from '../data/catalog'
import { shapeOf } from '../core/footprint'
import { computeCollisions } from '../core/collision'
import { outlineDecal, fillDecal, lineDecal, dotMarker } from './decals'
import { PLANTS } from '../data/plants'
import { plantSizeAt } from '../core/growth'
import type { PlacedObject } from '../core/project'
import type { Vec2 } from '../core/types'
import type { Shape } from '../core/geometry2d'

export interface GhostState {
  obj: PlacedObject | null
  valid: boolean
  /** polyline being drawn */
  draft: Vec2[] | null
  draftTypeId: string | null
  measure: Vec2[] | null
}

/** Selection outlines, collision highlights, canopy rings, placement ghost and polyline/measure drafts. */
export class OverlayLayer implements EngineLayer {
  readonly group = new THREE.Group()
  private dynamic = new THREE.Group()
  private ghostGroup = new THREE.Group()
  ghost: GhostState = { obj: null, valid: true, draft: null, draftTypeId: null, measure: null }
  collisions: ReturnType<typeof computeCollisions> = []
  private lastKey = ''
  private lastRev = -1

  constructor() {
    this.group.name = 'overlay'
    this.group.add(this.dynamic, this.ghostGroup)
  }

  sync(ctx: EngineContext) {
    const sc = activeScenario(ctx.project)
    const objs = sc.order.map((id) => sc.objects[id]).filter(Boolean)
    const rev = useStore.getState().rev
    const viol = ctx.ui.showRules ? useAnalysis.getState().violations : []
    const key = `${rev}|${ctx.ui.selection.join(',')}|${ctx.ui.hoverId}|${ctx.ui.time.ageYears}|${ctx.terrainRev}|${ctx.ui.showRules}|${viol.map((v) => v.id + v.severity).join(';')}`
    if (key === this.lastKey) return
    if (rev !== this.lastRev) { this.collisions = computeCollisions(objs, ctx.project.site); this.lastRev = rev }
    this.lastKey = key
    this.rebuild(ctx, objs)
  }

  rebuild(ctx: EngineContext, objs: PlacedObject[]) {
    const { ui, terrain: t } = ctx
    this.dynamic.traverse((o: any) => { o.geometry?.dispose?.() })
    this.dynamic.clear()
    // collisions (red footprint fill)
    const bad = new Set(this.collisions.map((c) => c.id))
    for (const o of objs) {
      if (!bad.has(o.id)) continue
      const s = shapeOf(o)
      if (s) this.dynamic.add(fillDecal(s, t, '#ff2d2d', 0.38))
    }
    // rule violations: coloured rings by worst severity
    if (ui.showRules) {
      const worst = new Map<string, string>()
      const rank: Record<string, number> = { error: 3, warning: 2, info: 1 }
      for (const v of useAnalysis.getState().violations) for (const id of v.objectIds.slice(0, 1)) {
        const cur = worst.get(id)
        if (!cur || rank[v.severity] > rank[cur]) worst.set(id, v.severity)
      }
      for (const [id, sev] of worst) {
        const o = objs.find((x) => x.id === id)
        const s = o && shapeOf(o)
        if (!s) {
          if (o?.points) this.dynamic.add(lineDecal(o.points, t, sev === 'error' ? '#ff4d4d' : sev === 'warning' ? '#ffb020' : '#4aa3ff', 0.22, 0.09))
          continue
        }
        const col = sev === 'error' ? '#ff4d4d' : sev === 'warning' ? '#ffb020' : '#4aa3ff'
        const inflated: Shape = s.type === 'circle' ? { ...s, r: s.r + 0.35 } : { ...s, w: s.w + 0.7, d: s.d + 0.7 }
        this.dynamic.add(outlineDecal(inflated, t, col, 0.2, 0.08))
        // floating pin so issues are visible from far away
        const it = CATALOG_BY_ID[o!.type]
        const pin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 12), new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false }))
        pin.rotation.x = Math.PI
        pin.position.set(o!.x, t.heightAt(o!.x, o!.z) + Math.min(4.5, Math.max(1.6, it?.height ?? 1.6)) + 0.6, o!.z)
        pin.renderOrder = 30
        this.dynamic.add(pin)
      }
    }
    // selection
    for (const id of ui.selection) {
      const o = objs.find((x) => x.id === id)
      if (!o) continue
      const item = CATALOG_BY_ID[o.type]
      if (item.kind === 'polyline' && o.points) {
        this.dynamic.add(lineDecal(o.points, t, '#ffffff', 0.18, 0.12))
        o.points.forEach((p) => this.dynamic.add(dotMarker(p.x, p.z, t, '#ffd54a', 0.16)))
        continue
      }
      const s = shapeOf(o)
      if (s) this.dynamic.add(outlineDecal(s, t, o.locked ? '#9aa0a6' : '#ffd54a', 0.09))
      if (item.plant) {
        const sp = PLANTS[item.plant]
        const now = plantSizeAt(sp, Math.max(0, ui.time.ageYears + o.ageOffset))
        this.dynamic.add(outlineDecal({ type: 'circle', x: o.x, z: o.z, r: now.canopy / 2 }, t, '#4caf50', 0.06))
        this.dynamic.add(outlineDecal({ type: 'circle', x: o.x, z: o.z, r: sp.matureCanopy / 2 }, t, '#a5d6a7', 0.04, 0.05))
      }
    }
    if (ui.hoverId && !ui.selection.includes(ui.hoverId)) {
      const o = objs.find((x) => x.id === ui.hoverId)
      const s = o && shapeOf(o)
      if (s) this.dynamic.add(outlineDecal(s, t, '#ffffff', 0.05))
    }
  }

  /** Called by the interaction controller on pointer move. */
  setGhost(ctx: EngineContext, g: Partial<GhostState>) {
    Object.assign(this.ghost, g)
    this.ghostGroup.traverse((o: any) => { o.geometry?.dispose?.() })
    this.ghostGroup.clear()
    const t = ctx.terrain
    const { obj, valid, draft, measure } = this.ghost
    if (obj) {
      const s = shapeOf(obj)
      if (s) {
        this.ghostGroup.add(fillDecal(s, t, valid ? '#35c75a' : '#ff2d2d', 0.4))
        this.ghostGroup.add(outlineDecal(s, t, valid ? '#7dff9a' : '#ff6b6b', 0.08))
      }
    }
    const lineOf = (pts: Vec2[], color: string) => {
      if (pts.length > 1) this.ghostGroup.add(lineDecal(pts, t, color, 0.16, 0.12))
      pts.forEach((p) => this.ghostGroup.add(dotMarker(p.x, p.z, t, color, 0.15)))
    }
    if (draft) lineOf(draft, '#ffd54a')
    if (measure) lineOf(measure, '#40c4ff')
  }

  /** force a rebuild on the next sync (used when external state like rule results changes) */
  invalidate(ctx: EngineContext) { this.lastKey = ''; this.sync(ctx) }

  clearGhost(ctx: EngineContext) {
    this.setGhost(ctx, { obj: null, draft: null, measure: null })
  }
}
export type { Shape }
