import { readDataFile } from './data-file'
import { getCountryData } from './countrydata'

/**
 * Donor tracker: official development assistance (ODA) by donor and recipient
 * (scripts/fetch_donor_tracker.py -> donor-tracker.json, OECD DAC) and donor news
 * (scripts/fetch_donor_news.py -> donor-news.json). Both files are re-read when they change.
 */

export const TRACKER_FILE = 'donor-tracker.json'
export const NEWS_FILE = 'donor-news.json'

export interface DonorYear {
  year: number
  oda: number | null
  oda_real: number | null
  gni_pct: number | null
  bilateral?: number
  multilateral?: number
  refugee?: number
  humanitarian?: number
  oda_net?: number
  preliminary?: boolean
}

export interface DonorLatest {
  year: number
  preliminary: boolean
  oda: number | null
  oda_real: number | null
  gni_pct: number | null
  prev_year: number | null
  change_1y_pct: number | null
  change_1y_usd: number | null
  base3_year: number | null
  change_3y_pct: number | null
  change_3y_usd: number | null
  gni_pct_prev: number | null
  refugee_share?: number
  refugee_usd?: number
  bilateral_share?: number
  multilateral_share?: number
  humanitarian_share?: number
  humanitarian_usd?: number
  humanitarian_year?: number
  rank_volume?: number
  rank_gni?: number
}

export interface PartnerAmount { iso3: string; name: string; usd: number; prev?: number | null }

export interface DonorEntry {
  code: string
  name: string
  kind: 'country' | 'eu'
  dac_member: boolean
  latest: DonorLatest
  series: DonorYear[]
  top_recipients: { year: number; total_allocated: number; items: PartnerAmount[] }
  top_recipients_5y: { years: string; items: PartnerAmount[] }
  sectors?: { year: number; basis: string; total: number; items: { code: string; name: string; usd: number; share: number }[] }
}

export interface RecipientDonor { code: string; iso3: string | null; name: string; kind: 'country' | 'eu' | 'multilateral' | 'private'; usd: number; prev?: number | null }

export interface RecipientEntry {
  name: string
  year: number
  total: number | null
  rank?: number
  series: { year: number; usd: number }[]
  top_donors: RecipientDonor[]
  top_donors_5y: RecipientDonor[]
}

export interface ChangeRow {
  code: string
  name: string
  year: number
  from_year: number
  preliminary: boolean
  change_usd: number
  change_pct: number
  oda: number | null
  gni_pct: number | null
  gni_pct_prev: number | null
}

interface TrackerFile {
  _meta: Record<string, any>
  dac_total: DonorYear[]
  rankings: { by_volume: string[]; by_gni: string[] }
  cuts: ChangeRow[]
  increases: ChangeRow[]
  cuts_3y: ChangeRow[]
  increases_3y: ChangeRow[]
  donors: Record<string, DonorEntry>
  recipients: Record<string, RecipientEntry>
}

export interface DonorNewsItem {
  id: string
  title: string
  url: string
  source: string
  sourceId: string
  via: string
  donor: string
  publishedAt: string
  excerpt: string
  topics: string[]
}

interface NewsFile {
  _meta: { updated_at: string; window_days: number; donor_names: Record<string, string>; topics: Record<string, number>; sources: any[]; note?: string }
  items: DonorNewsItem[]
}

function tracker(): TrackerFile | null { return readDataFile<TrackerFile>(TRACKER_FILE) }
function news(): NewsFile | null { return readDataFile<NewsFile>(NEWS_FILE) }

/** Flag code and display name for a donor code (ISO3, 'EU' or 'OECD'). */
export function donorLabel(code: string): { code: string; iso2: string | null; name: string } {
  if (code === 'EU') return { code, iso2: 'EU', name: 'EU Institutions' }
  if (code === 'OECD') return { code, iso2: null, name: 'OECD' }
  const cd = /^[A-Z]{3}$/.test(code) ? getCountryData(code) : null
  const t = tracker()
  return { code, iso2: cd?.iso2 || null, name: cd?.name || t?.donors?.[code]?.name || news()?._meta?.donor_names?.[code] || code }
}

function withIso2<T extends { iso3?: string | null; code?: string }>(x: T): T & { iso2: string | null } {
  return { ...x, iso2: x.code === 'EU' ? 'EU' : x.iso3 ? (getCountryData(x.iso3)?.iso2 || null) : null }
}

export function getDonorMeta() {
  const t = tracker()
  const n = news()
  return {
    has_data: !!t,
    tracker: t?._meta ?? null,
    news: n ? { updated_at: n._meta.updated_at, window_days: n._meta.window_days, count: n.items.length, topics: n._meta.topics, note: n._meta.note,
      sources: (n._meta.sources || []).map((s: any) => ({ id: s.id, name: s.name, donor: s.donor, kind: s.kind, status: s.status, count: s.count })) } : null,
  }
}

