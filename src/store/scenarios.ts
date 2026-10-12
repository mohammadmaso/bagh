import { current, isDraft } from 'immer'
import { useStore } from './store'
import { uid, emptyScenario } from '../core/project'

export function addScenario(name?: string, copyFrom?: string): string {
  const id = uid('plan')
  useStore.getState().commit((d) => {
    const src = copyFrom ? d.scenarios[copyFrom] : null
    const n = d.scenarioOrder.length
    const sc = src ? structuredClone(isDraft(src) ? current(src) : src) : emptyScenario(id, '')
    sc.id = id
    sc.name = name ?? (src ? `${src.name} copy` : `Plan ${String.fromCharCode(65 + n)}`)
    if (src) {
      // fresh object ids so plans never share identity
      const map: Record<string, string> = {}
      const objs: typeof sc.objects = {}
      for (const oid of sc.order) { const nid = uid(); map[oid] = nid; objs[nid] = { ...sc.objects[oid], id: nid } }
      sc.objects = objs
      sc.order = sc.order.map((o) => map[o])
    }
    d.scenarios[id] = sc
    d.scenarioOrder.push(id)
    d.activeScenarioId = id
  })
  useStore.getState().setUI({ selection: [] })
  return id
}

export function setActiveScenario(id: string) {
  useStore.getState().silent((d) => { if (d.scenarios[id]) d.activeScenarioId = id })
  useStore.getState().setUI({ selection: [] })
}

export function renameScenario(id: string, name: string) {
  useStore.getState().commit((d) => { if (d.scenarios[id]) d.scenarios[id].name = name }, 'rename:' + id)
}

export function deleteScenario(id: string) {
  const { project } = useStore.getState()
  if (project.scenarioOrder.length <= 1) return
  useStore.getState().commit((d) => {
    delete d.scenarios[id]
    d.scenarioOrder = d.scenarioOrder.filter((x) => x !== id)
    if (d.activeScenarioId === id) d.activeScenarioId = d.scenarioOrder[0]
  })
  if (useStore.getState().ui.compareWith === id) useStore.getState().setUI({ compareWith: null })
}
