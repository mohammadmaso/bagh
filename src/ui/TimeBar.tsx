import { useStore } from '../store/store'
import { useT, formatDates } from '../i18n'
import { dayOfYear, SOLAR_PRESETS } from '../core/sun'
import type { Season } from '../core/sun'

function fromDoy(year: number, doy: number) {
  const d = new Date(Date.UTC(year, 0, doy))
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}
const pad = (n: number) => String(n).padStart(2, '0')

export function TimeBar() {
  const { t, n, lang } = useT()
  const time = useStore((s) => s.ui.time)
  const pd = useStore((s) => s.ui.persianDigits)
  const setTime = useStore((s) => s.setTime)
  const doy = dayOfYear(time.year, time.month, time.day)
  const dates = formatDates(time.year, time.month, time.day, lang, pd)
  const hh = Math.floor(time.minutes / 60), mm = time.minutes % 60
  const clock = `${pad(hh)}:${pad(mm)}`
  const presets: [string, { month: number; day: number }][] = [
    [t('time.springEq'), SOLAR_PRESETS.springEquinox], [t('time.summerSol'), SOLAR_PRESETS.summerSolstice],
    [t('time.autumnEq'), SOLAR_PRESETS.autumnEquinox], [t('time.winterSol'), SOLAR_PRESETS.winterSolstice],
  ]
  const seasons: ('auto' | Season)[] = ['auto', 'spring', 'summer', 'autumn', 'winter']
  return (
    <div className="timebar" role="group" aria-label="Time controls">
      <div className="row">
        <label htmlFor="tb-date">{t('time.date')}</label>
        <input id="tb-date" type="range" min={1} max={365} value={doy} onChange={(e) => setTime(fromDoy(time.year, +e.target.value))} />
        <span className="val" title={dates.jal}>{dates.greg}<br />{dates.jal}</span>
      </div>
      <div className="row">
        <label htmlFor="tb-time">{t('time.time')}</label>
        <input id="tb-time" type="range" min={0} max={1439} step={5} value={time.minutes} onChange={(e) => setTime({ minutes: +e.target.value })} />
        <span className="val">{lang === 'fa' && pd ? clock.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]) : clock}</span>
      </div>
      <div className="row">
        <label htmlFor="tb-age">{t('time.age')}</label>
        <input id="tb-age" type="range" min={0} max={15} step={0.5} value={time.ageYears} onChange={(e) => setTime({ ageYears: +e.target.value })} />
        <span className="val">{n(time.ageYears)} {t('time.years')}</span>
      </div>
      <div className="row extra">
        <span className="seg" role="group" aria-label={t('time.season')}>
          {seasons.map((s) => (
            <button key={s} className="btn" aria-pressed={time.seasonMode === s} onClick={() => setTime({ seasonMode: s })}>{t(`season.${s}` as const)}</button>
          ))}
        </span>
        <button className="btn" aria-pressed={time.snow} onClick={() => setTime({ snow: !time.snow })}>{t('time.snow')}</button>
        {presets.map(([label, p]) => <button key={label} className="btn" onClick={() => setTime({ month: p.month, day: p.day })}>{label}</button>)}
      </div>
    </div>
  )
}
