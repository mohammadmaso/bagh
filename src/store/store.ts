import { create } from 'zustand'
import { enablePatches, produceWithPatches, produce, applyPatches, enableMapSet, type Patch } from 'immer'
import { newProject, type Project, type PlacedObject, uid, migrateProject } from '../core/project'
import type { Season } from '../core/sun'

enablePatches()
enableMapSet()

export type ViewMode = 'persp' | 'plan' | 'section' | 'walk'
export type Tool = 'select' | 'place' | 'path' | 'measure' | 'sculpt' | 'array'
export type Overlay = 'none' | 'sun' | 'slope' | 'flow' | 'contours'
export type Quality = 'low' | 'medium' | 'high' | 'ultra'

export interface TimeState {
  year: number
  month: number // 1-12
  day: number
  minutes: number // minutes after local midnight
  /** 'auto' derives the look from the date, otherwise forced */
  seasonMode: 'auto' | Season
  ageYears: number // growth timeline 0..15
  snow: boolean
}

export interface UIState {
  lang: 'en' | 'fa'
  persianDigits: boolean
  theme: 'light' | 'dark'
  view: ViewMode
  tool: Tool
  overlay: Overlay
  quality: Quality
  qualityAuto: boolean
  selection: string[]
  placingType: string | null
  gridSnap: number // metres, 0 = off
  edgeSnap: boolean
  allowOverlap: boolean
  showRules: boolean
  panel: 'library' | 'properties' | 'site' | 'analysis' | 'rules' | 'quantities' | 'images' | 'scenarios'
  time: TimeState
  tourDone: boolean
  showFlightCones: boolean
  showLabels: boolean
  sunHoursPreset: 'today' | 'spring' | 'summer' | 'autumn' | 'winter'
  walkSpeed: number
  cleanMode: boolean
  gizmo: 'translate' | 'rotate' | 'scale'
  /** transient on-canvas readout (length while drawing, measurements) */
  hud: { text: string; x: number; y: number } | null
  /** rect select in progress / info toasts */
  toast: string | null
  arrayDialog: boolean
  contextMenu: { x: number; y: number; id: string | null } | null
  hoverId: string | null
  brush: { mode: 'raise' | 'lower' | 'smooth' | 'flatten'; radius: number; strength: number }
  /** two-point overlay calibration in progress */
  calibrate: { imageId: string; step: 'pick-image' | 'world-a' | 'world-b'; a?: { u: number; v: number }; b?: { u: number; v: number }; A?: { x: number; z: number } } | null
  /** place the pin for this image id on the next terrain click */
  pendingPin: string | null
  /** image viewer modal */
  viewer: string | null
  /** side-by-side comparison with another plan */
  compareWith: string | null
  /** extra params when placing a library entry that is parameterised (imported GLB) */
  placingParams: Record<string, number | string | boolean> | null
}

interface Store {
  project: Project
  past: { patches: Patch[]; inverse: Patch[] }[]
  future: { patches: Patch[]; inverse: Patch[] }[]
  ui: UIState
  /** bumps on any project change; used by engine to skip diffing when equal */
  rev: number
  /** Apply a mutation as one undoable step. `coalesceKey` merges consecutive edits (e.g. drag) into one step. */
  commit: (recipe: (draft: Project) => void, coalesceKey?: string) => void
  /** Apply without recording history (loading, autosave restore). */
  replaceProject: (p: Project, keepHistory?: boolean) => void
  undo: () => void
  redo: () => void
  /** change the project without recording undo history (e.g. switching the active plan) */
  silent: (recipe: (draft: Project) => void) => void
  setUI: (patch: Partial<UIState>) => void
  setTime: (patch: Partial<TimeState>) => void
  lastCoalesce: string | null
}

const now = new Date()
export const DEFAULT_TIME: TimeState = {
  year: 2026, month: 6, day: 21, minutes: 12 * 60 + 30, seasonMode: 'auto', ageYears: 0, snow: false,
}

const defaultUI: UIState = {
  lang: 'en', persianDigits: false, theme: 'light', view: 'persp', tool: 'select', overlay: 'none',
  quality: 'medium', qualityAuto: true, selection: [], placingType: null, gridSnap: 0.5, edgeSnap: true,
  allowOverlap: false, showRules: true, panel: 'library', time: { ...DEFAULT_TIME, year: now.getFullYear() },
  tourDone: false, showFlightCones: true, showLabels: true, sunHoursPreset: 'summer', walkSpeed: 1.6, cleanMode: false, gizmo: 'translate', hud: null, toast: null, arrayDialog: false, contextMenu: null, hoverId: null, brush: { mode: 'raise', radius: 3, strength: 0.6 }, calibrate: null, pendingPin: null, viewer: null, compareWith: null, placingParams: null,
}

