import { useEffect, useRef, useState } from 'react'
import { useStore, activeScenario } from '../store/store'
import { useT } from '../i18n'
import { downloadBlob, downloadText } from './download'
import { exportProjectJSON, importProjectFile, newBlankProject, onSaveState, type SaveState } from '../store/persist'
import { engine } from '../render/engine'
import { capturePNG, type PngSize } from '../export/png'
import { buildPlanPDF } from '../export/pdf'
import { exportGLB } from '../export/glb'
import { recordTurntable, recordFlythrough, type RecordHandle } from '../export/video'
import { computeQuantities, quantitiesToCSV } from '../core/quantities'
import { CATALOG_BY_ID } from '../data/catalog'
import { buildExample, EXAMPLE_PLAN_ID, EXAMPLE_PLAN_NAME } from '../data/example'
import { emptyScenario } from '../core/project'
import { createTerrain } from '../core/terrain'
import { SHORTCUTS } from './shortcuts'

const slug = (s: string) => (s || 'garden').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'garden'

export function loadExample() {
  const st = useStore.getState()
  const terrain = createTerrain(st.project.site)
  const objs = buildExample(terrain)
  st.commit((d) => {
    const sc = emptyScenario(EXAMPLE_PLAN_ID, EXAMPLE_PLAN_NAME)
    for (const o of objs) { sc.objects[o.id] = o; sc.order.push(o.id) }
    if (d.scenarios[EXAMPLE_PLAN_ID]) { d.scenarioOrder = d.scenarioOrder.filter((x) => x !== EXAMPLE_PLAN_ID) }
    d.scenarios[EXAMPLE_PLAN_ID] = sc
    d.scenarioOrder.push(EXAMPLE_PLAN_ID)
    d.activeScenarioId = EXAMPLE_PLAN_ID
  })
  st.setUI({ selection: [] })
}

export function removeExample() {
  const st = useStore.getState()
  if (!st.project.scenarios[EXAMPLE_PLAN_ID]) return
  st.commit((d) => {
    delete d.scenarios[EXAMPLE_PLAN_ID]
    d.scenarioOrder = d.scenarioOrder.filter((x) => x !== EXAMPLE_PLAN_ID)
    if (!d.scenarioOrder.length) { const s = emptyScenario('plan-a', 'Plan A'); d.scenarios[s.id] = s; d.scenarioOrder.push(s.id) }
    if (d.activeScenarioId === EXAMPLE_PLAN_ID) d.activeScenarioId = d.scenarioOrder[0]
  })
  if (st.ui.compareWith === EXAMPLE_PLAN_ID) st.setUI({ compareWith: null })
}

export function SaveIndicator() {
  const { tx } = useT()
  const [s, setS] = useState<SaveState>('idle')
  useEffect(() => onSaveState(setS), [])
  if (s === 'idle') return null
  return <span className={'save-ind ' + s} aria-live="polite">{s === 'saving' ? tx('file.saving') : s === 'saved' ? '✓ ' + tx('file.saved') : '⚠ ' + tx('file.unsaved')}</span>
}

export function Menu({ label, tour, children }: { label: string; tour?: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', h)
    return () => window.removeEventListener('pointerdown', h)
  }, [open])
  return (
    <span className="menu-wrap" ref={ref} data-tour={tour}>
      <button className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{label} ▾</button>
      {open && <div className="menu" role="menu">{children(() => setOpen(false))}</div>}
    </span>
  )
}

export function FileMenu() {
  const { tx } = useT()
  const [exporting, setExporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const name = useStore((s) => s.project.name)
  const hasExample = useStore((s) => !!s.project.scenarios[EXAMPLE_PLAN_ID])
  const setUI = useStore((s) => s.setUI)
  const onOpen = async (f?: File) => {
    if (!f) return
    try { await importProjectFile(f) } catch (e) { setUI({ toast: String((e as Error).message) }) }
    if (fileRef.current) fileRef.current.value = ''
  }
  return (
    <>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onOpen(e.target.files?.[0])} />
      <Menu label={tx('file.menu')} tour="file">
        {(close) => (
          <>
            <button role="menuitem" onClick={() => { close(); if (confirm(tx('file.confirmNew'))) newBlankProject() }}>{tx('file.new')}</button>
            <button role="menuitem" onClick={() => { close(); fileRef.current?.click() }}>{tx('file.open')}</button>
            <button role="menuitem" onClick={() => { close(); downloadBlob(`${slug(name)}.garden.json`, exportProjectJSON()) }}>{tx('file.save')}</button>
            <button role="menuitem" onClick={() => { close(); setExporting(true) }}>{tx('file.export')}</button>
            <hr />
            {!hasExample ? <button role="menuitem" onClick={() => { close(); loadExample() }}>{tx('file.example')}</button> : <button role="menuitem" onClick={() => { close(); removeExample() }}>{tx('file.removeExample')}</button>}
          </>
        )}
      </Menu>
      {exporting && <ExportDialog onClose={() => setExporting(false)} />}
    </>
  )
}

