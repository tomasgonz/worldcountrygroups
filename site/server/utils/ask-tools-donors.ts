import type { ToolDef } from './llm-client'
import { getRegistry } from './wcg'
import { getDonors, getDonorProfile, getRecipientDonors, getDonorNews, getAidCuts, TRACKER_FILE, NEWS_FILE } from './donors'

/**
 * Research-desk tool for the donor tracker (OECD DAC aid data + donor news).
 * Wire into ask-tools.ts: spread DONOR_TOOLS into ASK_TOOLS and, in runTool's default
 * branch, `const r = await runDonorTool(name, args, src); if (r !== undefined) return r`.
 */

type Src = { add(title: string, url: string, kind: string): string; used(...files: string[]): void }

const OECD_URL = 'https://data-explorer.oecd.org/'
const PAGE = '/partners/donors'
const bn = (v: number | null | undefined) => (v == null ? null : Math.round(v / 1e7) / 100) // USD billions, 2 dp
const mn = (v: number | null | undefined) => (v == null ? null : Math.round(v / 1e5) / 10) // USD millions, 1 dp

export const DONOR_TOOLS: ToolDef[] = [
  {
    name: 'donor_tracker',
    description: 'Official development assistance (ODA, OECD DAC data incl. the latest PRELIMINARY year): without arguments, the donor league table (volume and % of GNI vs the 0.7% target), DAC totals and the biggest aid cuts and increases; with a donor, its ODA trend, %GNI, real-terms change, refugee/humanitarian/bilateral shares, top recipients, top sectors and latest donor news; with a recipient, its total ODA received and top donors (incl. multilaterals); with both, the flow between them. Amounts in USD billions (_bn) or millions (_m).',
    parameters: {
      type: 'object',
      properties: {
        donor: { type: 'string', description: 'Donor country name or ISO code, or "EU" for EU Institutions (news also: "OECD")' },
        recipient: { type: 'string', description: 'Recipient country name or ISO code' },
        include_news: { type: 'boolean', description: 'Include latest donor news (default true when a donor is given)' },
      },
    },
  },
]

const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function resolveCode(input: unknown): string | null {
  const q = fold(String(input ?? ''))
  if (!q) return null
  if (['eu', 'eu institutions', 'european union', 'european commission', 'euu'].includes(q)) return 'EU'
  if (q === 'oecd' || q === 'oecd dac' || q === 'dac') return 'OECD'
  const registry = getRegistry()
  if (/^[a-z]{3}$/.test(q) && registry.getCountryMembership(q.toUpperCase())) return q.toUpperCase()
  if (/^[a-z]{2}$/.test(q)) { const m = registry.getCountryMembership(q.toUpperCase()); if (m?.iso3) return m.iso3 }
  const ALIAS: Record<string, string> = { 'united states': 'USA', us: 'USA', usa: 'USA', america: 'USA', uk: 'GBR', britain: 'GBR', 'united kingdom': 'GBR', turkey: 'TUR', turkiye: 'TUR', 'south korea': 'KOR', korea: 'KOR', uae: 'ARE', emirates: 'ARE', 'saudi': 'SAU', 'dr congo': 'COD', drc: 'COD', palestine: 'PSE', 'ivory coast': 'CIV', syria: 'SYR', russia: 'RUS', china: 'CHN', netherlands: 'NLD', holland: 'NLD' }
  if (ALIAS[q]) return ALIAS[q]
  const all = registry.getAllCountries().filter((c: any) => c.iso3)
  const exact = all.find((c: any) => fold(c.name) === q)
  if (exact) return exact.iso3
  const part = all.find((c: any) => fold(c.name).includes(q))
  return part?.iso3 || null
}

function newsRows(code: string, src: Src, limit = 6) {
  src.used(NEWS_FILE)
  return getDonorNews({ donor: code, limit }).items.map(n => ({
    title: n.title, date: n.publishedAt.slice(0, 10), source: n.source, topics: n.topics,
    ref: src.add(n.title, n.url, 'news'),
  }))
}

function overview(src: Src) {
  const { donors, dac_total, meta } = getDonors()
  if (!meta) return { error: 'Donor tracker data is not loaded yet' }
  const cuts = getAidCuts()
  const ref = src.add('Donor tracker: ODA league table and cuts (OECD DAC)', PAGE, 'page')
  src.add('OECD DAC statistics (DAC1, DAC2A, DAC5)', OECD_URL, 'dataset')
  const row = (d: any) => ({ donor: d.name, code: d.code, year: d.latest.year, preliminary: d.latest.preliminary, oda_bn: bn(d.latest.oda), gni_pct: d.latest.gni_pct, change_1y_pct: d.latest.change_1y_pct, change_3y_pct: d.latest.change_3y_pct })
  const ch = (r: any) => ({ donor: r.name, code: r.code, from: r.from_year, to: r.year, preliminary: r.preliminary, change_bn: bn(r.change_usd), change_pct: r.change_pct })
  const dl = dac_total[dac_total.length - 1]
  const dp = dac_total[dac_total.length - 2]
  return {
    ref,
    data_years: { latest: meta.latest_year, preliminary: meta.preliminary_years, final: meta.final_year, constant_prices: meta.constant_price_year },
    note: 'ODA grant equivalent, current USD; changes are real (constant prices). Preliminary figures will be revised.',
    dac_total: dl ? { year: dl.year, preliminary: !!dl.preliminary, oda_bn: bn(dl.oda), gni_pct: dl.gni_pct, change_pct: dp?.oda_real && dl.oda_real ? Math.round(((dl.oda_real - dp.oda_real) / dp.oda_real) * 1000) / 10 : null } : null,
    top_by_volume: donors.slice(0, 12).map(row),
    top_by_gni_pct: [...donors].filter(d => d.kind === 'country' && d.latest.gni_pct != null).sort((a, b) => (b.latest.gni_pct || 0) - (a.latest.gni_pct || 0)).slice(0, 10).map(row),
    meeting_0_7_target: donors.filter(d => (d.latest.gni_pct ?? 0) >= 0.7).map(d => d.name),
    biggest_cuts_1y: cuts.cuts.slice(0, 10).map(ch),
    biggest_increases_1y: cuts.increases.slice(0, 6).map(ch),
    biggest_cuts_3y: cuts.cuts_3y.slice(0, 8).map(ch),
  }
}

