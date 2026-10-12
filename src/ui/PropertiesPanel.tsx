import { useStore, updateObjects, activeScenario } from '../store/store'
import { useT } from '../i18n'
import { CATALOG_BY_ID } from '../data/catalog'
import { PLANTS } from '../data/plants'
import { plantSizeAt } from '../core/growth'
import { NumField, SelectField } from './widgets'
import { deleteSelection, duplicateSelection, toggleLock, toggleHide } from '../store/actions'
import { polylineLength } from '../core/geometry2d'
import { engine } from '../render/engine'
import type { PlacedObject } from '../core/project'

export function PropertiesPanel() {
  const { t, n, lang } = useT()
  const sel = useStore((s) => s.ui.selection)
  const objs = useStore((s) => activeScenario(s.project).objects)
  const time = useStore((s) => s.ui.time)
  const list = sel.map((id) => objs[id]).filter(Boolean)
  if (!list.length) return <p className="hint">{t('prop.none')}</p>
  if (list.length > 1) {
    return (
      <div>
        <h3>{t('prop.multi', { n: list.length })}</h3>
        <div className="btn-row">
          <button className="btn" onClick={duplicateSelection}>{t('ctx.duplicate')}</button>
          <button className="btn" onClick={() => toggleLock()}>{t('ctx.lock')}</button>
          <button className="btn" onClick={() => toggleHide()}>{t('ctx.hide')}</button>
          <button className="btn" onClick={deleteSelection}>{t('btn.delete')}</button>
        </div>
      </div>
    )
  }
  const o = list[0]
  const item = CATALOG_BY_ID[o.type]
  const set = (fn: (o: PlacedObject) => void, key: string) => updateObjects([o.id], fn, `prop:${o.id}:${key}`)
  const sp = item.plant ? PLANTS[item.plant] : null
  const size = sp ? plantSizeAt(sp, Math.max(0, time.ageYears + o.ageOffset)) : null
  const terrain = engine.terrain
  const groundH = terrain ? terrain.heightAt(o.x, o.z) : 0
  const slope = terrain ? terrain.slopeAt(o.x, o.z).slopeDeg : 0
  const deg = (r: number) => ((r * 180) / Math.PI)
  const mon = (a?: [number, number]) => a ? new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'en', { month: 'short' }).format(new Date(2026, a[0] - 1, 1)) + (a[0] !== a[1] ? ' – ' + new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'en', { month: 'short' }).format(new Date(2026, a[1] - 1, 1)) : '') : '—'

  return (
    <div>
      <h3>{item.name[lang]}</h3>
      <div className="btn-row">
        <button className="btn" onClick={duplicateSelection} title="Ctrl+D">{t('ctx.duplicate')}</button>
        <button className="btn" aria-pressed={!!o.locked} onClick={() => toggleLock()}>{t('prop.locked')}</button>
        <button className="btn" aria-pressed={!!o.hidden} onClick={() => toggleHide()}>{t('prop.hidden')}</button>
        <button className="btn" onClick={deleteSelection}>{t('btn.delete')}</button>
      </div>
      <div className="field wide">
        <label htmlFor="p-label">{t('prop.label')}</label>
        <input id="p-label" value={o.label ?? ''} onChange={(e) => set((x) => { x.label = e.target.value || undefined }, 'label')} />
      </div>
      {item.kind === 'point' && (
        <>
          <NumField id="p-x" label={t('prop.x')} value={o.x} onChange={(v) => set((x) => { x.x = v }, 'x')} />
          <NumField id="p-z" label={t('prop.z')} value={o.z} onChange={(v) => set((x) => { x.z = v }, 'z')} />
          <NumField id="p-rot" label={t('prop.rot')} value={Math.round(deg(o.rotY) * 10) / 10} onChange={(v) => set((x) => { x.rotY = (v * Math.PI) / 180 }, 'rot')} />
          <NumField id="p-scale" label={t('prop.scale')} value={o.scale} min={0.1} max={10} onChange={(v) => set((x) => { x.scale = v }, 'scale')} />
          <p className="hint">{t('prop.groundH')}: {n(groundH, 2)} · {t('prop.slope')}: {n(slope, 1)}</p>
        </>
      )}
      {item.kind === 'polyline' && o.points && (
        <>
          <p className="hint">{t('prop.points')}: {o.points.length} · {t('prop.length')}: {n(polylineLength(o.points), 1)}</p>
          <NumField id="p-w" label={t('prop.width')} value={typeof o.params.width === 'number' ? (o.params.width as number) : item.polyline!.width} min={item.polyline!.minWidth} max={item.polyline!.maxWidth} onChange={(v) => set((x) => { x.params.width = v }, 'width')} />
          {(item.model === 'hedgerow' || item.model === 'flight-barrier' || item.model === 'retaining-wall' || item.model === 'fence-line') && (
            <NumField id="p-h" label={t('prop.height')} value={typeof o.params.height === 'number' ? (o.params.height as number) : item.height} min={0.2} max={6} onChange={(v) => set((x) => { x.params.height = v }, 'height')} />
          )}
          {item.model === 'swale' && (
            <NumField id="p-d" label={t('prop.depth')} value={typeof o.params.depth === 'number' ? (o.params.depth as number) : 0.35} min={0.1} max={1} onChange={(v) => set((x) => { x.params.depth = v }, 'depth')} />
          )}
        </>
      )}
      {(item.params ?? []).filter((p) => p.key !== 'ageOffset' && !(p.type === 'number' && p.min === 0 && p.max === 0)).map((p) => {
        const v = o.params[p.key] ?? p.def
        if (p.type === 'select') {
          return <SelectField key={p.key} label={p.label[lang]} value={String(v)} options={(p.options ?? []).map((x) => ({ value: x.value, label: x.label[lang] }))} onChange={(nv) => set((x) => { x.params[p.key] = nv }, p.key)} />
        }
        return <NumField key={p.key} id={'pp-' + p.key} label={p.label[lang]} value={Number(v)} min={p.min} max={p.max} step={p.step} onChange={(nv) => set((x) => { x.params[p.key] = nv }, p.key)} />
      })}
      {sp && size && (
        <>
          <NumField id="p-age" label={t('prop.age')} value={o.ageOffset} min={0} max={30} onChange={(v) => set((x) => { x.ageOffset = v }, 'age')} />
          <h3>{t('plant.title')} <span className="badge" title={t('plant.approx')}>{t('plant.approx')}</span></h3>
          <table className="kv"><tbody>
            <tr><td>{t('plant.sizeNow')}</td><td>{n(size.height, 1)} × {n(size.canopy, 1)} m ({Math.round(size.fraction * 100)}%)</td></tr>
            <tr><td>{t('plant.matureH')}</td><td>{n(sp.matureHeight, 1)}</td></tr>
            <tr><td>{t('plant.canopy')}</td><td>{n(sp.matureCanopy, 1)}</td></tr>
            <tr><td>{t('plant.spacing')}</td><td>{n(sp.spacing, 1)}</td></tr>
            <tr><td>{t('plant.fruitYears')}</td><td>{sp.yearsToFruit >= 99 ? '—' : n(sp.yearsToFruit, 0)}</td></tr>
            <tr><td>{t('plant.sun')}</td><td>{t(`sun.${sp.sun}` as const)} (≥{n(sp.sunHoursMin, 0)} h)</td></tr>
            <tr><td>{t('plant.bloom')}</td><td>{mon(sp.bloom)}</td></tr>
            <tr><td>{t('plant.harvest')}</td><td>{mon(sp.harvest)}</td></tr>
          </tbody></table>
          {sp.notes && <p className="hint">{sp.notes}</p>}
        </>
      )}
    </div>
  )
}
