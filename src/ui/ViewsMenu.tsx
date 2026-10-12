import { useState } from 'react'
import * as THREE from 'three'
import { useStore } from '../store/store'
import { useT } from '../i18n'
import { engine } from '../render/engine'
import { uid } from '../core/project'

/** Camera bookmarks: save/restore named views with a smooth transition. */
export function ViewsMenu() {
  const { tx } = useT()
  const marks = useStore((s) => s.project.bookmarks)
  const commit = useStore((s) => s.commit)
  const setUI = useStore((s) => s.setUI)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const save = () => {
    const c = engine.getCameraState()
    commit((d) => { d.bookmarks.push({ id: uid('bm'), name: name || `View ${d.bookmarks.length + 1}`, pos: c.pos, target: c.target, view: c.view, zoom: c.zoom }) })
    setName('')
  }
  const go = (id: string) => {
    const b = marks.find((m) => m.id === id)
    if (!b) return
    const apply = () => engine.flyTo(new THREE.Vector3(...(b.pos as [number, number, number])), new THREE.Vector3(...(b.target as [number, number, number])), 900, b.zoom)
    if (useStore.getState().ui.view !== b.view) { setUI({ view: b.view as any }); setTimeout(apply, 60) } else apply()
    setOpen(false)
  }
  return (
    <span className="menu-wrap">
      <button className="btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>📷 {tx('bm.views')}</button>
      {open && (
        <div className="menu" role="menu">
          {marks.length === 0 && <div className="hint" style={{ padding: '4px 8px' }}>{tx('bm.none')}</div>}
          {marks.map((m) => (
            <div key={m.id} className="menu-row">
              <button role="menuitem" onClick={() => go(m.id)}>{m.name}</button>
              <button aria-label={tx('bm.delete')} title={tx('bm.delete')} onClick={() => commit((d) => { d.bookmarks = d.bookmarks.filter((x) => x.id !== m.id) })}>✕</button>
            </div>
          ))}
          <div className="menu-row save">
            <input placeholder={tx('bm.name')} aria-label={tx('bm.name')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
            <button onClick={save}>＋</button>
          </div>
        </div>
      )}
    </span>
  )
}
