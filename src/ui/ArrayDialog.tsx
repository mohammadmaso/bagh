import { useState } from 'react'
import { useStore, activeScenario } from '../store/store'
import { useT } from '../i18n'
import { CATALOG, CATALOG_BY_ID } from '../data/catalog'
import { NumField, SelectField } from './widgets'
import { createArray, arrayPositions } from '../store/actions'

/** Array tool: a row of N items at spacing S along a straight line or a contour. */
export function ArrayDialog() {
  const { t, lang } = useT()
  const open = useStore((s) => s.ui.arrayDialog)
  const setUI = useStore((s) => s.setUI)
  const sel = useStore((s) => s.ui.selection)
  const objs = useStore((s) => activeScenario(s.project).objects)
  const site = useStore((s) => s.project.site)
  const [type, setType] = useState('apple')
  const [count, setCount] = useState(5)
  const [spacing, setSpacing] = useState(5)
  const [mode, setMode] = useState<'line' | 'contour'>('contour')
  const [angle, setAngle] = useState(0)
  const [align, setAlign] = useState(false)
  if (!open) return null
  const first = sel.map((i) => objs[i]).find(Boolean)
  const start = first ? { x: first.x, z: first.z } : { x: site.width * 0.15, z: site.depth * 0.45 }
  const itemType = first && !first.points ? first.type : type
  const preview = arrayPositions({ count, spacing, mode, angleDeg: angle, ...start })
  const create = () => {
    createArray({ type: itemType, count, spacing, mode, angleDeg: angle, ...start, alignToRow: align, ageOffset: first?.ageOffset ?? 0, params: first && first.type === itemType ? first.params : undefined })
    setUI({ arrayDialog: false })
  }
  return (
    <div className="dialog" role="dialog" aria-label={t('array.title')}>
      <h3>{t('array.title')}</h3>
      {!first && (
        <SelectField label={t('array.item')} value={type} options={CATALOG.filter((c) => c.kind === 'point').map((c) => ({ value: c.id, label: c.name[lang] }))} onChange={setType} />
      )}
      {first && <p className="hint">{CATALOG_BY_ID[itemType]?.name[lang]} — {t('array.startHint')}</p>}
      <NumField id="ar-n" label={t('array.count')} value={count} min={1} max={100} onChange={(v) => setCount(Math.round(v))} />
      <NumField id="ar-s" label={t('array.spacing')} value={spacing} min={0.1} max={50} onChange={setSpacing} />
      <SelectField label={t('array.mode')} value={mode} options={[{ value: 'contour', label: t('array.contour') }, { value: 'line', label: t('array.line') }]} onChange={setMode} />
      {mode === 'line' && <NumField id="ar-a" label={t('array.angle')} value={angle} onChange={setAngle} />}
      <label className="chk"><input type="checkbox" checked={align} onChange={(e) => setAlign(e.target.checked)} /> {t('array.align')}</label>
      <p className="hint">{preview.length} ×</p>
      <div className="btn-row">
        <button className="btn primary" onClick={create}>{t('array.create')}</button>
        <button className="btn" onClick={() => setUI({ arrayDialog: false })}>{t('btn.cancel')}</button>
      </div>
    </div>
  )
}
