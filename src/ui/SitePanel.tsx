import { useState } from 'react'
import { useStore } from '../store/store'
import { useT } from '../i18n'
import { NumField, SelectField } from './widgets'
import { DEFAULT_SITE } from '../data/site'

export function SitePanel() {
  const { t } = useT()
  const site = useStore((s) => s.project.site)
  const commit = useStore((s) => s.commit)
  const [ll, setLl] = useState(`${site.lat}, ${site.lon}`)
  const set = (fn: (s: typeof site) => void, key?: string) => commit((d) => fn(d.site), key)

  const applyLL = () => {
    const m = ll.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/)
    if (m) {
      const lat = parseFloat(m[1]), lon = parseFloat(m[2])
      if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) set((s) => { s.lat = lat; s.lon = lon })
    }
  }
  const edges = (['north', 'east', 'south', 'west'] as const).map((e) => ({ value: e, label: t(`site.edge.${e}` as const) }))

  return (
    <div>
      <h3>{t('site.title')}</h3>
      <p className="hint">{t('site.terrainNote')}</p>
      <NumField label={t('site.width')} value={site.width} min={5} max={200} onChange={(v) => set((s) => { s.width = v })} badge />
      <NumField label={t('site.depth')} value={site.depth} min={5} max={200} onChange={(v) => set((s) => { s.depth = v })} badge />
      <div className="field wide">
        <label htmlFor="ll">{t('site.latlon')} <span className="badge">?</span></label>
        <input id="ll" value={ll} placeholder={t('site.latlonHint')} onChange={(e) => setLl(e.target.value)} onBlur={applyLL}
          onPaste={(e) => { const tx = e.clipboardData.getData('text'); setLl(tx); setTimeout(applyLL, 0) }}
          onKeyDown={(e) => e.key === 'Enter' && applyLL()} />
      </div>
      <NumField label={t('site.elevation')} value={site.elevation} onChange={(v) => set((s) => { s.elevation = v })} badge />
      <NumField label={t('site.slope')} value={site.slopeDeg} min={0} max={45} onChange={(v) => set((s) => { s.slopeDeg = v })} />
      <NumField label={t('site.aspect')} value={site.aspectDeg} min={0} max={360} onChange={(v) => set((s) => { s.aspectDeg = v })} />
      <NumField label={t('site.cross')} value={site.crossSlopeDeg} min={-30} max={30} onChange={(v) => set((s) => { s.crossSlopeDeg = v })} />

      <h3>{t('site.fence')}</h3>
      <NumField label={t('site.fenceHeight')} value={site.fence.height} min={0.5} max={4} onChange={(v) => set((s) => { s.fence.height = v })} />
      <NumField label={t('site.postSpacing')} value={site.fence.postSpacing} min={1} max={6} onChange={(v) => set((s) => { s.fence.postSpacing = v })} />

      <h3>{t('site.gates')}</h3>
      {site.gates.map((g, i) => (
        <div key={g.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 6, marginBottom: 6 }}>
          <strong>{g.id}</strong>
          <SelectField label={t('site.gateEdge')} value={g.edge} options={edges} onChange={(v) => set((s) => { s.gates[i].edge = v })} />
          <NumField label={t('site.gateOffset')} value={g.offset} min={0} onChange={(v) => set((s) => { s.gates[i].offset = v })} id={`go${i}`} />
          <SelectField label={t('site.gateKind')} value={g.kind} options={[{ value: 'vehicle', label: t('site.gateVehicle') }, { value: 'pedestrian', label: t('site.gatePed') }]} onChange={(v) => set((s) => { s.gates[i].kind = v })} />
          <NumField label={t('site.gateWidth')} value={g.width} min={0.6} max={8} onChange={(v) => set((s) => { s.gates[i].width = v })} id={`gw${i}`} />
          <button className="btn" onClick={() => set((s) => { s.gates.splice(i, 1) })}>{t('site.gateRemove')}</button>
        </div>
      ))}
      <p><button className="btn" onClick={() => set((s) => { let n = 1; while (s.gates.some((x) => x.id === 'gate' + n)) n++; s.gates.push({ id: 'gate' + n, edge: 'south', offset: 2, width: 1, kind: 'pedestrian' }) })}>{t('site.gateAdd')}</button></p>
      <p className="hint">{t('site.dragHint')}</p>

      <h3>{t('site.house')}</h3>
      <NumField label={t('site.houseW')} value={site.house.width} min={2} max={20} onChange={(v) => set((s) => { s.house.width = v })} />
      <NumField label={t('site.houseD')} value={site.house.depth} min={2} max={20} onChange={(v) => set((s) => { s.house.depth = v })} />
      <NumField label={t('site.wallH')} value={site.house.wallHeight} min={2} max={6} onChange={(v) => set((s) => { s.house.wallHeight = v })} />
      <NumField label={t('site.pitch')} value={site.house.roofPitchDeg} min={5} max={60} onChange={(v) => set((s) => { s.house.roofPitchDeg = v })} />
      <NumField label={t('site.overhang')} value={site.house.overhang} min={0} max={2} onChange={(v) => set((s) => { s.house.overhang = v })} />
      <NumField label={t('site.setback')} value={site.house.setbackSouth} min={0} onChange={(v) => set((s) => { s.house.setbackSouth = v })} />
      <NumField label={t('site.offsetX')} value={site.house.offsetX} onChange={(v) => set((s) => { s.house.offsetX = v })} />

      <SelectField label={t('site.doorWall')} value={site.house.door.wall} options={edges} onChange={(v) => set((s) => { s.house.door.wall = v })} />
      <NumField label={t('site.doorOffset')} value={site.house.door.offset} onChange={(v) => set((s) => { s.house.door.offset = v })} id="do-off" />
      <NumField label={t('site.doorWidth')} value={site.house.door.width} min={0.6} max={3} onChange={(v) => set((s) => { s.house.door.width = v })} id="do-w" />

      <h3>{t('site.horizon')}</h3>
      {site.horizon.map((h, i) => (
        <NumField key={h.az} label={`${h.az}°`} value={h.el} min={0} max={60} id={`hz${i}`} onChange={(v) => set((s) => { s.horizon[i].el = v })} />
      ))}
      <p style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => set((s) => { Object.assign(s, structuredClone(DEFAULT_SITE)) })}>{t('site.reset')}</button>
      </p>
    </div>
  )
}
