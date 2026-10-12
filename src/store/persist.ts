import { get, set, del } from 'idb-keyval'
import { useStore, type UIState } from './store'
import { deserializeProject, serializeProject, newProject, type Project } from '../core/project'

const KEY = 'garden:project:v1'
const PREFS = 'garden:prefs:v1'
const PREF_KEYS: (keyof UIState)[] = ['lang', 'persianDigits', 'theme', 'quality', 'qualityAuto', 'gridSnap', 'edgeSnap', 'allowOverlap', 'showRules', 'showLabels', 'tourDone', 'walkSpeed']

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS)
    if (raw) useStore.setState((s) => ({ ui: { ...s.ui, ...JSON.parse(raw) } }))
  } catch { /* storage unavailable */ }
}

function savePrefs() {
  try {
    const ui = useStore.getState().ui
    const o: Record<string, unknown> = {}
    for (const k of PREF_KEYS) o[k] = ui[k]
    localStorage.setItem(PREFS, JSON.stringify(o))
  } catch { /* ignore */ }
}

export async function loadAutosave(): Promise<boolean> {
  try {
    const raw = await get<string>(KEY)
    if (!raw) return false
    useStore.getState().replaceProject(deserializeProject(raw))
    return true
  } catch (e) {
    console.warn('autosave could not be restored', e)
    return false
  }
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
let saveListeners: ((s: SaveState) => void)[] = []
export const onSaveState = (f: (s: SaveState) => void) => { saveListeners.push(f); return () => { saveListeners = saveListeners.filter((x) => x !== f) } }
const emit = (s: SaveState) => saveListeners.forEach((f) => f(s))

export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastRev = useStore.getState().rev
  let lastPrefs = ''
  useStore.subscribe((s) => {
    const prefs = PREF_KEYS.map((k) => String(s.ui[k])).join('|')
    if (prefs !== lastPrefs) { lastPrefs = prefs; savePrefs() }
    if (s.rev === lastRev) return
    lastRev = s.rev
    if (timer) clearTimeout(timer)
    emit('saving')
    timer = setTimeout(async () => {
      try { await set(KEY, serializeProject(useStore.getState().project)); emit('saved') } catch (e) { console.warn('autosave failed', e); emit('error') }
    }, 700)
  })
}

export async function clearAutosave() { try { await del(KEY) } catch { /* ignore */ } }

export function exportProjectJSON(): Blob {
  const p = useStore.getState().project
  return new Blob([JSON.stringify({ ...p, exportedAt: new Date().toISOString(), generator: 'garden-studio' }, null, 1)], { type: 'application/json' })
}

export async function importProjectFile(file: File): Promise<Project> {
  const text = await file.text()
  const p = deserializeProject(text) // migrates and validates the schema version
  useStore.getState().replaceProject(p)
  useStore.getState().setUI({ selection: [] })
  return p
}

export function newBlankProject() {
  useStore.getState().replaceProject(newProject())
  useStore.getState().setUI({ selection: [] })
}
