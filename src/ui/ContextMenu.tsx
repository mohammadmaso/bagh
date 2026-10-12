import { useStore, updateObjects } from '../store/store'
import { useT } from '../i18n'
import { copySelection, pasteClipboard, duplicateSelection, deleteSelection, toggleLock, toggleHide, groupSelection, ungroupSelection, selectAll, showAll } from '../store/actions'
import { engine } from '../render/engine'
import * as THREE from 'three'

export function focusSelection() {
  const s = useStore.getState()
  const objs = s.project.scenarios[s.project.activeScenarioId].objects
  const ids = s.ui.selection.filter((i) => objs[i])
  if (!ids.length) return
  let cx = 0, cz = 0
  for (const i of ids) { const o = objs[i]; const p = o.points ? o.points[0] : o; cx += p.x; cz += p.z }
  cx /= ids.length; cz /= ids.length
  const y = engine.terrain.heightAt(cx, cz)
  const tgt = new THREE.Vector3(cx, y + 1, cz)
  const off = engine.activeCamera.position.clone().sub(engine.controls.target)
  off.setLength(Math.min(Math.max(off.length(), 8), 18))
  if (s.ui.view === 'persp') engine.flyTo(tgt.clone().add(off), tgt, 600)
}

export function ContextMenu() {
  const { t } = useT()
  const cm = useStore((s) => s.ui.contextMenu)
  const sel = useStore((s) => s.ui.selection)
  const setUI = useStore((s) => s.setUI)
  if (!cm) return null
  const run = (fn: () => void) => () => { fn(); setUI({ contextMenu: null }) }
  const has = sel.length > 0
  return (
    <div className="ctx" style={{ left: cm.x, top: cm.y }} role="menu" onPointerDown={(e) => e.stopPropagation()}>
      {has && <button role="menuitem" onClick={run(focusSelection)}>{t('ctx.focus')}</button>}
      {has && <button role="menuitem" onClick={run(() => copySelection())}>{t('ctx.copy')}</button>}
      <button role="menuitem" onClick={run(() => { const h = engine.lastPick(); pasteClipboard(h ?? undefined) })}>{t('ctx.paste')}</button>
      {has && <button role="menuitem" onClick={run(duplicateSelection)}>{t('ctx.duplicate')}</button>}
      {sel.length > 1 && <button role="menuitem" onClick={run(groupSelection)}>{t('ctx.group')}</button>}
      {has && <button role="menuitem" onClick={run(ungroupSelection)}>{t('ctx.ungroup')}</button>}
      {has && <button role="menuitem" onClick={run(() => toggleLock())}>{t('ctx.lock')}</button>}
      {has && <button role="menuitem" onClick={run(() => toggleHide())}>{t('ctx.hide')}</button>}
      {has && <button role="menuitem" onClick={run(() => setUI({ arrayDialog: true }))}>{t('ctx.array')}</button>}
      <button role="menuitem" onClick={run(selectAll)}>{t('ctx.selectAll')}</button>
      <button role="menuitem" onClick={run(showAll)}>{t('ctx.showAll')}</button>
      {has && <button role="menuitem" className="danger" onClick={run(deleteSelection)}>{t('ctx.delete')}</button>}
    </div>
  )
}
void updateObjects