/** League table rows: every reporting donor with headline numbers and a compact trend. */
export function getDonors() {
  const t = tracker()
  if (!t) return { meta: null, donors: [], dac_total: [], rankings: { by_volume: [], by_gni: [] } }
  const donors = Object.values(t.donors).map(d => ({
    ...donorLabel(d.code),
    kind: d.kind,
    dac_member: d.dac_member,
    latest: d.latest,
    trend: d.series.map(s => ({ year: s.year, oda: s.oda, oda_real: s.oda_real, gni_pct: s.gni_pct, preliminary: !!s.preliminary })),
  }))
  donors.sort((a, b) => (b.latest.oda || 0) - (a.latest.oda || 0))
  return { meta: t._meta, donors, dac_total: t.dac_total, rankings: t.rankings }
}

export function getRecipientDonors(iso3: string) {
  const t = tracker()
  const code = iso3.toUpperCase()
  const r = t?.recipients?.[code]
  if (!r) return null
  return {
    ...r,
    iso3: code,
    top_donors: r.top_donors.map(withIso2),
    top_donors_5y: r.top_donors_5y.map(withIso2),
  }
}

export function getDonorNews(opts: { donor?: string | null; topic?: string | null; q?: string | null; limit?: number; days?: number } = {}) {
  const n = news()
  if (!n) return { meta: null, items: [] as (DonorNewsItem & { donor_name: string; iso2: string | null })[], total: 0 }
  const donor = opts.donor ? opts.donor.toUpperCase() : null
  const topic = opts.topic || null
  const q = (opts.q || '').trim().toLowerCase()
  const since = opts.days ? new Date(Date.now() - opts.days * 86400_000).toISOString() : ''
  const limit = Math.max(1, Math.min(opts.limit ?? 40, 300))
  const matches = n.items.filter(it =>
    (!donor || it.donor === donor)
    && (!topic || it.topics.includes(topic))
    && (!since || it.publishedAt >= since)
    && (!q || it.title.toLowerCase().includes(q) || (it.excerpt || '').toLowerCase().includes(q)))
  const labels = new Map<string, ReturnType<typeof donorLabel>>()
  const items = matches.slice(0, limit).map(it => {
    if (!labels.has(it.donor)) labels.set(it.donor, donorLabel(it.donor))
    const l = labels.get(it.donor)!
    return { ...it, donor_name: l.name, iso2: l.iso2 }
  })
  return {
    meta: { updated_at: n._meta.updated_at, window_days: n._meta.window_days, topics: n._meta.topics, note: n._meta.note },
    donors: Object.keys(n._meta.donor_names || {}).map(c => donorLabel(c)).sort((a, b) => a.name.localeCompare(b.name)),
    items,
    total: matches.length,
  }
}

/** Full donor profile (null when the code is neither a reporting donor nor in the news). */
export function getDonorProfile(iso3: string) {
  const t = tracker()
  const code = iso3.toUpperCase() === 'EUU' ? 'EU' : iso3.toUpperCase()
  const d = t?.donors?.[code]
  const recipient = getRecipientDonors(code)
  const latestNews = getDonorNews({ donor: code, limit: 8 }).items
  if (!d && !recipient && !latestNews.length) return null
  const label = donorLabel(code)
  return {
    ...label,
    is_donor: !!d,
    is_recipient: !!recipient,
    donor: d ? {
      kind: d.kind,
      dac_member: d.dac_member,
      latest: d.latest,
      series: d.series,
      top_recipients: { ...d.top_recipients, items: d.top_recipients.items.map(withIso2) },
      top_recipients_5y: { ...d.top_recipients_5y, items: d.top_recipients_5y.items.map(withIso2) },
      sectors: d.sectors ?? null,
      donor_count: t?.rankings?.by_volume?.length ?? null,
    } : null,
    recipient,
    news: latestNews,
    meta: t ? {
      updated_at: t._meta.updated_at,
      latest_year: t._meta.latest_year,
      final_year: t._meta.final_year,
      preliminary_years: t._meta.preliminary_years,
      constant_price_year: t._meta.constant_price_year,
      source: t._meta.source,
    } : null,
  }
}

/** Cuts tracker: biggest cuts and increases in constant prices, latest year vs previous and vs 3 years earlier. */
export function getAidCuts() {
  const t = tracker()
  if (!t) return { meta: null, cuts: [], increases: [], cuts_3y: [], increases_3y: [], dac_total: [] }
  const lab = (r: ChangeRow) => ({ ...r, ...donorLabel(r.code) })
  return {
    meta: { latest_year: t._meta.latest_year, preliminary_years: t._meta.preliminary_years, constant_price_year: t._meta.constant_price_year, updated_at: t._meta.updated_at },
    cuts: t.cuts.map(lab),
    increases: t.increases.map(lab),
    cuts_3y: t.cuts_3y.map(lab),
    increases_3y: t.increases_3y.map(lab),
    dac_total: t.dac_total,
  }
}
