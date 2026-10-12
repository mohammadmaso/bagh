import { create } from 'zustand'
import { useStore, activeScenario } from './store'
import { engine } from '../render/engine'
import { buildOccluders } from '../core/analysis/occluders'
import type { SunHoursInput, SunHoursResult } from '../core/analysis/sunHours'
import { meanOverShape } from '../core/analysis/sunHours'
import { computeFlow, slopeGrid, cutFill, type FlowResult, type Grid } from '../core/analysis/terrainAnalysis'
import { evaluateRules, type Violation, type SunGrid } from '../core/rules'
import { seasonLook } from '../core/season'
import { shapeOf } from '../core/footprint'
import { CATALOG_BY_ID } from '../data/catalog'
import { createTerrain, makeSculptGrid } from '../core/terrain'
import type { WorkerRequest, WorkerResponse } from '../workers/analysis.worker'

export const PRESET_DATES = {
  spring: { month: 3, day: 21 },
  summer: { month: 6, day: 21 },
  autumn: { month: 9, day: 22 },
  winter: { month: 12, day: 21 },
} as const
export type PresetId = 'today' | keyof typeof PRESET_DATES

export interface ObjectSunRow { id: string; type: string; values: Record<string, number>; growing: number }

interface AnalysisState {
  sun: { status: 'idle' | 'running' | 'done' | 'error'; progress: number; result: SunHoursResult | null; rows: ObjectSunRow[]; stale: boolean; error?: string; dates: Record<string, string> }
  growing: { status: 'idle' | 'running' | 'done'; grid: SunGrid | null }
  flow: FlowResult | null
  slope: Grid | null
  cutfill: { cut: number; fill: number; perPad: Record<string, { cut: number; fill: number }> } | null
  violations: Violation[]
  setViolations: (v: Violation[]) => void
}

export const useAnalysis = create<AnalysisState>((set) => ({
  sun: { status: 'idle', progress: 0, result: null, rows: [], stale: false, dates: {} },
  growing: { status: 'idle', grid: null },
  flow: null,
  slope: null,
  cutfill: null,
  violations: [],
  setViolations: (v) => set({ violations: v }),
}))

let worker: Worker | null = null
let reqId = 0
const waiting = new Map<number, { resolve: (r: { key: string; result: SunHoursResult }[]) => void; reject: (e: Error) => void; progress?: (p: number) => void }>()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const m = e.data
      const w = waiting.get(m.id)
      if (!w) return
      if (m.type === 'progress') w.progress?.(m.p)
      else if (m.type === 'done') { waiting.delete(m.id); w.resolve(m.results) }
      else { waiting.delete(m.id); w.reject(new Error(m.message)) }
    }
  }
  return worker
}

function runJobs(jobs: WorkerRequest['jobs'], progress?: (p: number) => void) {
  const id = ++reqId
  // cancel previous in-flight jobs by terminating the worker (cheap to recreate)
  if (waiting.size) { for (const [, w] of waiting) w.reject(new Error('superseded')); waiting.clear(); worker?.terminate(); worker = null }
  return new Promise<{ key: string; result: SunHoursResult }[]>((resolve, reject) => {
    waiting.set(id, { resolve, reject, progress })
    getWorker().postMessage({ id, jobs } satisfies WorkerRequest)
  })
}

function baseInput() {
  const s = useStore.getState()
  const site = s.project.site
  const objects = Object.values(activeScenario(s.project).objects)
  const terrain = engine.terrain
  return {
    site, objects, terrain,
    sculpt: s.project.sculpt ? { res: s.project.sculpt.res, data: s.project.sculpt.data } : null,
    pads: terrain.pads, cuts: terrain.cuts, age: s.ui.time.ageYears,
    year: s.ui.time.year,
  }
}

function inputFor(dates: { id: string; year: number; month: number; day: number }[], res: number, stepMin: number): SunHoursInput {
  const b = baseInput()
  return {
    site: b.site, sculpt: b.sculpt, pads: b.pads, cuts: b.cuts, occluders: [], res, stepMin, sampleHeight: 0.3,
    dates: dates.map((d) => {
      const look = seasonLook(d.year, d.month, d.day, 'auto', false)
      return { ...d, occluders: buildOccluders(b.objects, { site: b.site, terrain: b.terrain, ageYears: b.age, leaf: look.leaf }) }
    }),
  }
}

