import { readDataFile } from './data-file'
import { getRegistry } from './wcg'

/**
 * UN budget, reform and the Fifth Committee, from fifth-committee.json (scripts/fetch_fifth_committee.py)
 * and statement texts in fifth-statements.json.
 */
const file = () => readDataFile<any>('fifth-committee.json')
const texts = () => readDataFile<Record<string, string | null>>('fifth-statements.json') || {}

function country(iso3: string | null) {
  if (!iso3) return null
  const m: any = getRegistry().getCountryMembership(iso3)
  return { iso3, name: m?.name || iso3, iso2: m?.iso2 || null }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Who pays: scale of assessments joined with the honour roll and Article 19. */
export function payers() {
  const f = file()
  if (!f?.scale) return null
  const paid = new Map<string, any>((f.honourRoll?.paid || []).filter((p: any) => p.iso3).map((p: any) => [p.iso3, p]))
  const art19 = new Set((f.article19?.countries || []).map((c: any) => c.iso3))
  const onTimeCount: number | null = f.honourRoll?.onTimeCount ?? null
  const rows = f.scale.countries.map((c: any) => {
    const p = paid.get(c.iso3)
    return {
      ...country(c.iso3), country: c.country, pct: c.pct, prevPct: c.prevPct, change: c.prevPct != null ? Math.round((c.pct - c.prevPct) * 1000) / 1000 : null,
      paid: !!p, paidDate: p?.date || null, paidUsd: p?.usd || null, onTime: p ? onTimeCount != null && p.n <= onTimeCount : false,
      article19: art19.has(c.iso3),
    }
  })
  const unpaid = rows.filter((r: any) => !r.paid)
  const hist = f.honourRoll?.history || { years: [], months: {} }
  // paid-in-full counts by month: this year, last year, and the average of the five years before
  const series = MONTHS.map((m, i) => {
    const v: (number | null)[] = hist.months?.[m] || []
    const prior = v.slice(1, 6).filter((x): x is number => x != null)
    return { month: m.slice(0, 3), idx: i, thisYear: v[0] ?? null, lastYear: v[1] ?? null, avg5: prior.length ? Math.round(prior.reduce((a, b) => a + b, 0) / prior.length) : null }
  })
  return {
    asOf: f.honourRoll?.asOf || null, paidCount: f.honourRoll?.paidCount ?? null, members: rows.length,
    onTimeCount, dueDate: f.honourRoll?.dueDate || null,
    years: hist.years?.slice(0, 2) || [],
    unpaidCount: unpaid.length, unpaidShare: Math.round(unpaid.reduce((a: number, r: any) => a + r.pct, 0) * 100) / 100,
    unpaidLargest: unpaid.slice(0, 10),
    rows, series,
    scale: { period: f.scale.period, prevPeriod: f.scale.prevPeriod, url: f.scale.url },
    honourUrl: f.honourRoll?.url, article19: f.article19,
  }
}

const GROUP_ALIASES: [RegExp, string][] = [
  [/group of 77|g-?77/i, 'G77 and China'], [/european union/i, 'European Union'], [/african group/i, 'African Group'],
  [/caricom|caribbean community/i, 'CARICOM'], [/asean|south-?east asian/i, 'ASEAN'], [/canz|canada, australia and new zealand/i, 'CANZ'],
  [/gcc|gulf/i, 'GCC'], [/least developed/i, 'LDCs'], [/small island/i, 'SIDS'], [/landlocked/i, 'LLDCs'], [/arab group/i, 'Arab Group'],
  [/non-aligned/i, 'NAM'], [/like-minded/i, 'Like-minded'], [/central american|sica/i, 'SICA'], [/rio group|celac/i, 'CELAC'],
]
export function speakerGroup(s: any): string | null {
  if (s.official) return 'Officials'
  if (/European Union/i.test(s.speaker)) return 'European Union'
  for (const [re, label] of GROUP_ALIASES) if (s.onBehalfOf && re.test(s.onBehalfOf)) return label
  return null
}

/** The Fifth Committee session: agenda items with statements and decisions. */
export function session() {
  const f = file()
  if (!f) return null
  const items = new Map<string, any>()
  const keyOf = (s: any) => (s.items?.length ? s.items.join(', ') : 'general')
  for (const s of f.statements || []) {
    const k = keyOf(s)
    const e = items.get(k) || { key: k, items: s.items || [], topic: s.topic, dates: new Set<string>(), statements: [] as any[] }
    if (s.date) e.dates.add(s.date)
    e.statements.push({ speaker: s.speaker, onBehalfOf: s.onBehalfOf, group: speakerGroup(s), official: s.official, country: country(s.iso3), url: s.url, date: s.date, hasText: !!s.textKey, lang: s.lang })
    items.set(k, e)
  }
  const agendaTitle = new Map((f.agenda || []).map((a: any) => [a.item, a.title]))
  const discussed = [...items.values()].map(e => ({
    ...e, dates: [...e.dates].sort(), titles: e.items.map((i: string) => ({ item: i, title: agendaTitle.get(i) || null })),
  })).sort((a, b) => (b.dates[b.dates.length - 1] || '').localeCompare(a.dates[a.dates.length - 1] || ''))
  const spoken = new Set((f.statements || []).flatMap((s: any) => s.items || []))
  return {
    n: f.session?.n, mainSession: f.session?.mainSession, updatedAt: f._meta?.updated_at, status: f._meta?.status, sources: f._meta?.sources,
    discussed, agenda: (f.agenda || []).map((a: any) => ({ ...a, discussed: spoken.has(a.item) })),
    decisions: f.resdec || [], statementsCount: (f.statements || []).length,
    groupsSpeaking: [...new Set((f.statements || []).map((s: any) => speakerGroup(s)).filter((g: any) => g && g !== 'Officials'))],
  }
}

export function budgetNews(o: { topic?: string | null; q?: string | null; official?: boolean; limit?: number } = {}) {
  const f = file()
  let list: any[] = f?.news || []
  if (o.topic) list = list.filter(n => n.topics.includes(o.topic))
  if (o.official) list = list.filter(n => n.official)
  if (o.q) { const q = o.q.toLowerCase(); list = list.filter(n => n.title.toLowerCase().includes(q)) }
  return { total: list.length, items: list.slice(0, o.limit ?? 60).map(n => ({ ...n, countriesC: (n.countries || []).map(country) })) }
}

export function un80() { return file()?.un80 || null }

/** Search statement texts: passages around the words, optionally one speaker/group/country/item. */
export function searchStatements(o: { query?: string | null; country?: string | null; group?: string | null; item?: string | null; limit?: number }) {
  const f = file()
  if (!f) return []
  const t = texts()
  const words = (o.query || '').toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const out: any[] = []
  for (const s of f.statements || []) {
    if (o.country && s.iso3 !== o.country) continue
    if (o.item && !(s.items || []).includes(o.item)) continue
    const g = speakerGroup(s)
    if (o.group && !(g && g.toLowerCase().includes(o.group.toLowerCase())) && !(s.onBehalfOf || '').toLowerCase().includes(o.group.toLowerCase())) continue
    const text = s.textKey ? t[s.textKey] || '' : ''
    let passages: string[] = []
    if (words.length && text) {
      const paras = text.split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(p => p.length > 60)
      passages = paras.map(p => ({ p, n: words.filter(w => p.toLowerCase().includes(w)).length })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3).map(x => x.p.slice(0, 700))
      if (!passages.length) continue
    } else if (text) {
      passages = [text.replace(/\s+/g, ' ').slice(0, 900)]
    }
    out.push({ speaker: s.speaker, onBehalfOf: s.onBehalfOf, group: g, date: s.date, items: s.items, topic: s.topic, url: s.url, passages })
  }
  return out.slice(0, o.limit ?? 8)
}

/** One country's position: share of the budget, payment, arrears, statements, news. */
export function countryBudget(iso3: string) {
  const p = payers()
  const r = p?.rows.find((x: any) => x.iso3 === iso3) || null
  const f = file()
  const statements = (f?.statements || []).filter((s: any) => s.iso3 === iso3).map((s: any) => ({ speaker: s.speaker, onBehalfOf: s.onBehalfOf, date: s.date, items: s.items, topic: s.topic, url: s.url }))
  const rank = r ? p!.rows.findIndex((x: any) => x.iso3 === iso3) + 1 : null
  return r ? { ...r, rank, of: p!.rows.length, asOf: p!.asOf, period: p!.scale.period, prevPeriod: p!.scale.prevPeriod, statements } : (statements.length ? { statements } : null)
}
