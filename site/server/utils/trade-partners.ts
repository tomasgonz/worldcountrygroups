import { readDataFile } from './data-file'

/**
 * Emerging trading partners tracker — goods trade of every country with the big
 * emerging economies (and the traditional partners for comparison), built by
 * scripts/fetch_trade_partners.py from the IMF International Merchandise Trade
 * Statistics (IMTS). Values are USD millions; shares are % of the reporter's total
 * goods trade (exports + imports) with the world.
 */

export const TRADE_FILE = 'trade-partners.json'

export type PartnerGroup = 'emerging' | 'traditional'

export interface TradeFlow { x: number | null; m: number | null }

export interface PartnerInfo { code: string; iso3: string | null; name: string; group: PartnerGroup }

export interface RawPartnerStats {
  years: Record<string, TradeFlow>
  total: number | null
  share: number | null
  share_5y: number | null
  share_10y: number | null
  change_5y: number | null
  change_10y: number | null
  x_share: number | null
  m_share: number | null
  growth_5y: number | null
  yoy: number | null
}

export interface GroupShare {
  share: number | null
  share_5y: number | null
  share_10y: number | null
  change_5y: number | null
  change_10y: number | null
  x_share: number | null
  m_share: number | null
  series: { year: number; share: number; total: number }[]
}

export interface MonthlyTrade {
  emerging_share: (number | null)[]
  china_share: (number | null)[]
  world_total: (number | null)[]
  ttm: {
    emerging_share: number | null
    prev_emerging_share: number | null
    china_share: number | null
    prev_china_share: number | null
    last_month: string | null
  }
}

export interface RawCountryTrade {
  name: string
  iso2: string | null
  in_world_list: boolean
  latest_year: number
  world: { years: Record<string, TradeFlow>; total: number | null }
  partners: Record<string, RawPartnerStats>
  emerging: GroupShare
  traditional: GroupShare
  top_emerging: string | null
  top_partner: string | null
  top_partner_share: number | null
  china_export_share: number | null
  china_import_share: number | null
  hhi_tracked: number | null
  eu_member: boolean
  monthly: MonthlyTrade | null
}

export interface ShiftRow {
  iso3: string
  name: string
  iso2: string | null
  share: number | null
  share_5y: number | null
  change_5y: number
  change_10y: number | null
  traditional_change_5y: number | null
  biggest_gainer: string | null
  biggest_gainer_change: number | null
  total_trade: number | null
}

export interface TradeMeta {
  source: string
  source_url: string
  api: string
  indicators: Record<string, string>
  unit: string
  last_updated: string
  latest_year: number
  first_year: number
  base_5y: number
  base_10y: number
  latest_month: string | null
  months: string[]
  emerging_codes: string[]
  traditional_codes: string[]
  reporters: number
  missing_from_imf: string[]
  min_trade_for_shifts_musd: number
  notes: string[]
}

interface TradeFile {
  _meta: TradeMeta
  partners: PartnerInfo[]
  countries: Record<string, RawCountryTrade>
  partner_totals: Record<string, { years: Record<string, number>; top_partner_for: string[]; top_emerging_for: string[] }>
  shifts: { toward_emerging: ShiftRow[]; away_from_emerging: ShiftRow[] }
  comtrade?: { m49: Record<string, number>; hs2: Record<string, string> }
}

/** One partner as seen from one country, ready for display. */
export interface CountryPartnerRow {
  code: string
  iso3: string | null
  iso2: string | null
  name: string
  group: PartnerGroup
  exports: number | null
  imports: number | null
  total: number | null
  share: number | null
  share_5y: number | null
  share_10y: number | null
  change_5y: number | null
  change_10y: number | null
  export_share: number | null
  import_share: number | null
  growth_5y: number | null
  yoy: number | null
  /** share of total trade per year (for sparklines) */
  series: { year: number; share: number | null }[]
}

export interface CountryTrade {
  iso3: string
  name: string
  iso2: string | null
  latest_year: number
  world: { exports: number | null; imports: number | null; total: number | null }
  emerging: GroupShare
  traditional: GroupShare
  partners: CountryPartnerRow[]
  top_emerging: string | null
  top_partner: string | null
  top_partner_share: number | null
  china_export_share: number | null
  china_import_share: number | null
  hhi_tracked: number | null
  eu_member: boolean
  monthly: (MonthlyTrade & { months: string[] }) | null
}

export interface PartnerViewRow {
  iso3: string
  name: string
  iso2: string | null
  latest_year: number
  total: number | null
  share: number | null
  share_5y: number | null
  share_10y: number | null
  change_5y: number | null
  change_10y: number | null
  export_share: number | null
  import_share: number | null
  rank_among_tracked: number | null
  total_trade: number | null
}

export interface PartnerView {
  partner: PartnerInfo & { iso2: string | null }
  latest_year: number
  totals: { year: number; total: number }[]
  top_partner_for: string[]
  top_emerging_for: string[]
  rows: PartnerViewRow[]
}

function load(): TradeFile | null {
  const d = readDataFile<TradeFile>(TRADE_FILE)
  return d && d.countries ? d : null
}

function iso2Of(d: TradeFile, iso3: string | null, code: string): string | null {
  if (code === 'EU') return 'EU'
  if (!iso3) return null
  return d.countries[iso3]?.iso2 ?? null
}

export function getTradePartnerList(): (PartnerInfo & { iso2: string | null })[] {
  const d = load()
  if (!d) return []
  return d.partners.map(p => ({ ...p, iso2: iso2Of(d, p.iso3, p.code) }))
}

