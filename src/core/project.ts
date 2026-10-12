import type { SiteConfig, Vec2 } from './types'
import { DEFAULT_SITE } from '../data/site'
import type { RuleConfig } from '../data/rules'

export const SCHEMA_VERSION = 1

export interface PlacedObject {
  id: string
  type: string // catalog id
  x: number
  z: number
  rotY: number // radians
  scale: number
  /** polyline kinds (path, pipe, fence, swale, wall) */
  points?: Vec2[]
  /** catalog-defined numeric/string/bool parameters (e.g. raised bed length) */
  params: Record<string, number | string | boolean>
  label?: string
  locked?: boolean
  hidden?: boolean
  groupId?: string
  /** years of growth already achieved at timeline year 0 (e.g. a bought 3-year-old tree) */
  ageOffset: number
}

export interface Scenario {
  id: string
  name: string
  objects: Record<string, PlacedObject>
  order: string[]
}

export interface SculptData { res: number; nx: number; nz: number; data: number[] }

export interface ReferenceImage {
  id: string
  kind: 'overlay' | 'pin'
  name: string
  /** stored as data URL (local only) */
  dataUrl: string
  opacity: number
  /** overlay placement: centre, width in metres, rotation (rad) */
  cx: number; cz: number; widthM: number; rotY: number
  visible: boolean
}

export interface Project {
  schemaVersion: number
  name: string
  site: SiteConfig
  sculpt: SculptData | null
  scenarios: Record<string, Scenario>
  scenarioOrder: string[]
  activeScenarioId: string
  images: ReferenceImage[]
  groups: Record<string, { id: string; name: string }>
  ruleConfig: RuleConfig
  bookmarks: { id: string; name: string; pos: number[]; target: number[]; view: string; zoom?: number }[]
}

export function emptyScenario(id: string, name: string): Scenario {
  return { id, name, objects: {}, order: [] }
}

export function newProject(): Project {
  const s = emptyScenario('plan-a', 'Plan A')
  return {
    schemaVersion: SCHEMA_VERSION,
    name: 'My garden',
    site: structuredClone(DEFAULT_SITE),
    sculpt: null,
    scenarios: { [s.id]: s },
    scenarioOrder: [s.id],
    activeScenarioId: s.id,
    images: [],
    groups: {},
    ruleConfig: {},
    bookmarks: [],
  }
}

/** Migrate any older saved project to the current schema. Throws on unknown future versions. */
export function migrateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new Error('Not a project file')
  const p = raw as Record<string, any>
  const v = typeof p.schemaVersion === 'number' ? p.schemaVersion : 0
  if (v > SCHEMA_VERSION) throw new Error(`Project schema v${v} is newer than supported v${SCHEMA_VERSION}`)
  const base = newProject()
  let out: any = { ...p }
  if (v < 1) {
    // v0 (pre-release drafts): single `objects` list, no scenarios
    if (Array.isArray(p.objects)) {
      const sc = emptyScenario('plan-a', 'Plan A')
      for (const o of p.objects) { sc.objects[o.id] = { params: {}, ageOffset: 0, scale: 1, rotY: 0, ...o }; sc.order.push(o.id) }
      out.scenarios = { [sc.id]: sc }
      out.scenarioOrder = [sc.id]
      out.activeScenarioId = sc.id
      delete out.objects
    }
  }
  out = { ...base, ...out, schemaVersion: SCHEMA_VERSION }
  out.site = { ...base.site, ...(out.site ?? {}) }
  out.images ??= []
  out.groups ??= {}
  out.ruleConfig ??= {}
  out.bookmarks ??= []
  if (!out.scenarios?.[out.activeScenarioId]) {
    out.activeScenarioId = out.scenarioOrder?.[0] ?? Object.keys(out.scenarios)[0]
  }
  return out as Project
}

export function serializeProject(p: Project): string {
  return JSON.stringify(p)
}
export function deserializeProject(s: string): Project {
  return migrateProject(JSON.parse(s))
}

let idCounter = 0
export function uid(prefix = 'o'): string {
  idCounter++
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}
