import { useRef, useState } from 'react'
import { useStore } from '../store/store'
import { useT } from '../i18n'
import { uid, type ReferenceImage } from '../core/project'
import { NumField } from './widgets'
import { focusObjects } from './focus'

export interface LoadedImage { dataUrl: string; w: number; h: number }

/** Read a local image file, downscale to `maxSize` and return a JPEG/PNG data URL. Nothing leaves the browser. */
export async function loadImageFile(file: File, maxSize: number): Promise<LoadedImage> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Cannot read image')); i.src = url })
    const k = Math.min(1, maxSize / Math.max(img.width, img.height))
    const w = Math.round(img.width * k), h = Math.round(img.height * k)
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const png = file.type === 'image/png' && w * h < 1.2e6
    return { dataUrl: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88), w, h }
  } finally { URL.revokeObjectURL(url) }
}

function registerSize(id: string, w: number, h: number) {
  const g = ((window as any).__imageSizes ??= {})
  g[id] = { w, h }
}

export function ImagesPanel() {
  const { tx } = useT()
  const images = useStore((s) => s.project.images)
  const commit = useStore((s) => s.commit)
  const setUI = useStore((s) => s.setUI)
  const cal = useStore((s) => s.ui.calibrate)
  const site = useStore((s) => s.project.site)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'overlay' | 'pin' | 'sky'>('overlay')
  const [busy, setBusy] = useState(false)

  const pick = (m: 'overlay' | 'pin' | 'sky') => { setMode(m); fileRef.current?.click() }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const max = mode === 'overlay' ? 4096 : mode === 'sky' ? 4096 : 1600
      const l = await loadImageFile(f, max)
      const id = uid('img')
      registerSize(id, l.w, l.h)
      const im: ReferenceImage = { id, kind: mode, name: f.name, dataUrl: l.dataUrl, opacity: 0.7, cx: site.width / 2, cz: site.depth / 2, widthM: Math.max(site.width, site.depth) * 1.2, rotY: 0, visible: mode !== 'pin' }
      commit((d) => { d.images.push(im) })
      if (mode === 'pin') setUI({ pendingPin: id, toast: tx('img.placePin') })
      if (mode === 'overlay') setUI({ calibrate: { imageId: id, step: 'pick-image' } })
    } catch (e) { setUI({ toast: String((e as Error).message) }) } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const set = (id: string, fn: (i: ReferenceImage) => void, key?: string) => commit((d) => { const i = d.images.find((x) => x.id === id); if (i) fn(i) }, key ? `img:${id}:${key}` : undefined)

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <p className="hint">{tx('img.local')}</p>
      <div className="btn-row">
        <button className="btn primary" disabled={busy} onClick={() => pick('overlay')}>{tx('img.addOverlay')}</button>
        <button className="btn" disabled={busy} onClick={() => pick('pin')}>{tx('img.addPin')}</button>
        <button className="btn" disabled={busy} onClick={() => pick('sky')}>{tx('img.addSky')}</button>
      </div>
      {images.length === 0 && <p className="hint">{tx('img.none')}</p>}
      {images.map((im) => (
        <fieldset key={im.id} className="rule-edit">
          <legend>{im.kind === 'overlay' ? '🗺️' : im.kind === 'pin' ? '📍' : '🌐'} {im.name.slice(0, 22)}</legend>
          <label className="chk"><input type="checkbox" checked={im.visible} onChange={(e) => set(im.id, (i) => { i.visible = e.target.checked })} /> {tx('img.visible')}</label>
          {im.kind === 'overlay' && (
            <>
              <div className="field"><label htmlFor={'op' + im.id}>{tx('img.opacity')}</label><input id={'op' + im.id} type="range" min={0.05} max={1} step={0.05} value={im.opacity} onChange={(e) => set(im.id, (i) => { i.opacity = +e.target.value }, 'op')} /></div>
              <NumField id={'cx' + im.id} label="X (m)" value={im.cx} onChange={(v) => set(im.id, (i) => { i.cx = v }, 'cx')} />
              <NumField id={'cz' + im.id} label="Z (m)" value={im.cz} onChange={(v) => set(im.id, (i) => { i.cz = v }, 'cz')} />
              <NumField id={'wm' + im.id} label={tx('img.width')} value={im.widthM} min={1} onChange={(v) => set(im.id, (i) => { i.widthM = v }, 'w')} />
              <NumField id={'rt' + im.id} label={tx('img.rotation')} value={Math.round((im.rotY * 180) / Math.PI * 10) / 10} onChange={(v) => set(im.id, (i) => { i.rotY = (v * Math.PI) / 180 }, 'r')} />
              <div className="btn-row"><button className="btn" onClick={() => { setUI({ calibrate: { imageId: im.id, step: 'pick-image' } }) }}>{tx('img.calibrate')}</button></div>
            </>
          )}
          {im.kind === 'pin' && (
            <div className="btn-row">
              <button className="btn" onClick={() => setUI({ viewer: im.id })}>{tx('img.view')}</button>
              <button className="btn" onClick={() => setUI({ pendingPin: im.id, toast: tx('img.placePin') })}>{tx('img.move')}</button>
              <button className="btn" onClick={() => focusObjects([], { x: im.cx, z: im.cz })}>{tx('ctx.focus')}</button>
            </div>
          )}
          <div className="btn-row"><button className="btn" onClick={() => commit((d) => { d.images = d.images.filter((x) => x.id !== im.id) })}>{tx('img.remove')}</button></div>
        </fieldset>
      ))}
      {cal && <CalibrateDialog />}
    </div>
  )
}

