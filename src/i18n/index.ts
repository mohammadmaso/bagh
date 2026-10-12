import { en, type Key } from './en'
import { fa } from './fa'
import { dynEn, dynFa } from './dyn'
import { useStore } from '../store/store'

export type { Key }
const dict = { en, fa } as const

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
export function toPersianDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => FA_DIGITS[+d]).replace(/\./g, '٫')
}

export function translate(lang: 'en' | 'fa', key: Key, vars?: Record<string, string | number>): string {
  let s: string = dict[lang][key] ?? en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

export function translateDyn(lang: 'en' | 'fa', key: string, vars?: Record<string, string | number>): string {
  let s = (lang === 'fa' ? dynFa[key] : undefined) ?? dynEn[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}

export function useT() {
  const lang = useStore((s) => s.ui.lang)
  const pd = useStore((s) => s.ui.persianDigits)
  const t = (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars)
  /** dynamic (string) keys: rules, parameters, analysis, quantities */
  const tx = (key: string, vars?: Record<string, string | number>) => translateDyn(lang, key, vars)
  /** locale-aware number formatting */
  const n = (v: number, digits = 1) => {
    const s = (Math.round(v * 10 ** digits) / 10 ** digits).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
    return lang === 'fa' && pd ? toPersianDigits(s) : s
  }
  return { t, tx, n, lang, dir: lang === 'fa' ? ('rtl' as const) : ('ltr' as const) }
}

/** Format a date in Gregorian and Solar Hijri (Jalali) using Intl; no data files needed. */
export function formatDates(year: number, month: number, day: number, lang: 'en' | 'fa', persianDigits: boolean) {
  const d = new Date(Date.UTC(year, month - 1, day, 12))
  const greg = new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-gregory' : 'en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', numberingSystem: persianDigits || lang === 'fa' ? 'arabext' : 'latn' } as any).format(d)
  const jal = new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US-u-ca-persian', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: persianDigits || lang === 'fa' ? 'arabext' : 'latn' } as any).format(d)
  return { greg, jal }
}
