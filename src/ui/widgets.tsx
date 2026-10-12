import { useEffect, useState } from 'react'
import { useT } from '../i18n'

/** Number input that commits on blur/Enter, so typing intermediate values never breaks the model. */
export function NumField(p: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; digits?: number; id?: string; badge?: boolean
}) {
  const { n } = useT()
  const [text, setText] = useState(String(p.value))
  useEffect(() => setText(String(Math.round(p.value * 1000) / 1000)), [p.value])
  const commit = () => {
    let v = parseFloat(text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace('٫', '.'))
    if (!Number.isFinite(v)) { setText(String(p.value)); return }
    if (p.min != null) v = Math.max(p.min, v)
    if (p.max != null) v = Math.min(p.max, v)
    p.onChange(v)
  }
  void n
  const id = p.id ?? 'f-' + p.label
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}{p.badge && <span className="badge">?</span>}</label>
      <input id={id} inputMode="decimal" value={text} step={p.step}
        onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
    </div>
  )
}

export function SelectField<T extends string>(p: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = 's-' + p.label
  return (
    <div className="field">
      <label htmlFor={id}>{p.label}</label>
      <select id={id} value={p.value} onChange={(e) => p.onChange(e.target.value as T)}>
        {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
