import { useState } from 'react'
import { useStore, activeScenario } from '../store/store'
import { useAnalysis } from '../store/analysis'
import { useT, toPersianDigits } from '../i18n'
import { CATALOG_BY_ID } from '../data/catalog'
import { RULES, type Severity } from '../data/rules'
import { effectiveRule, type Violation } from '../core/rules'
import { NumField, SelectField } from './widgets'
import { focusObjects } from './focus'

const ICON: Record<Severity, string> = { error: '⛔', warning: '⚠️', info: 'ℹ️' }

export function useViolationText() {
  const { tx, lang } = useT()
  const pd = useStore((s) => s.ui.persianDigits)
  const objs = useStore((s) => activeScenario(s.project).objects)
  return (v: Violation) => {
    const names: Record<string, string> = {}
    for (const [k, id] of Object.entries(v.refs)) { const o = objs[id]; names[k] = o ? (o.label || CATALOG_BY_ID[o.type]?.name[lang] || o.type) : id }
    const vars: Record<string, string | number> = { ...v.vars, ...names }
    if (typeof vars.what === 'string') vars.what = tx('rule.what.' + vars.what)
    const key = v.ruleId === 'pathLimits' ? (v.vars.kind === 'width' ? 'rule.pathLimits.msgWidth' : 'rule.pathLimits.msgSlope') : `rule.${v.ruleId}.msg`
    const msg = tx(key, vars)
    return lang === 'fa' && pd ? toPersianDigits(msg) : msg
  }
}

export function RulesPanel() {
  const { t, tx } = useT()
  const violations = useAnalysis((s) => s.violations)
  const growing = useAnalysis((s) => s.growing)
  const cfg = useStore((s) => s.project.ruleConfig)
  const commit = useStore((s) => s.commit)
  const showRules = useStore((s) => s.ui.showRules)
  const setUI = useStore((s) => s.setUI)
  const [edit, setEdit] = useState(false)
  const text = useViolationText()
  const groups: Severity[] = ['error', 'warning', 'info']
  const sevOptions = groups.map((g) => ({ value: g, label: tx('rules.' + g) }))

  return (
    <div>
      <div className="btn-row">
        <button className="btn" aria-pressed={showRules} onClick={() => setUI({ showRules: !showRules })}>{ICON.warning} 3D</button>
        <button className="btn" aria-pressed={edit} onClick={() => setEdit(!edit)}>{tx('rules.edit')}</button>
      </div>
      {!growing.grid && <p className="hint">{tx('rules.needSun')}</p>}
      <p className="hint">{tx('rules.matureNote')}</p>
      {!edit && (violations.length === 0 ? <p className="hint ok">✓ {tx('rules.none')}</p> : groups.map((g) => {
        const list = violations.filter((v) => v.severity === g)
        if (!list.length) return null
        return (
          <section key={g} className={'sev sev-' + g}>
            <h3>{ICON[g]} {tx('rules.' + g)} ({list.length})</h3>
            <ul className="viol-list">
              {list.map((v) => (
                <li key={v.id}>
                  <button className="viol" onClick={() => focusObjects(v.objectIds, v.at)}>
                    <b>{tx(`rule.${v.ruleId}.title`)}</b>
                    <span>{text(v)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      }))}
      {edit && RULES.map((def) => {
        const eff = effectiveRule(def, cfg)
        const set = (fn: (o: { enabled?: boolean; severity?: Severity; params?: Record<string, number> }) => void) =>
          commit((d) => { d.ruleConfig[def.id] ??= {}; fn(d.ruleConfig[def.id]) })
        return (
          <fieldset key={def.id} className="rule-edit">
            <legend>{tx(`rule.${def.id}.title`)}</legend>
            <label className="chk"><input type="checkbox" checked={eff.enabled} onChange={(e) => set((o) => { o.enabled = e.target.checked })} /> {tx('rules.enabled')}</label>
            {def.id !== 'pathLimits' && <SelectField label={tx('rules.severity')} value={eff.severity} options={sevOptions} onChange={(v) => set((o) => { o.severity = v })} />}
            {Object.keys(def.params).map((p) => (
              <NumField key={p} id={`rp-${def.id}-${p}`} label={tx('param.' + p)} value={eff.params[p]} onChange={(v) => set((o) => { o.params = { ...(o.params ?? {}), [p]: v } })} />
            ))}
          </fieldset>
        )
      })}
      {edit && <div className="btn-row"><button className="btn" onClick={() => commit((d) => { d.ruleConfig = {} })}>{tx('rules.reset')}</button></div>}
      <span hidden>{t('btn.close')}</span>
    </div>
  )
}
