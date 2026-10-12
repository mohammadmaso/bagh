import { useEffect, useState, type ReactNode } from 'react'
import { useStore } from '../store/store'
import { useT, type Key } from '../i18n'
import { Viewport } from './Viewport'
import { SitePanel } from './SitePanel'
import { LibraryPanel } from './LibraryPanel'
import { PropertiesPanel } from './PropertiesPanel'
import { TimeBar } from './TimeBar'
import { Toolbar } from './Toolbar'
import { useShortcuts } from './shortcuts'
import { AnalysisPanel } from './AnalysisPanel'
import { RulesPanel } from './RulesPanel'
import { QuantitiesPanel } from './QuantitiesPanel'
import { TerrainPanel } from './TerrainPanel'
import { ImagesPanel, ImageViewer } from './ImagesPanel'
import { PlansPanel } from './PlansPanel'
import { FileMenu, HelpMenu, SaveIndicator } from './FileMenu'
import { Tour } from './Tour'
import { ComparePane } from './Viewport'
import { useAnalysis } from '../store/analysis'

type PanelId = 'library' | 'site' | 'analysis' | 'rules' | 'quantities' | 'terrain' | 'images' | 'plans'
const LEFT_TABS: { id: PanelId; label: Key; render: () => ReactNode }[] = [
  { id: 'library', label: 'panel.library', render: () => <LibraryPanel /> },
  { id: 'analysis', label: 'panel.analysis', render: () => <AnalysisPanel /> },
  { id: 'rules', label: 'panel.rules', render: () => <RulesPanel /> },
  { id: 'quantities', label: 'panel.quantities', render: () => <QuantitiesPanel /> },
  { id: 'terrain', label: 'panel.terrain', render: () => <TerrainPanel /> },
  { id: 'images', label: 'panel.images', render: () => <ImagesPanel /> },
  { id: 'plans', label: 'panel.scenarios', render: () => <PlansPanel /> },
  { id: 'site', label: 'panel.site', render: () => <SitePanel /> },
]

export function App() {
  const { t, dir, lang } = useT()
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const [tab, setTab] = useState<PanelId>('library')
  const [showRight, setShowRight] = useState(true)
  const [tour, setTour] = useState(false)
  useEffect(() => { if (!ui.tourDone) { const id = setTimeout(() => setTour(true), 1200); return () => clearTimeout(id) } }, [ui.tourDone])
  const issueCount = useAnalysis((s) => s.violations.filter((v) => v.severity !== 'info').length)
  useShortcuts()

  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = lang
    document.documentElement.dataset.theme = ui.theme
  }, [dir, lang, ui.theme])

  const current = LEFT_TABS.find((x) => x.id === tab)!
  return (
    <div className="app">
      <header className="topbar">
        <h1>🌿 {t('appName')}</h1>
        <FileMenu />
        <HelpMenu onTour={() => setTour(true)} />
        <button className="btn" onClick={undo} disabled={!canUndo} aria-label={t('btn.undo')} title="Ctrl+Z">↶</button>
        <button className="btn" onClick={redo} disabled={!canRedo} aria-label={t('btn.redo')} title="Ctrl+Shift+Z">↷</button>
        <SaveIndicator />
        <div className="spacer" />
        <span className="seg" role="group" aria-label={t('ui.quality')}>
          {(['low', 'medium', 'high', 'ultra'] as const).map((q) => (
            <button key={q} className="btn" aria-pressed={ui.quality === q} onClick={() => setUI({ quality: q, qualityAuto: false })}>{t(`quality.${q}` as const)}</button>
          ))}
        </span>
        <button className="btn" onClick={() => setUI({ lang: lang === 'en' ? 'fa' : 'en' })} aria-label={t('ui.language')}>{lang === 'en' ? 'فارسی' : 'EN'}</button>
        <button className="btn" onClick={() => setUI({ theme: ui.theme === 'light' ? 'dark' : 'light' })} aria-label={t('ui.theme')}>{ui.theme === 'light' ? '☾' : '☀'}</button>
        <button className="btn" onClick={() => setShowRight(!showRight)} aria-pressed={showRight} aria-label={t('panel.properties')}>⚙</button>
      </header>
      <div className="main">
        <aside className="side" aria-label="Panels">
          <div className="tabs" role="tablist" data-tour="tabs">
            {LEFT_TABS.map((x) => (
              <button key={x.id} className="tab" role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}>{t(x.label)}{x.id === 'rules' && issueCount > 0 && <span className="tab-count">{issueCount}</span>}</button>
            ))}
          </div>
          <div className="panel-body" role="tabpanel" data-tour={tab === 'library' ? 'library' : undefined}>{current.render()}</div>
        </aside>
        <div className="center">
          <Toolbar />
          {ui.compareWith && useStore.getState().project.scenarios[ui.compareWith] ? (
            <div className="compare">
              <div className="pane"><div className="pane-h">{useStore.getState().project.scenarios[useStore.getState().project.activeScenarioId].name}</div><Viewport /></div>
              <div className="pane"><div className="pane-h">{useStore.getState().project.scenarios[ui.compareWith].name}</div><div className="stage"><ComparePane scenarioId={ui.compareWith} /></div></div>
            </div>
          ) : <Viewport />}
        </div>
        <aside className={'side right' + (showRight ? '' : ' hidden')} aria-label={t('panel.properties')}>
          <div className="tabs"><span className="tab" aria-selected>{t('panel.properties')}</span></div>
          <div className="panel-body"><PropertiesPanel /></div>
        </aside>
      </div>
      <TimeBar />
      <ImageViewer />
      <Tour open={tour} onClose={() => setTour(false)} />
    </div>
  )
}
