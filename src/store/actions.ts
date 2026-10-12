import { useStore, activeScenario, addObject, deleteObjects, updateObjects } from './store'
import { CATALOG_BY_ID, defaultParams } from '../data/catalog'
import { uid, type PlacedObject } from '../core/project'
import { createTerrain } from '../core/terrain'
import { traceContour } from '../core/contour'
import type { Vec2 } from '../core/types'

let clipboard: PlacedObject[] = []

export const getObjects = () => activeScenario(useStore.getState().project).objects
export const selectedObjects = () => {
  const o = getObjects()
  return useStore.getState().ui.selection.map((id) => o[id]).filter(Boolean)
}

export function select(ids: string[]) { useStore.getState().setUI({ selection: ids }) }

export function placeObject(type: string, x: number, z: number, rotY = 0, extra: Partial<PlacedObject> = {}): string {
  const item = CATALOG_BY_ID[type]
  const id = addObject({ type, x, z, rotY, params: defaultParams(item), ...extra })
  select([id])
  return id
}

export function placePolyline(type: string, points: Vec2[], width?: number): string {
  const item = CATALOG_BY_ID[type]
  const params = defaultParams(item)
  if (width) params.width = width
  const id = addObject({ type, x: 0, z: 0, points, params })
  select([id])
  return id
}

export function copySelection() {
  clipboard = structuredClone(selectedObjects())
  return clipboard.length
}

export function pasteClipboard(at?: { x: number; z: number }) {
  if (!clipboard.length) return []
  const cx = clipboard.reduce((s, o) => s + o.x, 0) / clipboard.length
  const cz = clipboard.reduce((s, o) => s + o.z, 0) / clipboard.length
  const dx = at ? at.x - cx : 1, dz = at ? at.z - cz : 1
  const ids: string[] = []
  useStore.getState().commit((d) => {
    const sc = d.scenarios[d.activeScenarioId]
    const idMap: Record<string, string> = {}
    for (const o of clipboard) {
      const id = uid()
      idMap[o.id] = id
      const c = structuredClone(o)
      c.id = id
      c.x += dx; c.z += dz
      if (c.points) c.points = c.points.map((p) => ({ x: p.x + dx, z: p.z + dz }))
      c.groupId = undefined
      sc.objects[id] = c
      sc.order.push(id)
      ids.push(id)
    }
  })
  select(ids)
  return ids
}

export function duplicateSelection() {
  copySelection()
  return pasteClipboard()
}

export function deleteSelection() {
  const ids = useStore.getState().ui.selection.filter((id) => !getObjects()[id]?.locked)
  if (ids.length) deleteObjects(ids)
}

export function nudgeSelection(dx: number, dz: number) {
  const ids = useStore.getState().ui.selection
  updateObjects(ids, (o) => {
    if (o.locked) return
    o.x += dx; o.z += dz
    if (o.points) o.points = o.points.map((p) => ({ x: p.x + dx, z: p.z + dz }))
  }, 'nudge:' + ids.join(','))
}

export function rotateSelection(delta: number) {
  const ids = useStore.getState().ui.selection
  updateObjects(ids, (o) => { if (!o.locked) o.rotY += delta })
}

export function toggleLock(ids = useStore.getState().ui.selection) {
  const o = getObjects()
  const allLocked = ids.every((id) => o[id]?.locked)
  updateObjects(ids, (x) => { x.locked = !allLocked })
}
export function toggleHide(ids = useStore.getState().ui.selection) {
  const o = getObjects()
  const allHidden = ids.every((id) => o[id]?.hidden)
  updateObjects(ids, (x) => { x.hidden = !allHidden })
}
export function showAll() {
  updateObjects(Object.keys(getObjects()), (x) => { x.hidden = false })
}
export function selectAll() { select(Object.values(getObjects()).filter((o) => !o.hidden).map((o) => o.id)) }

export function groupSelection() {
  const ids = useStore.getState().ui.selection
  if (ids.length < 2) return
  const gid = uid('g')
  useStore.getState().commit((d) => {
    d.groups[gid] = { id: gid, name: 'Group' }
    const sc = d.scenarios[d.activeScenarioId]
    for (const id of ids) if (sc.objects[id]) sc.objects[id].groupId = gid
  })
}
export function ungroupSelection() {
  const ids = useStore.getState().ui.selection
  updateObjects(ids, (o) => { o.groupId = undefined })
}

/** Expand a set of ids to include all members of any groups they belong to. */
export function expandGroups(ids: string[]): string[] {
  const objs = getObjects()
  const gids = new Set(ids.map((i) => objs[i]?.groupId).filter(Boolean) as string[])
  if (!gids.size) return ids
  const out = new Set(ids)
  for (const o of Object.values(objs)) if (o.groupId && gids.has(o.groupId)) out.add(o.id)
  return [...out]
}

export interface ArrayOptions {
  type: string
  count: number
  spacing: number
  mode: 'line' | 'contour'
  /** line: direction in degrees (0 = east, 90 = south) */
  angleDeg: number
  /** start position */
  x: number
  z: number
  /** rotate the items with the row */
  alignToRow: boolean
  params?: Record<string, number | string | boolean>
  ageOffset?: number
}

/** Positions for an array tool run (pure: used by UI preview and by createArray). */
export function arrayPositions(o: Pick<ArrayOptions, 'count' | 'spacing' | 'mode' | 'angleDeg' | 'x' | 'z'>, site = useStore.getState().project.site): { x: number; z: number; rot: number }[] {
  if (o.mode === 'line') {
    const a = (o.angleDeg * Math.PI) / 180
    return Array.from({ length: o.count }, (_, i) => ({ x: o.x + Math.cos(a) * o.spacing * i, z: o.z + Math.sin(a) * o.spacing * i, rot: -a }))
  }
  const sculptless = createTerrain(site)
  const pts = traceContour(sculptless, o.x, o.z, 0.1, Math.ceil((o.spacing * o.count) / 0.1) + 5, 1)
  const out: { x: number; z: number; rot: number }[] = []
  let acc = 0, next = 0
  for (let i = 0; i < pts.length && out.length < o.count; i++) {
    if (i > 0) acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)
    if (acc >= next - 1e-6) {
      const q = pts[Math.min(i + 1, pts.length - 1)], p = pts[Math.max(i - 1, 0)]
      out.push({ x: pts[i].x, z: pts[i].z, rot: -Math.atan2(q.z - p.z, q.x - p.x) })
      next += o.spacing
    }
  }
  return out
}

export function createArray(o: ArrayOptions): string[] {
  const item = CATALOG_BY_ID[o.type]
  const pos = arrayPositions(o)
  const ids: string[] = []
  useStore.getState().commit((d) => {
    const sc = d.scenarios[d.activeScenarioId]
    const gid = uid('g')
    d.groups[gid] = { id: gid, name: `${item.name.en} row` }
    for (const p of pos) {
      const id = uid()
      sc.objects[id] = { id, type: o.type, x: p.x, z: p.z, rotY: o.alignToRow ? p.rot : 0, scale: 1, params: { ...defaultParams(item), ...(o.params ?? {}) }, ageOffset: o.ageOffset ?? 0, groupId: gid }
      sc.order.push(id)
      ids.push(id)
    }
  })
  select(ids)
  return ids
}
