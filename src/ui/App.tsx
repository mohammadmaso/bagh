import { useEffect } from 'react'
import { useStore } from '../store/store'
import { useT } from '../i18n'
import { Viewport } from './Viewport'
import { SitePanel } from './SitePanel'
import { TimeBar } from './TimeBar'

export function App() {
  const { t, dir, lang } = useT()
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)

  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = lang
    document.documentElement.dataset.theme = ui.theme
  }, [dir, lang, ui.theme])

  return (
    <div className="app">
      <header className="topbar">
        <h1>🌿 {t('appName')}</h1>
        <button className="btn" onClick={undo} disabled={!canUndo} aria-label={t('btn.undo')}>↶</button>
        <button className="btn" onClick={redo} disabled={!canRedo} aria-label={t('btn.redo')}>↷</button>
        <div className="spacer" />
        <span className="seg" role="group" aria-label={t('ui.quality')}>
          {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
            <button key={q} className="btn" aria-pressed={ui.quality === q} onClick={() => setUI({ quality: q, qualityAuto: false })}>{t(`quality.${q}` as const)}</button>
          ))}
        </span>
        <button className="btn" onClick={() => setUI({ lang: lang === 'en' ? 'fa' : 'en' })} aria-label={t('ui.language')}>{lang === 'en' ? 'فارسی' : 'EN'}</button>
        <button className="btn" onClick={() => setUI({ theme: ui.theme === 'light' ? 'dark' : 'light' })} aria-label={t('ui.theme')}>{ui.theme === 'light' ? '☾' : '☀'}</button>
      </header>
      <div className="main">
        <aside className="side" aria-label={t('panel.site')}>
          <div className="tabs" role="tablist">
            <button className="tab" role="tab" aria-selected>{t('panel.site')}</button>
          </div>
          <div className="panel-body"><SitePanel /></div>
        </aside>
        <div className="stage"><Viewport /></div>
      </div>
      <TimeBar />
    </div>
  )
}
