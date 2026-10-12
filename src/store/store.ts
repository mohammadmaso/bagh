import { create } from 'zustand'
import { enablePatches, produceWithPatches, applyPatches, enableMapSet, type Patch } from 'immer'
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
  tourDone: false, showFlightCones: true, showLabels: true, sunHoursPreset: 'summer', walkSpeed: 1.6, cleanMode: false,
}

const HISTORY_LIMIT = 200

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
      newPast = [...past.slice(0, -1), { patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse] }]
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