const HISTORY_LIMIT = 200

/** Collapse repeated whole-value `replace` patches on the same path (drags/strokes) so history stays small. */
function dedupe(patches: Patch[], keep: 'last' | 'first-applied-last'): Patch[] {
  const seen = new Map<string, number>()
  const out: Patch[] = []
  for (const p of patches) {
    if (p.op === 'replace' && p.path.length <= 3) {
      const key = p.path.join('/')
      const at = seen.get(key)
      if (at !== undefined) { out[at] = p; continue }
      seen.set(key, out.length)
    }
    out.push(p)
  }
  void keep
  return out
}

export const useStore = create<Store>((set, get) => ({
  project: newProject(),
  past: [],
  future: [],
  ui: defaultUI,
  rev: 0,
  lastCoalesce: null,
  commit: (recipe, coalesceKey) => {
    const { project, past, lastCoalesce } = get()
    const [next, patches, inverse] = produceWithPatches(project, recipe)
    if (patches.length === 0) return
    let newPast = past
    if (coalesceKey && coalesceKey === lastCoalesce && past.length) {
      const last = past[past.length - 1]
      newPast = [...past.slice(0, -1), { patches: dedupe([...last.patches, ...patches], 'last'), inverse: dedupe([...inverse, ...last.inverse], 'first-applied-last') }]
    } else {
      newPast = [...past, { patches, inverse }].slice(-HISTORY_LIMIT)
    }
    set((s) => ({ project: next, past: newPast, future: [], rev: s.rev + 1, lastCoalesce: coalesceKey ?? null }))
  },
  replaceProject: (p, keepHistory = false) =>
    set((s) => ({ project: migrateProject(p), past: keepHistory ? s.past : [], future: keepHistory ? s.future : [], rev: s.rev + 1, lastCoalesce: null })),
  undo: () => {
    const { past, future, project } = get()
    if (!past.length) return
    const step = past[past.length - 1]
    set((s) => ({
      project: applyPatches(project, step.inverse), past: past.slice(0, -1), future: [step, ...future], rev: s.rev + 1, lastCoalesce: null,
    }))
  },
  redo: () => {
    const { past, future, project } = get()
    if (!future.length) return
    const step = future[0]
    set((s) => ({
      project: applyPatches(project, step.patches), past: [...past, step], future: future.slice(1), rev: s.rev + 1, lastCoalesce: null,
    }))
  },
  silent: (recipe) => set((s) => ({ project: produce(s.project, recipe), rev: s.rev + 1, lastCoalesce: null })),
  setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
  setTime: (patch) => set((s) => ({ ui: { ...s.ui, time: { ...s.ui.time, ...patch } } })),
}))

export const activeScenario = (p: Project) => p.scenarios[p.activeScenarioId]

// ---- convenience actions -------------------------------------------------

export function addObject(partial: Omit<PlacedObject, 'id' | 'params' | 'ageOffset' | 'scale' | 'rotY'> & Partial<PlacedObject>): string {
  const id = uid()
  useStore.getState().commit((d) => {
    const sc = d.scenarios[d.activeScenarioId]
    sc.objects[id] = { id, params: {}, ageOffset: 0, scale: 1, rotY: 0, ...partial } as PlacedObject
    sc.order.push(id)
  })
  return id
}

export function updateObjects(ids: string[], fn: (o: PlacedObject) => void, coalesceKey?: string) {
  useStore.getState().commit((d) => {
    const sc = d.scenarios[d.activeScenarioId]
    for (const id of ids) if (sc.objects[id]) fn(sc.objects[id])
  }, coalesceKey)
}

export function deleteObjects(ids: string[]) {
  useStore.getState().commit((d) => {
    const sc = d.scenarios[d.activeScenarioId]
    for (const id of ids) delete sc.objects[id]
    sc.order = sc.order.filter((i) => !ids.includes(i))
  })
  useStore.getState().setUI({ selection: useStore.getState().ui.selection.filter((i) => !ids.includes(i)) })
}