export async function runDonorTool(name: string, args: any, src: Src): Promise<any | undefined> {
  if (name !== 'donor_tracker') return undefined
  src.used(TRACKER_FILE)
  const a = args || {}
  const donorCode = a.donor ? resolveCode(a.donor) : null
  const recipCode = a.recipient ? resolveCode(a.recipient) : null
  if (a.donor && !donorCode) return { error: `Unknown donor "${a.donor}"` }
  if (a.recipient && !recipCode) return { error: `Unknown recipient "${a.recipient}"` }
  if (!donorCode && !recipCode) return overview(src)

  const out: Record<string, any> = {}

  if (donorCode === 'OECD') {
    out.news = newsRows('OECD', src, 8)
    if (!recipCode) return out
  } else if (donorCode) {
    const p = getDonorProfile(donorCode)
    const pageRef = src.add(`Donor tracker: ${p?.name || donorCode}`, `${PAGE}?donor=${donorCode}`, 'page')
    if (!p?.donor) {
      out.donor = { code: donorCode, name: p?.name || donorCode, reports_to_oecd: false, note: 'This provider does not report ODA to the OECD DAC (no figures available here).', ref: pageRef }
    } else {
      const d = p.donor
      const L = d.latest
      out.donor = {
        name: p.name, code: donorCode, ref: pageRef, dac_member: d.dac_member,
        latest: {
          year: L.year, preliminary: L.preliminary, oda_bn: bn(L.oda), gni_pct: L.gni_pct, gni_pct_prev_year: L.gni_pct_prev,
          change_vs_prev_year_pct: L.change_1y_pct, change_vs_prev_year_bn: bn(L.change_1y_usd),
          change_vs_3y_earlier_pct: L.change_3y_pct, base_year_3y: L.base3_year,
          rank_by_volume: L.rank_volume ?? null, rank_by_gni_pct: L.rank_gni ?? null,
          in_donor_refugee_costs_pct: L.refugee_share ?? null, bilateral_pct: L.bilateral_share ?? null, multilateral_pct: L.multilateral_share ?? null,
          humanitarian_pct_of_bilateral: L.humanitarian_share ?? null, humanitarian_year: L.humanitarian_year ?? null,
        },
        trend: d.series.slice(-7).map(s => ({ year: s.year, oda_bn: bn(s.oda), gni_pct: s.gni_pct, ...(s.preliminary ? { preliminary: true } : {}) })),
        top_recipients: { year: d.top_recipients.year, items: d.top_recipients.items.slice(0, 8).map(r => ({ country: r.name, iso3: r.iso3, m_usd: mn(r.usd), prev_year_m_usd: mn(r.prev ?? null) })) },
        top_sectors: d.sectors ? { year: d.sectors.year, basis: d.sectors.basis, items: d.sectors.items.map(s => ({ sector: s.name, share_pct: s.share, m_usd: mn(s.usd) })) } : null,
      }
    }
    if (a.include_news !== false) out.donor_news = newsRows(donorCode, src)
  }

  if (recipCode) {
    const r = getRecipientDonors(recipCode)
    const pageRef = src.add(`${r?.name || recipCode}: country profile (aid received)`, `/countries/${recipCode.toLowerCase()}`, 'page')
    if (!r) {
      out.recipient = { code: recipCode, note: 'No ODA receipts recorded for this country (not on the DAC list of ODA recipients, or no data).', ref: pageRef }
    } else {
      out.recipient = {
        name: r.name, code: recipCode, ref: pageRef, year: r.year, total_received_bn: bn(r.total), rank_among_recipients: r.rank ?? null,
        trend: r.series.map(s => ({ year: s.year, bn: bn(s.usd) })),
        top_donors: r.top_donors.slice(0, 10).map(x => ({ donor: x.name, code: x.code, kind: x.kind, m_usd: mn(x.usd), prev_year_m_usd: mn(x.prev ?? null) })),
      }
      if (donorCode && donorCode !== 'OECD') {
        const hit = r.top_donors.find(x => x.code === donorCode) || r.top_donors_5y.find(x => x.code === donorCode)
        out.flow = hit
          ? { from: donorCode, to: recipCode, year: r.year, m_usd: r.top_donors.find(x => x.code === donorCode) ? mn(hit.usd) : null, five_year_total_m_usd: mn(r.top_donors_5y.find(x => x.code === donorCode)?.usd ?? null) }
          : { from: donorCode, to: recipCode, note: `${donorCode} is not among ${r.name}'s top 10 donors (latest year or 5-year total).` }
      }
    }
  }
  src.add('OECD DAC statistics (DAC1, DAC2A, DAC5)', OECD_URL, 'dataset')
  return out
}
