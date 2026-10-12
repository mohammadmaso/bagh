import * as THREE from 'three'
import { engine } from '../render/engine'
import { useStore } from '../store/store'

export type PngSize = '1080p' | '2k' | '4k' | 'view'
const SIZES: Record<PngSize, [number, number] | null> = { '1080p': [1920, 1080], '2k': [2560, 1440], '4k': [3840, 2160], view: null }

/** Render the scene at an arbitrary resolution (off-screen, same canvas) and return a PNG blob. `clean` = no caption. */
export async function capturePNG(size: PngSize, clean: boolean, caption?: string): Promise<Blob> {
  const e = engine
  const r = e.renderer
  const canvas = r.domElement
  const prev = { w: canvas.clientWidth, h: canvas.clientHeight, pr: r.getPixelRatio() }
  const [w, h] = SIZES[size] ?? [Math.round(prev.w * prev.pr), Math.round(prev.h * prev.pr)]
  const helperVis: boolean[] = []
  e.scene.traverse((o) => { if ((o as any).isTransformControls || o.type === 'TransformControlsRoot') { helperVis.push(o.visible); o.visible = false } })
  e.setCaptureMode(true)
  e.renderToSize(w, h)
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
  e.renderOnce()
  const src = canvas
  let out: HTMLCanvasElement = src
  if (!clean) {
    out = document.createElement('canvas')
    out.width = w; out.height = h
    const ctx = out.getContext('2d')!
    ctx.drawImage(src, 0, 0)
    const fs = Math.round(h / 54)
    ctx.font = `600 ${fs}px sans-serif`
    const text = caption ?? ''
    const pad = fs * 0.7
    const tw = ctx.measureText(text).width
    ctx.fillStyle = 'rgba(15,25,18,0.62)'
    ctx.fillRect(pad, h - fs * 2.4, tw + pad * 2, fs * 1.8)
    ctx.fillStyle = '#fff'
    ctx.fillText(text, pad * 2, h - fs * 1.05)
  }
  const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'))
  e.setCaptureMode(false)
  e.restoreSize()
  let i = 0
  e.scene.traverse((o) => { if ((o as any).isTransformControls || o.type === 'TransformControlsRoot') o.visible = helperVis[i++] ?? true })
  void THREE
  void useStore
  return blob
}
