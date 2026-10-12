import * as THREE from 'three'
import type { EngineContext, EngineLayer } from './engine'
import { activeScenario, useStore } from '../store/store'
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
    const key = `${rev}|${ctx.ui.selection.join(',')}|${ctx.ui.hoverId}|${ctx.ui.time.ageYears}|${ctx.terrainRev}`
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

  clearGhost(ctx: EngineContext) {
    this.setGhost(ctx, { obj: null, draft: null, measure: null })
  }
}
export type { Shape }
