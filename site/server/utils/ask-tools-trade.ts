import type { ToolDef } from './llm-client'
import { getCountryTradePartners, getPartnerView, getTradeMeta, getTradeShifts, getTradeCountries, getTradePartnerList, TRADE_FILE } from './trade-partners'

/**
 * Ask-desk tool for the emerging trading partners tracker (IMF IMTS goods trade).
 * Wired into ask-tools.ts: include TRADE_TOOLS in the tool list and try runTradeTool()
 * before the main switch (it returns undefined for names it does not handle).
 */

interface SourceSink { add(title: string, url: string, kind: string): string; used(...files: string[]): void }

export const TRADE_TOOLS: ToolDef[] = [
  {
    name: 'trade_partners',
    description: "Goods trade with the big emerging economies (China, India, Brazil, Türkiye, Saudi Arabia, UAE, Qatar, Russia, Indonesia, South Africa, Mexico) compared with the traditional partners (USA, EU-27, Japan, UK), from IMF trade statistics (annual, last ~10 years, plus monthly). With a country: its exports/imports with each partner, shares of its total trade and their change over 5 and 10 years, and the emerging partners' combined share. With a partner only: which countries depend most on trade with it and how that changed. With neither: the countries whose trade shifted most toward or away from the emerging partners.",
    parameters: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Reporter country (name or ISO code)' },
        partner: { type: 'string', description: 'One partner: China, India, Brazil, Turkey, Saudi Arabia, UAE, Qatar, Russia, Indonesia, South Africa, Mexico, USA, EU, Japan or UK' },
        years: { type: 'integer', description: 'Years of annual history to include (default 10, max 11)' },
      },
    },
  },
]

const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const r1 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 10) / 10)

const COUNTRY_ALIAS: Record<string, string> = {
  'united states': 'USA', us: 'USA', usa: 'USA', america: 'USA', uk: 'GBR', britain: 'GBR', 'great britain': 'GBR', 'united kingdom': 'GBR',
  russia: 'RUS', china: 'CHN', iran: 'IRN', syria: 'SYR', 'south korea': 'KOR', korea: 'KOR', 'north korea': 'PRK', palestine: 'PSE',
  'dr congo': 'COD', drc: 'COD', turkey: 'TUR', turkiye: 'TUR', 'ivory coast': 'CIV', vietnam: 'VNM', venezuela: 'VEN', bolivia: 'BOL',
  egypt: 'EGY', laos: 'LAO', uae: 'ARE', emirates: 'ARE', 'united arab emirates': 'ARE', kosovo: 'XKX', tanzania: 'TZA', moldova: 'MDA',
}
const PARTNER_ALIAS: Record<string, string> = {
  eu: 'EU', 'european union': 'EU', 'eu-27': 'EU', 'eu27': 'EU', europe: 'EU', uae: 'ARE', emirates: 'ARE', 'united arab emirates': 'ARE',
  us: 'USA', usa: 'USA', 'united states': 'USA', america: 'USA', uk: 'GBR', britain: 'GBR', 'united kingdom': 'GBR',
  turkey: 'TUR', turkiye: 'TUR', russia: 'RUS', 'saudi arabia': 'SAU', saudi: 'SAU', 'south africa': 'ZAF',
}

function resolveCountry(input: string): string | null {
  const q = fold(input)
  if (!q) return null
  const all = getTradeCountries()
  if (/^[a-z]{3}$/.test(q) && all.some(c => c.iso3 === q.toUpperCase())) return q.toUpperCase()
  if (/^[a-z]{2}$/.test(q)) { const c = all.find(x => (x.iso2 || '').toLowerCase() === q); if (c) return c.iso3 }
  if (COUNTRY_ALIAS[q]) return COUNTRY_ALIAS[q]
  return (all.find(c => fold(c.name) === q) || all.find(c => fold(c.name).startsWith(q)) || all.find(c => fold(c.name).includes(q)))?.iso3 || null
}

function resolvePartner(input: string): string | null {
  const q = fold(input)
  if (!q) return null
  const list = getTradePartnerList()
  if (PARTNER_ALIAS[q]) return PARTNER_ALIAS[q]
  const hit = list.find(p => p.code.toLowerCase() === q || (p.iso3 || '').toLowerCase() === q || fold(p.name) === q || fold(p.name).includes(q))
  return hit?.code || null
}

const pageUrl = (params: Record<string, string>) => `/partners/trade?${new URLSearchParams(params).toString()}`

