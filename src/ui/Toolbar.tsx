import { useStore } from '../store/store'
import { useT } from '../i18n'

export function Toolbar() {
  const { t } = useT()
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const tools = [
    { id: 'select', icon: '⌖', label: t('tool.select') },
    { id: 'path', icon: '〰', label: t('tool.path') },
    { id: 'measure', icon: '📏', label: t('tool.measure') },
  ] as const
  const views = ['persp', 'plan', 'section', 'walk'] as const
  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      <span className="seg" role="group" aria-label="Tool">
        {tools.map((x) => (
          <button key={x.id} className="btn" aria-pressed={ui.tool === x.id || (x.id === 'select' && ui.tool === 'place')} title={x.label} aria-label={x.label}
            onClick={() => setUI({ tool: x.id, placingType: x.id === 'path' ? ui.placingType ?? 'path-gravel' : null })}>{x.icon}</button>
        ))}
      </span>
      <span className="seg" role="group" aria-label="Gizmo">
        {(['translate', 'rotate', 'scale'] as const).map((g, i) => (
          <button key={g} className="btn" aria-pressed={ui.gizmo === g} title={t(`gizmo.${g}` as const)} aria-label={t(`gizmo.${g}` as const)} onClick={() => setUI({ gizmo: g })}>{['✥', '⟳', '⤢'][i]}</button>
        ))}
      </span>
      <label className="inl" title={t('snap.grid')}>
        {t('snap.grid')}
        <select value={ui.gridSnap} onChange={(e) => setUI({ gridSnap: +e.target.value })} aria-label={t('snap.grid')}>
          <option value={0}>{t('snap.off')}</option><option value={0.25}>0.25 m</option><option value={0.5}>0.5 m</option><option value={1}>1 m</option>
        </select>
      </label>
      <button className="btn" aria-pressed={ui.edgeSnap} onClick={() => setUI({ edgeSnap: !ui.edgeSnap })}>{t('snap.edges')}</button>
      <button className="btn" aria-pressed={ui.allowOverlap} onClick={() => setUI({ allowOverlap: !ui.allowOverlap })}>{t('snap.overlap')}</button>
      <button className="btn" aria-pressed={ui.showLabels} onClick={() => setUI({ showLabels: !ui.showLabels })}>{t('label.show')}</button>
      <div className="spacer" />
      <span className="seg" role="group" aria-label="View">
        {views.map((v, i) => (
          <button key={v} className="btn" aria-pressed={ui.view === v} onClick={() => setUI({ view: v })} title={`${i + 1}`}>{t(`view.${v}` as const)}</button>
        ))}
      </span>
    </div>
  )
}
