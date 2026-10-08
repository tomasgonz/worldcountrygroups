import { getRegistry } from '~/server/utils/wcg'
import { countryItem } from '~/server/utils/watchlist'
import { gaVotes } from '~/server/utils/ga-assembly'
import { getRecentResolutions } from '~/server/utils/unvotes'
import { getCountryTradePartners } from '~/server/utils/trade-partners'
import { getDonorProfile, getRecipientDonors } from '~/server/utils/donors'
import { missionFor } from '~/server/utils/un-missions'
import { readDataFile } from '~/server/utils/data-file'
import { getNextElection } from '~/server/utils/upcoming'

const memo: { key: string; table: Record<string, number> | null; sorted: number[] | null } = { key: '', table: null, sorted: null }

/** A country this week, in one panel: news, votes, appointments, quotes, elections, the UN, trade and aid. */
export default defineEventHandler((event) => {
  const code = String(getRouterParam(event, 'iso') || '').toUpperCase()
  const m: any = getRegistry().getCountryMembership(code)
  const iso3 = m?.iso3 || (code.length === 3 ? code : null)
  if (!iso3) throw createError({ statusCode: 404, statusMessage: 'Unknown country' })
  const week = countryItem(iso3, new Date(Date.now() - 7 * 86400_000).toISOString())

  // share of contested General Assembly votes cast with the majority, in the session analysed on the Assembly page
  const v = gaVotes()
  let withMajority: { pct: number; session: number; rank: number; of: number } | null = null
  const key = v ? `${v.focus}|${v.lastVote}` : ''
  if (v && memo.key === key && memo.table) {
    const mine = memo.table[iso3]
    if (mine != null) withMajority = { pct: Math.round(mine), session: v.focus, rank: memo.sorted!.findIndex(x => x <= mine) + 1, of: memo.sorted!.length }
  } else if (v) {
    const rs = getRecentResolutions(4).filter(r => r.s === v.focus)
    const contested = rs.filter((r) => {
      const c: Record<string, number> = {}
      let n = 0
      for (const x of Object.values(r.v)) if (x === 'Y' || x === 'N' || x === 'A') { c[x] = (c[x] || 0) + 1; n++ }
      return n >= 100 && (n - Math.max(0, ...Object.values(c))) / n >= 0.1
    })
    const share = (iso: string) => {
      let same = 0, n = 0
      for (const r of contested) {
        const x = r.v[iso]
        if (!(x === 'Y' || x === 'N' || x === 'A')) continue
        const c: Record<string, number> = {}
        for (const y of Object.values(r.v)) if (y === 'Y' || y === 'N' || y === 'A') c[y] = (c[y] || 0) + 1
        const maj = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]
        n++; if (x === maj) same++
      }
      return n >= 30 ? (same / n) * 100 : null
    }
    // every country's share, computed once per data update
    const table: Record<string, number> = {}
    for (const c of new Set(contested.flatMap(r => Object.keys(r.v)))) { const x = share(c); if (x != null) table[c] = x }
    memo.key = key
    memo.table = table
    memo.sorted = Object.values(table).sort((a, b) => b - a)
    const mine = table[iso3]
    if (mine != null) withMajority = { pct: Math.round(mine), session: v.focus, rank: memo.sorted.findIndex(x => x <= mine) + 1, of: memo.sorted.length }
  }

  const sc = ((readDataFile<any>('un-elections.json')?.security_council?.composition || []) as any[]).find(c => c.iso3 === iso3)
  const trade: any = getCountryTradePartners(iso3)
  const donor: any = getDonorProfile(iso3)?.donor
  const recip: any = getRecipientDonors(iso3)
  const mission: any = missionFor(iso3)
  return {
    iso3,
    week: { news: week.newsCount, statements: week.statementCount, topStatement: week.statements[0] || null, topNews: week.news[0] || null,
      ga: week.ga, sc: week.sc, appointments: week.appointments, quotes: week.quotes, sgStatements: week.sgStatements },
    nextElection: (() => { const e: any = getNextElection(iso3); return e ? { date: e.date, type: e.type, precision: e.precision } : null })(),
    withMajority,
    council: sc ? { permanent: !!sc.permanent, termEnd: sc.term_end ?? null } : null,
    dues: week.dues,
    pr: mission?.head ? { name: mission.head.name, since: mission.head.credentials || mission.head.appointed } : null,
    trade: trade ? { year: trade.latest_year, topPartner: trade.partners?.find((p: any) => p.code === trade.top_partner)?.name || trade.top_partner, share: trade.top_partner_share, emergingShare: trade.emerging?.share ?? null } : null,
    aid: donor?.latest ? { role: 'donor', year: donor.latest.year, usd: donor.latest.oda, gniPct: donor.latest.gni_pct }
      : recip?.total ? { role: 'recipient', year: recip.year, usd: recip.total, topDonor: recip.top_donors?.[0]?.name || null } : null,
  }
})
