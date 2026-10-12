import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { useT } from '../i18n'
import { addScenario, setActiveScenario, renameScenario, deleteScenario } from '../store/scenarios'
import { summarizeScenario } from '../core/summary'
import { engine } from '../render/engine'
import { useAnalysis } from '../store/analysis'

export function PlansPanel() {
  const { tx, n } = useT()
  const project = useStore((s) => s.project)
  const compare = useStore((s) => s.ui.compareWith)
  const setUI = useStore((s) => s.setUI)
  const [editing, setEditing] = useState<string | null>(null)
  const growing = useAnalysis((s) => s.growing.grid)
  const rows = useMemo(() => project.scenarioOrder.map((id) => ({ id, name: project.scenarios[id].name, s: summarizeScenario(project, id, engine.terrain, growing) })), [project, growing])
  const active = project.activeScenarioId
  const startCompare = (id: string) => { setUI({ compareWith: compare === id ? null : id, view: 'persp' }) }
  return (
    <div>
      <div className="btn-row">
        <button className="btn primary" onClick={() => addScenario()}>{tx('pl.new')}</button>
        <button className="btn" onClick={() => addScenario(undefined, active)}>{tx('pl.duplicate')}</button>
      </div>
      <ul className="plan-list">
        {rows.map((r) => (
          <li key={r.id} className={r.id === active ? 'active' : ''}>
            <label className="plan-name">
              <input type="radio" name="plan" checked={r.id === active} onChange={() => setActiveScenario(r.id)} aria-label={r.name} />
              {editing === r.id
                ? <input autoFocus defaultValue={r.name} onBlur={(e) => { renameScenario(r.id, e.target.value || r.name); setEditing(null) }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
                : <span onDoubleClick={() => setEditing(r.id)}>{r.name}</span>}
            </label>
            <span className="plan-actions">
              <button className="btn" onClick={() => setEditing(r.id)} aria-label={tx('pl.rename')} title={tx('pl.rename')}>✎</button>
              {r.id !== active && <button className="btn" aria-pressed={compare === r.id} onClick={() => startCompare(r.id)} title={tx('pl.compare')}>⇄</button>}
              <button className="btn" disabled={rows.length <= 1} onClick={() => deleteScenario(r.id)} aria-label={tx('pl.delete')} title={tx('pl.delete')}>🗑</button>
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">{tx('pl.compareHint')}</p>
      <table className="kv report">
        <thead><tr><th></th>{rows.map((r) => <th key={r.id}>{r.name}</th>)}</tr></thead>
        <tbody>
          {([['pl.trees', 'trees', 0], ['pl.beds', 'beds', 0], ['pl.bedArea', 'bedArea', 1], ['pl.hives', 'hives', 0], ['pl.coops', 'coops', 0], ['pl.paths', 'pathLength', 1], ['pl.tanks', 'tankL', 0], ['pl.errors', 'errors', 0], ['pl.warnings', 'warnings', 0]] as const).map(([label, key, d]) => (
            <tr key={key}><td>{tx(label)}</td>{rows.map((r) => <td key={r.id}>{n(r.s[key], d)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
