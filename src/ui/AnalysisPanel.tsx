import { useStore, activeScenario } from '../store/store'
import { useAnalysis, runSunAnalysis, runTerrainAnalyses, type PresetId } from '../store/analysis'
import { useT } from '../i18n'
import { CATALOG_BY_ID } from '../data/catalog'
import { SLOPE_BANDS, SUN_MAX_HOURS } from '../render/analysisOverlay'
import { heatColor } from '../core/analysis/terrainAnalysis'
import { focusObject } from './focus'
import { NumField } from './widgets'

const PRESETS: PresetId[] = ['today', 'spring', 'summer', 'autumn', 'winter']
const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`

export function AnalysisPanel() {
  const { t, tx, n, lang } = useT()
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const objs = useStore((s) => activeScenario(s.project).objects)
  const sun = useAnalysis((s) => s.sun)
  const cutfill = useAnalysis((s) => s.cutfill)
  const layers = [
    { id: 'none', label: tx('an.layer.none') }, { id: 'sun', label: tx('an.layer.sun') }, { id: 'slope', label: tx('an.layer.slope') },
    { id: 'flow', label: tx('an.layer.flow') }, { id: 'contours', label: tx('an.layer.contours') },
  ] as const
  const running = sun.status === 'running'
  const stops = Array.from({ length: 8 }, (_, i) => rgb(heatColor(i / 7)))

  return (
    <div>
      <h3>{tx('an.layers')}</h3>
      <div className="btn-row" role="group" aria-label={tx('an.layers')}>
        {layers.map((l) => (
          <button key={l.id} className="btn" aria-pressed={ui.overlay === l.id} onClick={() => { setUI({ overlay: l.id }); if (l.id === 'sun' && !sun.result) void runSunAnalysis() }}>{l.label}</button>
        ))}
      </div>

      <h3>{tx('an.sun')}</h3>
      <p className="hint">{tx('an.note')}</p>
      <div className="btn-row">
        <button className="btn primary" disabled={running} onClick={() => void runSunAnalysis()}>{running ? `${tx('an.running')} ${Math.round(sun.progress * 100)}%` : tx('an.run')}</button>
      </div>
      {running && <progress value={sun.progress} max={1} style={{ width: '100%' }} aria-label={tx('an.running')} />}
      {sun.status === 'error' && <p className="hint" style={{ color: 'var(--danger)' }}>{sun.error}</p>}
      {sun.stale && sun.status === 'done' && <p className="hint" style={{ color: 'var(--warn)' }}>{tx('an.stale')}</p>}
      <div className="btn-row" role="group">
        {PRESETS.map((p) => (
          <button key={p} className="btn" aria-pressed={ui.sunHoursPreset === p} onClick={() => setUI({ sunHoursPreset: p, overlay: sun.result ? 'sun' : ui.overlay })}>{tx('an.preset.' + p)}</button>
        ))}
      </div>
      {ui.overlay === 'sun' && (
        <div className="legend" aria-label={tx('an.legend')}>
          <div className="ramp" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
          <div className="ticks"><span>0</span><span>{n(SUN_MAX_HOURS / 2, 0)}</span><span>{n(SUN_MAX_HOURS, 0)} {tx('an.h')}</span></div>
          <p className="hint">{tx('an.legend')}</p>
        </div>
      )}
      {ui.overlay === 'slope' && (
        <div className="legend"><p className="hint">{tx('an.slopeLegend')}</p>
          {SLOPE_BANDS.map((b, i) => <div key={i} className="chip"><i style={{ background: rgb(b.color) }} />≤ {b.max}°</div>)}
        </div>
      )}
      {ui.overlay === 'flow' && <p className="hint">{tx('an.flowLegend')}</p>}

      <h3>{tx('an.report')}</h3>
      {sun.rows.length === 0 ? <p className="hint">{tx('an.noReport')}</p> : (
        <table className="kv report"><thead><tr><th></th>{(['summer', 'winter'] as const).map((k) => <th key={k}>{tx('an.preset.' + k)}</th>)}<th>{tx('an.growing')}</th></tr></thead>
          <tbody>
            {sun.rows.filter((r) => objs[r.id]).map((r) => {
              const o = objs[r.id]
              return (
                <tr key={r.id} className="clickable" onClick={() => focusObject(r.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && focusObject(r.id)}>
                  <td>{o.label || CATALOG_BY_ID[r.type].name[lang]}</td>
                  <td>{n(r.values.summer, 1)} {tx('an.h')}</td><td>{n(r.values.winter, 1)} {tx('an.h')}</td><td>{Number.isFinite(r.growing) ? n(r.growing, 1) : '—'} {tx('an.h')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <h3>{tx('an.layer.slope')} / {tx('an.layer.flow')}</h3>
      <div className="btn-row"><button className="btn" onClick={() => runTerrainAnalyses()}>{tx('an.recompute')}</button></div>
      {cutfill && (cutfill.cut > 0 || cutfill.fill > 0) && <p className="hint">{tx('an.cutfill', { cut: n(cutfill.cut, 1), fill: n(cutfill.fill, 1) })}</p>}
      <NumFieldGuard />
    </div>
  )
}
function NumFieldGuard() { return null }
void NumField