/** Full analysis: four solstice/equinox dates + today at 0.5 m. Fills the heatmap and the per-object report. */
export async function runSunAnalysis() {
  const ui = useStore.getState().ui
  const t = ui.time
  const year = t.year
  const dates = [
    { id: 'today', year, month: t.month, day: t.day },
    ...Object.entries(PRESET_DATES).map(([id, d]) => ({ id, year, ...d })),
  ]
  useAnalysis.setState((s) => ({ sun: { ...s.sun, status: 'running', progress: 0, error: undefined } }))
  try {
    const res = await runJobs([{ key: 'main', input: inputFor(dates, 0.5, 10) }], (p) => useAnalysis.setState((s) => ({ sun: { ...s.sun, progress: p } })))
    const result = res[0].result
    const b = baseInput()
    const g = useAnalysis.getState().growing.grid
    const rows: ObjectSunRow[] = []
    for (const o of b.objects) {
      const item = CATALOG_BY_ID[o.type]
      if (!item || o.hidden || !['bed', 'bed-leafy', 'greenhouse', 'hive', 'coop'].includes(item.role)) continue
      const sh = shapeOf(o)
      if (!sh) continue
      const values: Record<string, number> = {}
      for (const d of dates) values[d.id] = meanOverShape(result.hours[d.id], result.nx, result.nz, result.res, sh as any)
      rows.push({ id: o.id, type: o.type, values, growing: g ? meanOverShape(g.hours, g.nx, g.nz, g.res, sh as any) : NaN })
    }
    useAnalysis.setState({ sun: { status: 'done', progress: 1, result, rows, stale: false, dates: Object.fromEntries(dates.map((d) => [d.id, `${d.month}/${d.day}`])) } })
    useStore.getState().setUI({ overlay: 'sun' })
  } catch (e) {
    if ((e as Error).message === 'superseded') return
    useAnalysis.setState((s) => ({ sun: { ...s.sun, status: 'error', error: (e as Error).message } }))
  }
}

/** Quick growing-season (Apr–Sep, 15th of each month) mean at 1 m resolution; feeds the bed-sun rule. */
export async function runGrowingSeason() {
  const b = baseInput()
  const dates = [4, 5, 6, 7, 8, 9].map((m) => ({ id: 'm' + m, year: b.year, month: m, day: 15 }))
  useAnalysis.setState((s) => ({ growing: { ...s.growing, status: 'running' } }))
  try {
    const res = await runJobs([{ key: 'grow', input: inputFor(dates, 1, 20) }])
    const r = res[0].result
    const mean = new Float32Array(r.nx * r.nz)
    for (const d of dates) { const h = r.hours[d.id]; for (let i = 0; i < mean.length; i++) mean[i] += h[i] / dates.length }
    useAnalysis.setState({ growing: { status: 'done', grid: { nx: r.nx, nz: r.nz, res: r.res, hours: mean } } })
    refreshRules()
  } catch (e) {
    if ((e as Error).message !== 'superseded') useAnalysis.setState((s) => ({ growing: { ...s.growing, status: 'idle' } }))
  }
}

export function runTerrainAnalyses() {
  const t = engine.terrain
  if (!t) return
  useAnalysis.setState({ slope: slopeGrid(t, 0.5), flow: computeFlow(t, 1) })
  const s = useStore.getState().project
  const site = s.site
  let sculpt = null
  if (s.sculpt) { sculpt = makeSculptGrid(site.width, site.depth, s.sculpt.res); sculpt.data.set(s.sculpt.data) }
  const base = createTerrain(site, sculpt, [], t.cuts)
  const pads = t.pads.filter((p) => p.id !== 'house')
  useAnalysis.setState({ cutfill: cutFill(base, t.pads.length ? t.pads : pads, 0.25) })
  refreshRules()
}

export function refreshRules() {
  const s = useStore.getState()
  const t = engine.terrain
  if (!t) return
  const flow = useAnalysis.getState().flow
  const pits = flow ? { nx: flow.grid.nx, nz: flow.grid.nz, res: flow.grid.res, x0: flow.grid.x0, z0: flow.grid.z0, data: flow.pits } : null
  const v = evaluateRules({ site: s.project.site, terrain: t, objects: Object.values(activeScenario(s.project).objects), growingSun: useAnalysis.getState().growing.grid, pits }, s.project.ruleConfig)
  useAnalysis.getState().setViolations(v)
}

let debounce: ReturnType<typeof setTimeout> | null = null
let debounceSun: ReturnType<typeof setTimeout> | null = null

/** Keep rules live: re-evaluate (cheap) on every project/time change; refresh the growing-season sun a moment later. */
export function startAnalysisController() {
  let lastRev = -1, lastAge = -1, lastTerrain = -1
  let tdebounce: ReturnType<typeof setTimeout> | null = null
  useStore.subscribe((s) => {
    if (engine.terrainRev !== lastTerrain) {
      lastTerrain = engine.terrainRev
      if (tdebounce) clearTimeout(tdebounce)
      tdebounce = setTimeout(() => runTerrainAnalyses(), 250)
    }
    if (s.rev === lastRev && s.ui.time.ageYears === lastAge) return
    const changedProject = s.rev !== lastRev
    lastRev = s.rev; lastAge = s.ui.time.ageYears
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => { refreshRules() }, 120)
    if (debounceSun) clearTimeout(debounceSun)
    debounceSun = setTimeout(() => { void runGrowingSeason(); useAnalysis.setState((a) => ({ sun: { ...a.sun, stale: a.sun.status === 'done' && (changedProject || true) } })) }, 1500)
  })
  setTimeout(() => { runTerrainAnalyses(); void runGrowingSeason() }, 600)
}