export async function runTradeTool(name: string, args: any, src: SourceSink): Promise<any | undefined> {
  if (name !== 'trade_partners') return undefined
  const meta = getTradeMeta()
  if (!meta) return { error: 'Trade data is not available yet.' }
  src.used(TRADE_FILE)
  const years = Math.max(1, Math.min(11, Math.floor(Number(args?.years)) || 10))
  const notes = [
    `IMF International Merchandise Trade Statistics; annual data to ${meta.latest_year}, monthly to ${meta.latest_month || 'n/a'}. Values in USD millions; shares are % of the country's total goods trade (exports + imports).`,
    'Gaps are filled with partner (mirror) data and IMF estimates; the EU-27 aggregate includes intra-EU trade for EU members.',
  ]
  const partnerCode = args?.partner ? resolvePartner(String(args.partner)) : null
  if (args?.partner && !partnerCode) return { error: `Unknown partner "${args.partner}". Tracked: ${meta.partners.map(p => p.name).join(', ')}` }

  // --- one country ---------------------------------------------------------------
  if (args?.country) {
    const iso3 = resolveCountry(String(args.country))
    const c = iso3 ? getCountryTradePartners(iso3) : null
    if (!c) return { error: `No IMF trade data for "${args.country}"` }
    const ref = src.add(`${c.name}: trade with emerging and traditional partners (IMF IMTS, ${c.latest_year})`, pageUrl({ country: c.iso3 }), 'dataset')
    const from = c.latest_year - years + 1
    const rows = c.partners.filter(p => !partnerCode || p.code === partnerCode)
    return {
      country: c.name, iso3: c.iso3, latest_year: c.latest_year, ref,
      total_trade_musd: r1(c.world.total), exports_musd: r1(c.world.exports), imports_musd: r1(c.world.imports),
      emerging_combined: {
        share_pct: c.emerging.share, share_5y_ago: c.emerging.share_5y, share_10y_ago: c.emerging.share_10y,
        change_5y_pts: c.emerging.change_5y, change_10y_pts: c.emerging.change_10y,
        share_of_exports: c.emerging.x_share, share_of_imports: c.emerging.m_share,
        by_year: c.emerging.series.filter(s => s.year >= from).map(s => ({ year: s.year, share: r1(s.share) })),
      },
      traditional_combined: { share_pct: c.traditional.share, change_5y_pts: c.traditional.change_5y, change_10y_pts: c.traditional.change_10y },
      partners: rows.map(p => ({
        partner: p.name, group: p.group, exports_musd: r1(p.exports), imports_musd: r1(p.imports),
        share_pct: p.share, change_5y_pts: p.change_5y, change_10y_pts: p.change_10y,
        share_of_exports: p.export_share, share_of_imports: p.import_share, growth_5y_cagr_pct: p.growth_5y, yoy_pct: p.yoy,
        ...(partnerCode ? { share_by_year: p.series.filter(s => s.year >= from) } : {}),
      })),
      top_emerging_partner: c.partners.find(p => p.code === c.top_emerging)?.name ?? null,
      largest_tracked_partner: c.partners.find(p => p.code === c.top_partner)?.name ?? null,
      china_share_of_exports: c.china_export_share,
      last_12_months: c.monthly?.ttm ?? null,
      notes,
    }
  }

  // --- one partner ---------------------------------------------------------------
  if (partnerCode) {
    const v = getPartnerView(partnerCode, { minTrade: 1000 })
    if (!v) return { error: 'Partner not found' }
    const ref = src.add(`Who trades with ${v.partner.name} (IMF IMTS, ${v.latest_year})`, pageUrl({ partner: v.partner.code }), 'dataset')
    const gainers = [...v.rows].filter(r => r.change_5y != null).sort((a, b) => (b.change_5y ?? 0) - (a.change_5y ?? 0))
    const slim = (r: typeof v.rows[number]) => ({ country: r.name, iso3: r.iso3, share_pct: r.share, change_5y_pts: r.change_5y, change_10y_pts: r.change_10y, share_of_exports: r.export_share, trade_musd: r1(r.total) })
    return {
      partner: v.partner.name, latest_year: v.latest_year, ref,
      note: 'Countries with at least USD 1bn of total goods trade.',
      most_dependent: v.rows.slice(0, 15).map(slim),
      biggest_gains_5y: gainers.slice(0, 10).map(slim),
      biggest_losses_5y: gainers.slice(-5).reverse().map(slim),
      total_trade_with_reporters_by_year: v.totals.slice(-years).map(t => ({ year: t.year, musd: Math.round(t.total) })),
      largest_tracked_partner_for: v.top_partner_for.length,
      notes,
    }
  }

  // --- global shifts -------------------------------------------------------------
  const s = getTradeShifts(10)
  const ref = src.add(`Shifts toward emerging trading partners (IMF IMTS, ${meta.base_5y}-${meta.latest_year})`, '/partners/trade', 'dataset')
  const pname = (code: string | null) => meta.partners.find(p => p.code === code)?.name ?? code
  const slim = (r: (typeof s.toward)[number]) => ({ country: r.name, iso3: r.iso3, emerging_share_pct: r.share, five_years_ago: r.share_5y, change_5y_pts: r.change_5y, change_10y_pts: r.change_10y, biggest_gainer: pname(r.biggest_gainer) })
  return {
    period: `${meta.base_5y}-${meta.latest_year}`, ref,
    note: `Countries with at least USD ${Math.round((s.min_trade_musd ?? 0) / 1000)}bn of goods trade.`,
    toward_emerging: s.toward.map(slim),
    away_from_emerging: s.away.map(slim),
    notes,
  }
}