export function getTradeMeta(): (TradeMeta & { partners: (PartnerInfo & { iso2: string | null })[] }) | null {
  const d = load()
  if (!d) return null
  return { ...d._meta, partners: getTradePartnerList() }
}

export function getCountryTradePartners(iso3: string): CountryTrade | null {
  const d = load()
  const key = String(iso3 || '').toUpperCase()
  const c = d?.countries[key]
  if (!d || !c) return null
  const L = String(c.latest_year)
  const w = c.world.years[L]
  const years = Object.keys(c.world.years).map(Number).sort((a, b) => a - b)
  const partners: CountryPartnerRow[] = d.partners
    .filter(p => c.partners[p.code])
    .map((p) => {
      const s = c.partners[p.code]
      const f = s.years[L]
      return {
        code: p.code, iso3: p.iso3, iso2: iso2Of(d, p.iso3, p.code), name: p.name, group: p.group,
        exports: f?.x ?? null, imports: f?.m ?? null, total: s.total,
        share: s.share, share_5y: s.share_5y, share_10y: s.share_10y,
        change_5y: s.change_5y, change_10y: s.change_10y,
        export_share: s.x_share, import_share: s.m_share, growth_5y: s.growth_5y, yoy: s.yoy,
        series: years.map((y) => {
          const pf = s.years[String(y)]
          const wf = c.world.years[String(y)]
          const pt = pf ? (pf.x ?? 0) + (pf.m ?? 0) : null
          const wt = wf ? (wf.x ?? 0) + (wf.m ?? 0) : null
          return { year: y, share: pt != null && wt ? Math.round((pt / wt) * 1000) / 10 : null }
        }),
      }
    })
    .sort((a, b) => (a.group === b.group ? (b.share ?? -1) - (a.share ?? -1) : a.group === 'emerging' ? -1 : 1))
  return {
    iso3: key, name: c.name, iso2: c.iso2, latest_year: c.latest_year,
    world: { exports: w?.x ?? null, imports: w?.m ?? null, total: c.world.total },
    emerging: c.emerging, traditional: c.traditional, partners,
    top_emerging: c.top_emerging, top_partner: c.top_partner, top_partner_share: c.top_partner_share,
    china_export_share: c.china_export_share, china_import_share: c.china_import_share,
    hhi_tracked: c.hhi_tracked, eu_member: c.eu_member,
    monthly: c.monthly ? { ...c.monthly, months: d._meta.months } : null,
  }
}

/** Who trades most with one partner (share of their trade), and how that changed. */
export function getPartnerView(partner: string, opts: { minTrade?: number } = {}): PartnerView | null {
  const d = load()
  if (!d) return null
  const q = String(partner || '').toUpperCase()
  const p = d.partners.find(x => x.code === q || x.iso3 === q)
  if (!p) return null
  const minTrade = opts.minTrade ?? 0
  const rows: PartnerViewRow[] = []
  for (const [iso3, c] of Object.entries(d.countries)) {
    const s = c.partners[p.code]
    if (!s || s.share == null) continue
    if ((c.world.total ?? 0) < minTrade) continue
    const ranked = Object.entries(c.partners)
      .filter(([code, v]) => code !== 'EU' && v.share != null)
      .sort((a, b) => (b[1].share ?? 0) - (a[1].share ?? 0))
      .map(([code]) => code)
    const rank = ranked.indexOf(p.code)
    rows.push({
      iso3, name: c.name, iso2: c.iso2, latest_year: c.latest_year, total: s.total,
      share: s.share, share_5y: s.share_5y, share_10y: s.share_10y, change_5y: s.change_5y, change_10y: s.change_10y,
      export_share: s.x_share, import_share: s.m_share,
      rank_among_tracked: rank >= 0 ? rank + 1 : null, total_trade: c.world.total,
    })
  }
  rows.sort((a, b) => (b.share ?? 0) - (a.share ?? 0))
  const t = d.partner_totals[p.code]
  return {
    partner: { ...p, iso2: iso2Of(d, p.iso3, p.code) },
    latest_year: d._meta.latest_year,
    totals: t ? Object.entries(t.years).map(([y, v]) => ({ year: Number(y), total: v })).sort((a, b) => a.year - b.year) : [],
    top_partner_for: t?.top_partner_for ?? [],
    top_emerging_for: t?.top_emerging_for ?? [],
    rows,
  }
}

/** Countries whose trade shifted most toward (and away from) the emerging partners over 5 years. */
export function getTradeShifts(limit = 20): { toward: ShiftRow[]; away: ShiftRow[]; min_trade_musd: number | null } {
  const d = load()
  if (!d) return { toward: [], away: [], min_trade_musd: null }
  const n = Math.max(1, Math.min(100, Math.floor(limit) || 20))
  return {
    toward: d.shifts.toward_emerging.slice(0, n),
    away: d.shifts.away_from_emerging.slice(0, n),
    min_trade_musd: d._meta.min_trade_for_shifts_musd ?? null,
  }
}

/** Countries available in the dataset (for pickers). */
export function getTradeCountries(): { iso3: string; name: string; iso2: string | null }[] {
  const d = load()
  if (!d) return []
  return Object.entries(d.countries)
    .map(([iso3, c]) => ({ iso3, name: c.name, iso2: c.iso2 }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** UN Comtrade reference codes embedded by the fetch script (used by trade-products.ts). */
export function getComtradeRefs(): { m49: Record<string, number>; hs2: Record<string, string> } {
  return load()?.comtrade ?? { m49: {}, hs2: {} }
}
