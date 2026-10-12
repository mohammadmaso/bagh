import { useMemo } from 'react'
import { useStore, activeScenario } from '../store/store'
import { useT } from '../i18n'
import { computeQuantities, quantitiesToCSV } from '../core/quantities'
import { CATALOG_BY_ID, CATEGORIES } from '../data/catalog'
import { downloadText } from './download'

export function QuantitiesPanel() {
  const { tx, n, lang } = useT()
  const site = useStore((s) => s.project.site)
  const objs = useStore((s) => activeScenario(s.project).objects)
  const name = useStore((s) => s.project.name)
  const q = useMemo(() => computeQuantities(Object.values(objs), site), [objs, site])
  const nameOf = (id: string) => CATALOG_BY_ID[id]?.name[lang] ?? id
  const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name[lang] ?? id
  const T = q.totals
  const exportCsv = () => downloadText(`${name || 'garden'}-quantities.csv`, quantitiesToCSV(q, nameOf, [tx('q.item'), tx('q.category'), tx('q.count'), tx('q.area'), tx('q.length'), tx('q.litres')]), 'text/csv;charset=utf-8')
  return (
    <div>
      <div className="btn-row"><button className="btn primary" onClick={exportCsv}>{tx('q.export')}</button></div>
      <h3>{tx('q.totals')}</h3>
      <table className="kv"><tbody>
        <tr><td>{tx('q.trees')}</td><td>{T.trees}</td></tr>
        <tr><td>{tx('q.beds')}</td><td>{T.beds} · {n(T.bedArea, 1)} m²</td></tr>
        <tr><td>{tx('q.hives')}</td><td>{T.hives}</td></tr>
        <tr><td>{tx('q.coops')}</td><td>{T.coops}</td></tr>
        <tr><td>{tx('q.paths')}</td><td>{n(T.pathLength, 1)} m</td></tr>
        <tr><td>{tx('q.pipes')}</td><td>{n(T.pipeLength, 1)} m</td></tr>
        <tr><td>{tx('q.fence')}</td><td>{n(T.fenceLength, 1)} m</td></tr>
        <tr><td>{tx('q.tanks')}</td><td>{n(T.tankCapacityL, 0)} L</td></tr>
      </tbody></table>
      <h3>{tx('q.title')}</h3>
      {q.rows.length === 0 ? <p className="hint">{tx('q.empty')}</p> : (
        <table className="kv"><thead><tr><th>{tx('q.item')}</th><th>{tx('q.count')}</th><th>{tx('q.area')}</th><th>{tx('q.length')}</th></tr></thead>
          <tbody>{q.rows.map((r) => (
            <tr key={r.typeId} title={catName(r.category)}><td>{nameOf(r.typeId)}</td><td>{r.count}</td><td>{r.area ? n(r.area, 1) : ''}</td><td>{r.length ? n(r.length, 1) : r.capacityL ? `${n(r.capacityL, 0)} L` : ''}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
