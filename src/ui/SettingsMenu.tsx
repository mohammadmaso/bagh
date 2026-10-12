import { useStore } from '../store/store'
import { useT } from '../i18n'
import { Menu } from './FileMenu'

/** Language, digits, theme, quality, walk speed. */
export function SettingsMenu() {
  const { t, tx, lang } = useT()
  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  return (
    <Menu label={'⚙ ' + tx('set.menu')}>
      {() => (
        <div className="settings" onPointerDown={(e) => e.stopPropagation()}>
          <div className="field"><label htmlFor="s-lang">{t('ui.language')}</label>
            <select id="s-lang" value={lang} onChange={(e) => setUI({ lang: e.target.value as 'en' | 'fa' })}><option value="en">English</option><option value="fa">فارسی</option></select></div>
          <label className="chk"><input type="checkbox" checked={ui.persianDigits} onChange={(e) => setUI({ persianDigits: e.target.checked })} /> {t('ui.digits')}</label>
          <div className="field"><label htmlFor="s-theme">{t('ui.theme')}</label>
            <select id="s-theme" value={ui.theme} onChange={(e) => setUI({ theme: e.target.value as 'light' | 'dark' })}><option value="light">{tx('set.light')}</option><option value="dark">{tx('set.dark')}</option></select></div>
          <div className="field"><label htmlFor="s-q">{t('ui.quality')}</label>
            <select id="s-q" value={ui.qualityAuto ? 'auto' : ui.quality} onChange={(e) => (e.target.value === 'auto' ? setUI({ qualityAuto: true }) : setUI({ quality: e.target.value as 'low', qualityAuto: false }))}>
              <option value="auto">{t('quality.auto')}</option><option value="low">{t('quality.low')}</option><option value="medium">{t('quality.medium')}</option><option value="high">{t('quality.high')}</option><option value="ultra">{t('quality.ultra')}</option></select></div>
          <div className="field"><label htmlFor="s-walk">{tx('set.walk')}</label>
            <input id="s-walk" type="number" min={0.5} max={6} step={0.1} value={ui.walkSpeed} onChange={(e) => setUI({ walkSpeed: Math.max(0.5, Math.min(6, +e.target.value || 1.6)) })} /></div>
        </div>
      )}
    </Menu>
  )
}
