/** Formatting helpers shared by the donor tracker page and CountryAidProfile. */

/** Validated categorical palette, fixed order. */
export const AID_COLORS = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', amber: '#eda100', red: '#e34948' } as const

export function aidUsd(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '–'
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : digits)}bn`
  if (a >= 1e6) return `${sign}$${Math.round(a / 1e6)}m`
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}k`
  return `${sign}$${Math.round(a)}`
}

export function aidPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${v.toFixed(digits)}%`
}

/** Signed change label with an arrow, e.g. "▼ 17.4%". Never relies on colour alone. */
export function aidChange(pct: number | null | undefined): { arrow: string; text: string; word: string; cls: string; dir: 'down' | 'up' | 'flat' | 'none' } {
  if (pct == null || !Number.isFinite(pct)) return { arrow: '', text: '–', word: '', cls: 'text-primary-400', dir: 'none' }
  if (Math.abs(pct) < 0.5) return { arrow: '■', text: `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`, word: 'flat', cls: 'text-primary-500', dir: 'flat' }
  return pct < 0
    ? { arrow: '▼', text: `−${Math.abs(pct).toFixed(1)}%`, word: 'cut', cls: 'text-red-700', dir: 'down' }
    : { arrow: '▲', text: `+${pct.toFixed(1)}%`, word: 'increase', cls: 'text-emerald-700', dir: 'up' }
}

export const AID_TOPIC_LABELS: Record<string, string> = {
  'cuts': 'Cuts',
  'pledge': 'Pledges & deals',
  'humanitarian': 'Humanitarian',
  'climate-finance': 'Climate finance',
  'health': 'Health',
  'budget': 'Budgets & ODA',
  'multilateral': 'Multilateral',
}

export function aidDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
