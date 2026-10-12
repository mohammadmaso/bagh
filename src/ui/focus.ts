import * as THREE from 'three'
import { useStore } from '../store/store'
import { engine } from '../render/engine'
import { select } from '../store/actions'

/** Select objects and fly the camera to them (perspective view) — used by rule warnings and reports. */
export function focusObjects(ids: string[], at?: { x: number; z: number }) {
  const s = useStore.getState()
  const objs = s.project.scenarios[s.project.activeScenarioId].objects
  const list = ids.map((i) => objs[i]).filter(Boolean)
  if (list.length) select(ids.filter((i) => objs[i]))
  const pts = list.map((o) => (o.points ? o.points[Math.floor(o.points.length / 2)] : o))
  const cx = pts.length ? pts.reduce((a, p) => a + p.x, 0) / pts.length : at?.x ?? 16
  const cz = pts.length ? pts.reduce((a, p) => a + p.z, 0) / pts.length : at?.z ?? 15
  if (s.ui.view !== 'persp' && s.ui.view !== 'plan') return
  const y = engine.terrain.heightAt(cx, cz)
  const target = new THREE.Vector3(cx, y + 1, cz)
  if (s.ui.view === 'plan') { engine.flyTo(new THREE.Vector3(cx, 600, cz), new THREE.Vector3(cx, 0, cz), 500); return }
  const spread = pts.length > 1 ? Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.z - cz))) : 0
  const dist = Math.max(10, spread * 2.2 + 8)
  const off = new THREE.Vector3(-0.35, 0.55, 0.8).normalize().multiplyScalar(dist)
  engine.flyTo(target.clone().add(off), target, 700)
}
export const focusObject = (id: string) => focusObjects([id])
