import { readDataFile } from './data-file'
import { getRegistry } from './wcg'
import { aidForCountries } from './aid-recipients'
import { archiveForCountries } from './news-analysis'
import { getElections } from './upcoming'
import { getCountryTerms } from './un-elections'
import { groupLoyalty } from './voting-dynamics'
import { TRADE_FILE } from './trade-partners'

/**
 * One picture of a group (or any list of countries), joining the trackers: aid received,
 * trade with the big partners, elections ahead, Security Council seats, UN voting cohesion
 * and the week's news. Used by the group pages and by the research desk.
 */
const r1 = (v: number) => Math.round(v * 10) / 10

function nameOf(iso3: string) {
  const m: any = getRegistry().getCountryMembership(iso3)
  return { iso3, name: m?.name || iso3, iso2: m?.iso2 || null }
}

/** Trade of the members with the tracked partners, added up (latest year and five years earlier). */
export function groupTrade(isos: string[]) {
  const d = readDataFile<any>(TRADE_FILE)
  if (!d?.countries) return null
  const L = String(d._meta.latest_year)
  const B = String(d._meta.base_5y)
  const members = isos.filter(i => d.countries[i])
  if (!members.length) return null
  const sum = (f: any) => (f ? (f.x || 0) + (f.m || 0) : 0)
  let world = 0, worldB = 0, exports = 0, imports = 0
  const by: Record<string, { now: number; base: number; x: number; m: number }> = {}
  const topFor: Record<string, string[]> = {}
  for (const i of members) {
    const c = d.countries[i]
    world += sum(c.world.years[L])
    worldB += sum(c.world.years[B])
    exports += c.world.years[L]?.x || 0
    imports += c.world.years[L]?.m || 0
    for (const [code, p] of Object.entries<any>(c.partners || {})) {
      const e = (by[code] ||= { now: 0, base: 0, x: 0, m: 0 })
      e.now += sum(p.years[L])
      e.base += sum(p.years[B])
      e.x += p.years[L]?.x || 0
      e.m += p.years[L]?.m || 0
    }
    if (c.top_partner) (topFor[c.top_partner] ||= []).push(i)
  }
  const partners = (d.partners || []).filter((p: any) => by[p.code] && !(p.code === p.iso3 && members.includes(p.iso3))).map((p: any) => {
    const e = by[p.code]
    const share = world ? r1((e.now / world) * 100) : null
    const share5y = worldB ? r1((e.base / worldB) * 100) : null
    return {
      code: p.code, name: p.name, group: p.group, iso2: p.code === 'EU' ? 'EU' : nameOf(p.iso3).iso2,
      tradeMusd: Math.round(e.now), exportsMusd: Math.round(e.x), importsMusd: Math.round(e.m),
      share, share5y, change5y: share != null && share5y != null ? r1(share - share5y) : null,
      topPartnerOf: (topFor[p.code] || []).length,
    }
  }).sort((a: any, b: any) => (b.share || 0) - (a.share || 0))
  const emerging = partners.filter((p: any) => p.group === 'emerging')
  const emergingShare = r1(emerging.reduce((a: number, p: any) => a + (p.share || 0), 0))
  const emergingShare5y = r1(emerging.reduce((a: number, p: any) => a + (p.share5y || 0), 0))
  return {
    year: Number(L), baseYear: Number(B), members: members.length,
    totalMusd: Math.round(world), exportsMusd: Math.round(exports), importsMusd: Math.round(imports),
    emergingShare, emergingShare5y, partners,
    note: 'Goods trade with 15 tracked partners (IMF DOTS), as a share of the members\' total trade; trade between members is included.',
  }
}

/** Elections in member countries: the next year, and the last 45 days. */
export function groupElections(isos: string[]) {
  const set = new Set(isos)
  const mine = (e: any) => e.iso3 && set.has(e.iso3) && !e.indirect
  const ahead = getElections({ status: 'upcoming', withinDays: 365 }).filter(mine).slice(0, 15)
  const cutoff = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10)
  const recent = getElections({ status: 'past' }).filter(e => mine(e) && e.sort_date >= cutoff).slice(0, 8)
  const row = (e: any) => ({ id: e.id, date: e.date, precision: e.precision, iso3: e.iso3, iso2: nameOf(e.iso3).iso2, country: e.country, type: e.type, url: e.article_url || e.source_url })
  return { ahead: ahead.map(row), recent: recent.map(row) }
}

/** Members holding or seeking a Security Council seat. */
export function groupCouncilSeats(isos: string[]) {
  const set = new Set(isos)
  const terms = getCountryTerms().filter(t => set.has(t.iso3))
  return {
    sitting: terms.filter(t => t.permanent || t.terms.some(x => x.status === 'serving')).map(t => ({ iso3: t.iso3, iso2: t.iso2, name: t.name, permanent: t.permanent, term: t.permanent ? null : t.last_term })),
    elected: terms.filter(t => t.terms.some(x => x.status === 'elected')).map(t => ({ iso3: t.iso3, iso2: t.iso2, name: t.name, term: t.last_term })),
    candidates: terms.filter(t => t.candidacies.some(c => c.outcome === 'upcoming')).map(t => ({ iso3: t.iso3, iso2: t.iso2, name: t.name, term: t.candidacies.find(c => c.outcome === 'upcoming')!.term })),
  }
}

export function groupPicture(o: { gid?: string | null; isos?: string[]; newsDays?: number }) {
  const reg = getRegistry()
  const g: any = o.gid ? reg.getGroup(o.gid) : null
  const isos: string[] = g ? g.countries.map((c: any) => c.iso3).filter(Boolean) : (o.isos || [])
  if (!isos.length) return null
  const aid = aidForCountries(isos)
  const loyal = g ? groupLoyalty(o.gid!, 5) : null
  const news = archiveForCountries(isos, o.newsDays || 7, 12)
  return {
    group: g ? { gid: o.gid, name: g.name, acronym: g.acronym, size: isos.length } : { gid: null, name: null, acronym: null, size: isos.length },
    aid: aid.recipients ? {
      year: aid.latestYear, recipients: aid.recipients, totalUsd: aid.total, change1y: aid.change1y, perCapita: aid.perCapita,
      multilateralShare: aid.multilateralShare, multilateralTotal: aid.multilateralTotal,
      series: aid.series,
      topRecipients: aid.rows.slice(0, 5).map(r => ({ iso3: r.iso3, iso2: r.iso2, name: r.name, usd: r.total, change1y: r.change1y, perCapita: r.perCapita })),
      topDonors: aid.donors.slice(0, 6).map(d => ({ code: d.code, iso2: d.iso2, name: d.name, usd: d.usd, share: d.share, change1y: d.change1y })),
    } : null,
    trade: groupTrade(isos),
    elections: groupElections(isos),
    council: groupCouncilSeats(isos),
    voting: loyal && loyal.members.length ? {
      median: loyal.median != null ? Math.round(loyal.median * 1000) / 10 : null, contested: loyal.contested,
      leastLoyal: loyal.members.slice(0, 5).map(m => ({ iso3: m.iso3, iso2: m.iso2, name: m.name, pct: Math.round((m.loyalty as number) * 1000) / 10 })),
    } : null,
    news: news ? {
      ...news,
      byCountry: news.byCountry.slice(0, 10).map(c => ({ ...c, ...nameOf(c.iso3) })),
      latest: news.latest.map((n: any) => ({ ...n, countryNames: n.countries.map((i: string) => nameOf(i).name) })),
    } : null,
  }
}
