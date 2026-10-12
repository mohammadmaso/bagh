import { useEffect, useState } from 'react'
import { useStore } from '../store/store'
import { useT } from '../i18n'

const STEPS: { sel: string; key: string }[] = [
  { sel: '.stage', key: 'tour.1' }, { sel: '[data-tour="library"]', key: 'tour.2' }, { sel: '.timebar', key: 'tour.3' },
  { sel: '[data-tour="tabs"]', key: 'tour.4' }, { sel: '.toolbar', key: 'tour.5' }, { sel: '[data-tour="file"]', key: 'tour.6' },
]

/** Short guided tour; shown on first run and from the Help menu. */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tx } = useT()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const setUI = useStore((s) => s.setUI)
  useEffect(() => {
    if (!open) return
    const el = document.querySelector(STEPS[i].sel)
    setRect(el ? el.getBoundingClientRect() : null)
    const on = () => setRect(document.querySelector(STEPS[i].sel)?.getBoundingClientRect() ?? null)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [open, i])
  if (!open) return null
  const done = () => { setUI({ tourDone: true }); setI(0); onClose() }
  const last = i === STEPS.length - 1
  const pos = rect ? { top: Math.min(window.innerHeight - 190, Math.max(8, rect.bottom + 10)), left: Math.min(window.innerWidth - 340, Math.max(8, rect.left)) } : { top: 80, left: 80 }
  return (
    <div className="tour" role="dialog" aria-label={tx('tour.title')}>
      {rect && <div className="tour-ring" style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }} />}
      <div className="tour-card" style={pos}>
        <b>{tx('tour.title')} {i + 1}/{STEPS.length}</b>
        <p>{tx(STEPS[i].key)}</p>
        <div className="btn-row">
          <button className="btn" onClick={done}>{tx('tour.skip')}</button>
          {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>{tx('tour.back')}</button>}
          <button className="btn primary" onClick={() => (last ? done() : setI(i + 1))}>{last ? tx('tour.done') : tx('tour.next')}</button>
        </div>
      </div>
    </div>
  )
}
