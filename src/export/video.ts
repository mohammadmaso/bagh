import * as THREE from 'three'
import { engine } from '../render/engine'
import { useStore } from '../store/store'

function pickMime(): string {
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  return ''
}

export interface RecordHandle { promise: Promise<Blob>; cancel: () => void }

/** Record the live canvas while `drive(progress 0..1)` moves the camera. */
function record(seconds: number, drive: (p: number) => void, onProgress?: (p: number) => void): RecordHandle {
  const canvas = engine.renderer.domElement
  const stream = (canvas as HTMLCanvasElement).captureStream(30)
  const mime = pickMime()
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  let cancelled = false
  const start = performance.now()
  let finished: (b: Blob) => void
  const promise = new Promise<Blob>((res) => { finished = res })
  rec.onstop = () => { engine.onFrame = engine.onFrame.filter((f) => f !== step); finished(new Blob(chunks, { type: mime || 'video/webm' })) }
  const step = () => {
    const p = Math.min(1, (performance.now() - start) / (seconds * 1000))
    drive(p)
    onProgress?.(p)
    if (p >= 1 || cancelled) { if (rec.state !== 'inactive') rec.stop() }
  }
  engine.onFrame.push(step)
  rec.start(250)
  return { promise, cancel: () => { cancelled = true } }
}

/** 360° turntable around the plot centre at a fixed height/distance. */
export function recordTurntable(seconds = 12, onProgress?: (p: number) => void): RecordHandle {
  if (useStore.getState().ui.view !== 'persp') useStore.getState().setUI({ view: 'persp' })
  const site = useStore.getState().project.site
  const c = new THREE.Vector3(site.width / 2, engine.terrain.heightAt(site.width / 2, site.depth / 2) + 1.5, site.depth / 2)
  const R = Math.max(site.width, site.depth) * 1.15, H = 11
  const startAngle = Math.atan2(engine.camera.position.x - c.x, engine.camera.position.z - c.z)
  engine.controls.enabled = false
  const h = record(seconds, (p) => {
    const a = startAngle + p * Math.PI * 2
    engine.camera.position.set(c.x + Math.sin(a) * R, c.y + H, c.z + Math.cos(a) * R)
    engine.controls.target.copy(c)
    engine.camera.lookAt(c)
  }, onProgress)
  h.promise.finally(() => { engine.controls.enabled = true })
  return h
}

/** Eye-level walk-through: in through the pedestrian door, across the garden, past the cabin and back up the slope. */
export function recordFlythrough(seconds = 24, onProgress?: (p: number) => void): RecordHandle {
  if (useStore.getState().ui.view !== 'persp') useStore.getState().setUI({ view: 'persp' })
  const site = useStore.getState().project.site
  const door = site.gates.find((g) => g.kind === 'pedestrian') ?? site.gates[0]
  const zD = door ? door.offset + door.width / 2 : site.depth * 0.7
  const way = [
    [-3, zD], [2, zD], [8, zD - 4], [14, site.depth * 0.5], [22, site.depth * 0.45], [26, site.depth * 0.3], [20, site.depth * 0.18], [10, site.depth * 0.2], [5, site.depth * 0.45],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z))
  const curve = new THREE.CatmullRomCurve3(way, false, 'catmullrom', 0.5)
  engine.controls.enabled = false
  const eye = 1.7
  const h = record(seconds, (p) => {
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    const pt = curve.getPointAt(Math.min(0.999, e)), ahead = curve.getPointAt(Math.min(0.999, e + 0.03))
    engine.camera.position.set(pt.x, engine.terrain.heightAt(pt.x, pt.z) + eye, pt.z)
    engine.camera.lookAt(ahead.x, engine.terrain.heightAt(ahead.x, ahead.z) + eye - 0.15, ahead.z)
    engine.controls.target.set(ahead.x, engine.terrain.heightAt(ahead.x, ahead.z) + eye, ahead.z)
  }, onProgress)
  h.promise.finally(() => { engine.controls.enabled = true })
  return h
}
