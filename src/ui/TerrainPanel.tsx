import { useEffect, useMemo, useState } from 'react'
import { useStore, activeScenario } from '../store/store'
import { useT } from '../i18n'
import { NumField } from './widgets'
import { createTerrain } from '../core/terrain'
import { decodeSculpt, encodeSculpt, generateTerraces, addDelta, isFlat } from '../core/sculpt'
import { uid } from '../core/project'
import { engine } from '../render/engine'
import { interaction } from './Viewport'
import { placeObject } from '../store/actions'
import { housePlacement } from '../render/siteLayer'
import type { OverlayLayer } from '../render/overlayLayer'

const MODES = ['raise', 'lower', 'smooth', 'flatten'] as const

export function TerrainPanel() {
  const { t, tx, n } = useT()
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const project = useStore((s) => s.project)
  const commit = useStore((s) => s.commit)
  const site = project.site
  const hp = housePlacement(site, createTerrain(site))
  const [region, setRegion] = useState({ x0: 2, x1: site.width - 2, z0: 2, z1: Math.max(6, hp.cz - hp.d / 2 - 2) })
  const [wallH, setWallH] = useState(0.6)

  const preview = useMemo(() => {
    const grid = decodeSculpt(project.sculpt, site)
    const base = createTerrain(site, grid)
    return generateTerraces(base, grid, { region, wallHeight: wallH })
  }, [project.sculpt, site, region, wallH])

  // show planned walls in the 3D view while this panel is open
  useEffect(() => {
    const ov = (window as any).__overlay as OverlayLayer | undefined
    ov?.setGhost(engine.ctx, { previewLines: preview.walls })
    return () => ov?.setGhost(engine.ctx, { previewLines: null })
  }, [preview])

  const apply = () => {
    commit((d) => {
      const grid = decodeSculpt(d.sculpt as any, d.site)
      d.sculpt = encodeSculpt(addDelta(grid, preview.delta))
      const sc = d.scenarios[d.activeScenarioId]
      const gid = uid('g')
      d.groups[gid] = { id: gid, name: 'Terraces' }
      for (const w of preview.walls) {
        const id = uid()
        sc.objects[id] = { id, type: 'retaining-wall', x: 0, z: 0, rotY: 0, scale: 1, points: w.map((p) => ({ x: p.x, z: p.z })), params: { width: 0.35, height: wallH }, ageOffset: 0, groupId: gid }
        sc.order.push(id)
      }
    })
  }
  const flat = !project.sculpt || isFlat(decodeSculpt(project.sculpt, site))
  void activeScenario
  return (
    <div>
      <h3>{tx('tr.sculpt')}</h3>
      <div className="btn-row" role="group">
        <button className="btn" aria-pressed={ui.tool === 'sculpt'} onClick={() => setUI({ tool: ui.tool === 'sculpt' ? 'select' : 'sculpt' })}>{t('tool.sculpt')}</button>
      </div>
      <div className="btn-row" role="group" aria-label={tx('tr.mode')}>
        {MODES.map((m) => <button key={m} className="btn" aria-pressed={ui.brush.mode === m} onClick={() => setUI({ brush: { ...ui.brush, mode: m }, tool: 'sculpt' })}>{tx('tr.' + m)}</button>)}
      </div>
      <NumField id="br-r" label={tx('tr.radius')} value={ui.brush.radius} min={0.5} max={12} onChange={(v) => setUI({ brush: { ...ui.brush, radius: v } })} />
      <NumField id="br-s" label={tx('tr.strength')} value={ui.brush.strength} min={0.05} max={5} onChange={(v) => setUI({ brush: { ...ui.brush, strength: v } })} />
      <p className="hint">{tx('tr.sculptHint')}</p>
      <div className="btn-row"><button className="btn" disabled={flat} onClick={() => commit((d) => { d.sculpt = null })}>{tx('tr.reset')}</button></div>

      <h3>{tx('tr.pad')}</h3>
      <p className="hint">{tx('tr.padHint')}</p>
      <div className="btn-row"><button className="btn" onClick={() => { const c = interactionCentre(); placeObject('level-pad', c.x, c.z) }}>{tx('tr.addPad')}</button></div>

      <h3>{tx('tr.terraces')}</h3>
      <p className="hint">{tx('tr.terraceHint')}</p>
      <NumField id="tt-x0" label="X from (m)" value={region.x0} onChange={(v) => setRegion({ ...region, x0: v })} />
      <NumField id="tt-x1" label="X to (m)" value={region.x1} onChange={(v) => setRegion({ ...region, x1: v })} />
      <NumField id="tt-z0" label="Z from (m)" value={region.z0} onChange={(v) => setRegion({ ...region, z0: v })} />
      <NumField id="tt-z1" label="Z to (m)" value={region.z1} onChange={(v) => setRegion({ ...region, z1: v })} />
      <NumField id="tt-h" label={tx('tr.wallH')} value={wallH} min={0.2} max={2} onChange={setWallH} />
      <p className="hint">{tx('tr.preview', { walls: preview.walls.length, cut: n(preview.cut, 1), fill: n(preview.fill, 1) })}</p>
      <div className="btn-row"><button className="btn primary" disabled={preview.walls.length === 0} onClick={apply}>{tx('tr.generate')}</button></div>
    </div>
  )
}

function interactionCentre() {
  const h = interaction?.hitPoint
  const s = useStore.getState().project.site
  return h ? { x: h.x, z: h.z } : { x: s.width / 2, z: s.depth / 2 - 4 }
}