/** Step 1 of calibration: click two recognisable points on the image. Step 2 (in the 3D view) is handled by the interaction layer. */
export function CalibrateDialog() {
  const { tx } = useT()
  const cal = useStore((s) => s.ui.calibrate)!
  const img = useStore((s) => s.project.images.find((i) => i.id === cal.imageId))
  const setUI = useStore((s) => s.setUI)
  const [pts, setPts] = useState<{ u: number; v: number }[]>([])
  const ref = useRef<HTMLImageElement>(null)
  if (!img || cal.step !== 'pick-image') return null
  const click = (e: React.MouseEvent) => {
    const el = ref.current!
    const r = el.getBoundingClientRect()
    const size = (window as any).__imageSizes?.[img.id] as { w: number; h: number } | undefined
    const w = size?.w ?? el.naturalWidth, h = size?.h ?? el.naturalHeight
    const u = ((e.clientX - r.left) / r.width) * w, v = ((e.clientY - r.top) / r.height) * h
    if (!size) registerSize(img.id, el.naturalWidth, el.naturalHeight)
    setPts((p) => (p.length >= 2 ? [{ u, v }] : [...p, { u, v }]))
  }
  const next = () => { setUI({ calibrate: { ...cal, a: pts[0], b: pts[1], step: 'world-a' }, toast: tx('img.clickA') }) }
  return (
    <div className="modal" role="dialog" aria-label={tx('img.calibrate')}>
      <div className="modal-card">
        <h3>{tx('img.calibrate')}</h3>
        <p className="hint">{tx('img.calibHelp')}</p>
        <div className="calib-img" style={{ position: 'relative' }}>
          <img ref={ref} src={img.dataUrl} alt="" onClick={click} style={{ maxWidth: '100%', maxHeight: '55vh', cursor: 'crosshair', display: 'block' }} onLoad={(e) => registerSize(img.id, (e.target as HTMLImageElement).naturalWidth, (e.target as HTMLImageElement).naturalHeight)} />
          {pts.map((p, i) => {
            const el = ref.current
            const size = (window as any).__imageSizes?.[img.id]
            if (!el || !size) return null
            return <span key={i} className="calib-dot" style={{ left: `${(p.u / size.w) * 100}%`, top: `${(p.v / size.h) * 100}%` }}>{i === 0 ? 'A' : 'B'}</span>
          })}
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={pts.length < 2} onClick={next}>{tx('img.next')}</button>
          <button className="btn" onClick={() => setUI({ calibrate: null })}>{tx('btn.cancel' as any)}</button>
        </div>
      </div>
    </div>
  )
}

export function ImageViewer() {
  const id = useStore((s) => s.ui.viewer)
  const img = useStore((s) => s.project.images.find((i) => i.id === id))
  const setUI = useStore((s) => s.setUI)
  if (!id || !img) return null
  return (
    <div className="modal" role="dialog" onClick={() => setUI({ viewer: null })}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3>{img.name}</h3>
        <img src={img.dataUrl} alt={img.name} style={{ maxWidth: '88vw', maxHeight: '70vh' }} />
        <div className="btn-row"><button className="btn" onClick={() => setUI({ viewer: null })}>✕</button></div>
      </div>
    </div>
  )
}
