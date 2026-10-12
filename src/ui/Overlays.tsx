import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useStore, activeScenario } from '../store/store'
import { useT } from '../i18n'
import { engine } from '../render/engine'
import { CATALOG_BY_ID } from '../data/catalog'
import { localDims } from '../core/footprint'
import { polylineLength } from '../core/geometry2d'

/** Compass (north arrow) that follows the camera heading, plus a metric scale bar. */
export function CompassAndScale() {
  const { t, n } = useT()
  const [yaw, setYaw] = useState(0)
  const [scale, setScale] = useState({ px: 80, m: 5 })
  const view = useStore((s) => s.ui.view)
  useEffect(() => {
    let raf = 0
    const v = new THREE.Vector3()
    const tick = () => {
      const cam = engine.activeCamera
      if (cam) {
        cam.getWorldDirection(v)
        // heading of camera: 0 when looking north (-z)
        let a = Math.atan2(v.x, -v.z)
        if (view === 'plan') a = 0
        setYaw((p) => (Math.abs(p - a) > 0.002 ? a : p))
        const canvas = engine.renderer?.domElement
        if (canvas) {
          const h = canvas.clientHeight
          let mPerPx: number
          if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
            const o = cam as THREE.OrthographicCamera
            mPerPx = (o.top - o.bottom) / o.zoom / h
          } else {
            const p = cam as THREE.PerspectiveCamera
            const dist = cam.position.distanceTo(engine.controls.target)
            mPerPx = (2 * Math.tan((p.fov * Math.PI) / 360) * dist) / h
          }
          const nice = [0.5, 1, 2, 5, 10, 20, 50, 100, 200]
          let m = nice[0]
          for (const c of nice) if (c / mPerPx <= 150) m = c
          const px = m / mPerPx
          setScale((p) => (Math.abs(p.px - px) > 0.5 || p.m !== m ? { px, m } : p))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [view])
  return (
    <>
      <svg className="compass" viewBox="-32 -32 64 64" role="img" aria-label={t('north.arrow')}>
        <circle r="29" fill="rgba(255,255,255,0.78)" stroke="rgba(0,0,0,0.35)" />
        <g transform={`rotate(${(-yaw * 180) / Math.PI})`}>
          <path d="M0,-24 L7,6 L0,1 L-7,6 Z" fill="#c0392b" />
          <path d="M0,24 L7,-6 L0,-1 L-7,-6 Z" fill="#555" opacity="0.7" />
          <text y="-9" x="0" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" transform="translate(0,-8)">{t('compass.north')}</text>
        </g>
      </svg>
      <div className="scalebar" aria-label="scale bar">
        <div>{n(scale.m, 1)} {t('scale.m')}</div>
        <div className="bar" style={{ width: scale.px }} />
      </div>
    </>
  )
}

/** HTML labels floating over objects. */
export function Labels() {
  const show = useStore((s) => s.ui.showLabels)
  const objs = useStore((s) => activeScenario(s.project).objects)
  const sel = useStore((s) => s.ui.selection)
  const lang = useStore((s) => s.ui.lang)
  const view = useStore((s) => s.ui.view)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const v = new THREE.Vector3()
    const tick = () => {
      const root = ref.current
      const cv = engine.renderer?.domElement
      if (root && cv) {
        const w = cv.clientWidth, h = cv.clientHeight
        for (const el of Array.from(root.children) as HTMLElement[]) {
          const id = el.dataset.id!
          const o = objs[id]
          if (!o) continue
          const item = CATALOG_BY_ID[o.type]
          const p = o.points ? o.points[Math.floor(o.points.length / 2)] : o
          const top = item.kind === 'polyline' ? 0.6 : Math.min(item.height, 4) + 0.4
          v.set(p.x, engine.terrain.heightAt(p.x, p.z) + top, p.z).project(engine.activeCamera)
          const vis = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
          el.style.display = vis ? 'block' : 'none'
          el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [objs, show])
  if (!show || view === 'walk') return null
  const entries = Object.values(objs).filter((o) => !o.hidden && (o.label || sel.includes(o.id) || view === 'plan'))
  return (
    <div ref={ref} className="labels" aria-hidden>
      {entries.map((o) => (
        <div key={o.id} data-id={o.id} className={'label' + (sel.includes(o.id) ? ' sel' : '')}>{o.label || CATALOG_BY_ID[o.type]?.name[lang]}{(sel.includes(o.id) || view === 'plan') && dimText(o)}</div>
      ))}
    </div>
  )
}

function dimText(o: { type: string; points?: { x: number; z: number }[]; params: Record<string, number | string | boolean>; scale: number }) {
  const it = CATALOG_BY_ID[o.type]
  if (!it) return null
  if (it.kind === 'polyline' && o.points) return <small> · {polylineLength(o.points).toFixed(1)} m</small>
  if (it.plant) return null
  const d = localDims(it, o.params)
  const f = (v: number) => (Math.round(v * o.scale * 10) / 10).toString()
  return <small> · {it.fp.shape === 'circle' ? `⌀${f(Math.max(d.w, d.d))}` : `${f(d.w)}×${f(d.d)}`} m</small>
}

export function Hud() {
  const hud = useStore((s) => s.ui.hud)
  const toast = useStore((s) => s.ui.toast)
  const setUI = useStore((s) => s.setUI)
  useEffect(() => { if (toast) { const id = setTimeout(() => setUI({ toast: null }), 3500); return () => clearTimeout(id) } }, [toast, setUI])
  return (
    <>
      {hud && <div className="hud" style={{ left: hud.x, top: hud.y }}>{hud.text}</div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}