export function HelpMenu({ onTour }: { onTour: () => void }) {
  const { tx } = useT()
  const [dlg, setDlg] = useState<'keys' | 'about' | null>(null)
  return (
    <>
      <Menu label={tx('help.menu')}>
        {(close) => (
          <>
            <button role="menuitem" onClick={() => { close(); onTour() }}>{tx('help.tour')}</button>
            <button role="menuitem" onClick={() => { close(); setDlg('keys') }}>{tx('help.shortcuts')}</button>
            <button role="menuitem" onClick={() => { close(); setDlg('about') }}>{tx('help.about')}</button>
          </>
        )}
      </Menu>
      {dlg && (
        <div className="modal" role="dialog" onClick={() => setDlg(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            {dlg === 'keys' ? (
              <>
                <h3>{tx('help.shortcuts')}</h3>
                <table className="kv"><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td style={{ textAlign: 'start' }}>{v}</td></tr>)}</tbody></table>
              </>
            ) : (
              <>
                <h3>Garden Studio</h3>
                <p>{tx('help.limits')}</p>
                <p className="hint">Three.js · React · Zustand · Immer · three-mesh-bvh · SunCalc · jsPDF · Vazirmatn (SIL OFL). Sun positions from SunCalc; terrain, trees and structures are generated procedurally. See CREDITS.md.</p>
              </>
            )}
            <div className="btn-row"><button className="btn" onClick={() => setDlg(null)}>✕</button></div>
          </div>
        </div>
      )}
    </>
  )
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const { t, tx, lang } = useT()
  const st = useStore()
  const [size, setSize] = useState<PngSize>('4k')
  const [clean, setClean] = useState(false)
  const [paper, setPaper] = useState<'a3' | 'a2' | 'a4'>('a3')
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const rec = useRef<RecordHandle | null>(null)
  const name = slug(st.project.name)
  const planName = activeScenario(st.project).name
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try { await fn() } catch (e) { console.error(e); useStore.getState().setUI({ toast: String((e as Error).message ?? e) }) } finally { setBusy(null); setProgress(0) }
  }
  const caption = () => `${st.project.name} — ${planName} — ${st.ui.time.day}/${st.ui.time.month}/${st.ui.time.year} ${String(Math.floor(st.ui.time.minutes / 60)).padStart(2, '0')}:${String(st.ui.time.minutes % 60).padStart(2, '0')} — ${t('time.age')} ${st.ui.time.ageYears}`
  return (
    <div className="modal" role="dialog" aria-label={tx('exp.title')}>
      <div className="modal-card" style={{ width: 460 }}>
        <h3>{tx('exp.title')}</h3>
        <fieldset className="rule-edit"><legend>{tx('exp.image')}</legend>
          <div className="field"><label htmlFor="ex-size">{tx('exp.size')}</label>
            <select id="ex-size" value={size} onChange={(e) => setSize(e.target.value as PngSize)}><option value="4k">3840 × 2160 (4K)</option><option value="2k">2560 × 1440</option><option value="1080p">1920 × 1080</option><option value="view">{tx('exp.size')}: view</option></select></div>
          <label className="chk"><input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} /> {tx('exp.clean')}</label>
          <div className="btn-row"><button className="btn primary" disabled={!!busy} onClick={() => run('png', async () => downloadBlob(`${name}-${size}.png`, await capturePNG(size, clean, caption())))}>{tx('exp.png')}</button></div>
        </fieldset>
        <fieldset className="rule-edit"><legend>{tx('exp.pdf')}</legend>
          <div className="field"><label htmlFor="ex-paper">{tx('exp.paper')}</label>
            <select id="ex-paper" value={paper} onChange={(e) => setPaper(e.target.value as 'a3')}><option value="a3">A3</option><option value="a2">A2</option><option value="a4">A4</option></select></div>
          <div className="btn-row"><button className="btn primary" disabled={!!busy} onClick={() => run('pdf', async () => downloadBlob(`${name}-plan.pdf`, await buildPlanPDF({ paper, lang, persianDigits: st.ui.persianDigits })))}>{tx('exp.pdfBtn')}</button></div>
        </fieldset>
        <fieldset className="rule-edit"><legend>3D / data</legend>
          <div className="btn-row">
            <button className="btn" disabled={!!busy} onClick={() => run('glb', async () => downloadBlob(`${name}.glb`, await exportGLB()))}>{tx('exp.glbBtn')}</button>
            <button className="btn" onClick={() => { const q = computeQuantities(Object.values(activeScenario(st.project).objects), st.project.site); downloadText(`${name}-quantities.csv`, quantitiesToCSV(q, (id) => CATALOG_BY_ID[id]?.name[lang] ?? id, [tx('q.item'), tx('q.category'), tx('q.count'), tx('q.area'), tx('q.length'), tx('q.litres')]), 'text/csv;charset=utf-8') }}>{tx('exp.csvBtn')}</button>
            <button className="btn" onClick={() => downloadBlob(`${name}.garden.json`, exportProjectJSON())}>{tx('exp.jsonBtn')}</button>
          </div>
        </fieldset>
        <fieldset className="rule-edit"><legend>{tx('exp.video')}</legend>
          <div className="btn-row">
            <button className="btn" disabled={!!busy} onClick={() => run('video', async () => { rec.current = recordTurntable(12, setProgress); downloadBlob(`${name}-turntable.webm`, await rec.current.promise) })}>{tx('exp.turntable')}</button>
            <button className="btn" disabled={!!busy} onClick={() => run('video', async () => { rec.current = recordFlythrough(24, setProgress); downloadBlob(`${name}-flythrough.webm`, await rec.current.promise) })}>{tx('exp.fly')}</button>
            {busy === 'video' && <button className="btn" onClick={() => rec.current?.cancel()}>{tx('exp.cancel')}</button>}
          </div>
          {busy === 'video' && <progress value={progress} max={1} style={{ width: '100%' }} />}
        </fieldset>
        {busy && busy !== 'video' && <p className="hint">{tx('exp.working')}</p>}
        <div className="btn-row"><button className="btn" onClick={onClose}>✕</button></div>
      </div>
    </div>
  )
}
void engine
