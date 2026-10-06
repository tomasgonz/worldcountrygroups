import { readDataFile } from './data-file'
import { getRegistry } from './wcg'

/**
 * Aid seen from the receiving side: countries ranked by the official development
 * assistance (ODA) they receive, totals for any group of countries, the donors behind
 * them, and a comparison of groups. Built from donor-tracker.json (recipients, OECD DAC2A)
 * and oecd-oda.json (donor → recipient flows, used to add up donors for a group).
 */
interface Recip { name: string; year: number; total: number; series: { year: number; usd: number }[]; top_donors?: any[] }

function recipients(): Record<string, Recip> { return readDataFile<any>('donor-tracker.json')?.recipients || {} }
function stats(): Record<string, any> {
  const s = readDataFile<any>('country-stats.json') || {}
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries<any>(s)) if (k !== '_meta' && v?.iso3) out[v.iso3] = v
  return out
}
const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null)
const valAt = (r: Recip, y: number) => r.series.find(s => s.year === y)?.usd ?? null

/** The groups worth offering: at least three members that receive aid. */
export function aidGroups() {
  const reg = getRegistry()
  const rec = recipients()
  return reg.listGroups().map((gid: string) => {
    const g: any = reg.getGroup(gid)
    const members = (g?.countries || []).map((c: any) => c.iso3).filter((i: string) => rec[i])
    return { gid, name: g?.name || gid, acronym: g?.acronym || '', recipients: members.length, size: (g?.countries || []).length }
  }).filter(g => g.recipients >= 3).sort((a, b) => b.recipients - a.recipients)
}

function rowFor(iso3: string, r: Recip, st: Record<string, any>) {
  const latest = r.year
  const prev = valAt(r, latest - 1)
  const three = valAt(r, latest - 3)
  const s = st[iso3] || {}
  const donors = (r.top_donors || []).filter((d: any) => d.usd > 0)
  const top = donors[0]
  const listed = donors.reduce((a: number, d: any) => a + d.usd, 0)
  const multi = donors.filter((d: any) => d.kind !== 'country').reduce((a: number, d: any) => a + d.usd, 0)
  return {
    iso3, iso2: s.iso2 || null, name: r.name, year: latest, total: r.total,
    change1y: prev !== null ? pct(r.total, prev) : null, change3y: three !== null ? pct(r.total, three) : null,
    perCapita: s.population ? Math.round((r.total / s.population) * 10) / 10 : null,
    pctGdp: s.gdp ? Math.round((r.total / s.gdp) * 10000) / 100 : null,
    topDonor: top ? { name: top.name, iso3: top.iso3 || null, usd: top.usd, share: r.total ? Math.round((top.usd / r.total) * 1000) / 10 : null } : null,
    multilateralShare: listed ? Math.round((multi / listed) * 1000) / 10 : null,
    series: r.series,
  }
}

/** Recipient table, optionally for one group, with the group's totals and donors. */
export function recipientsView(gid?: string | null) {
  let members: string[] | null = null
  let group: any = null
  if (gid) {
    const g: any = getRegistry().getGroup(gid)
    if (!g) return null
    members = (g.countries || []).map((c: any) => c.iso3)
    group = { gid, name: g.name, acronym: g.acronym, size: members!.length }
  }
  return { group, ...aidForCountries(members) }
}

/** Aid received by any set of countries (all recipients when null): totals, trend, rows and donors. */
export function aidForCountries(members: string[] | null) {
  const rec = recipients()
  const st = stats()
  const isos = Object.keys(rec).filter(i => !members || members.includes(i))
  const rows = isos.map(i => rowFor(i, rec[i], st)).sort((a, b) => b.total - a.total)
  const years = [...new Set(rows.flatMap(r => r.series.map(s => s.year)))].sort()
  const series = years.map(y => ({ year: y, usd: rows.reduce((a, r) => a + (r.series.find(s => s.year === y)?.usd || 0), 0) }))
  const latestYear = years[years.length - 1]
  const total = series.find(s => s.year === latestYear)?.usd || 0
  const prevTotal = series.find(s => s.year === latestYear - 1)?.usd || 0
  const pop = rows.reduce((a, r) => a + (st[r.iso3]?.population || 0), 0)
  return {
    latestYear, recipients: rows.length,
    notReceiving: members ? members.filter(m => !rec[m]).length : null,
    total, change1y: pct(total, prevTotal), perCapita: pop ? Math.round((total / pop) * 10) / 10 : null,
    series, rows, ...groupDonors(isos, latestYear, total),
  }
}

/** Donors behind a set of recipients, from donor → recipient flows. */
function groupDonors(isos: string[], year: number, total: number) {
  const flows: any[] = readDataFile<any>('oecd-oda.json')?.flows || []
  const set = new Set(isos)
  const by = new Map<string, { donor: string; usd: number; prev: number }>()
  for (const f of flows) {
    if (!set.has(f.recipient)) continue
    const e = by.get(f.donor) || { donor: f.donor, usd: 0, prev: 0 }
    e.usd += Number(f.years?.[String(year)] || 0)
    e.prev += Number(f.years?.[String(year - 1)] || 0)
    by.set(f.donor, e)
  }
  const donorNames = readDataFile<any>('donor-tracker.json')?.donors || {}
  const reg = getRegistry()
  const list = [...by.values()].filter(d => d.usd > 0).sort((a, b) => b.usd - a.usd)
  const sum = list.reduce((a, d) => a + d.usd, 0)
  // flows cover donor countries only; multilateral institutions (World Bank, EU, UN funds…) come from each
  // recipient's breakdown by donor type. Net figures: negative when loan repayments exceed new aid.
  const rec = recipients() as Record<string, any>
  const multilateral = isos.reduce((a, i) => a + (rec[i]?.by_kind ? (rec[i].by_kind.multilateral || 0) + (rec[i].by_kind.eu || 0) : 0), 0)
  const donors = list.slice(0, 15).map(d => ({
    code: d.donor, name: donorNames[d.donor]?.name || reg.getCountryMembership(d.donor)?.name || d.donor,
    iso2: (reg.getCountryMembership(d.donor) as any)?.iso2 || null,
    usd: d.usd, share: total ? Math.round((d.usd / total) * 1000) / 10 : null, change1y: pct(d.usd, d.prev),
  }))
  return { donors, bilateralTotal: sum, multilateralTotal: multilateral, multilateralShare: total ? Math.round((multilateral / total) * 1000) / 10 : null }
}

/** Groups compared: aid received, per person, change, the main donor. */
export function compareGroups() {
  const rec = recipients()
  const st = stats()
  return aidGroups().filter(g => !['world', 'un'].includes(g.gid) && g.size < 180).map(g => {
    const members: string[] = ((getRegistry().getGroup(g.gid) as any)?.countries || []).map((c: any) => c.iso3).filter((i: string) => rec[i])
    const latest = Math.max(...members.map(i => rec[i].year))
    const total = members.reduce((a, i) => a + (valAt(rec[i], latest) || 0), 0)
    const prev = members.reduce((a, i) => a + (valAt(rec[i], latest - 1) || 0), 0)
    const pop = members.reduce((a, i) => a + (st[i]?.population || 0), 0)
    return { ...g, year: latest, total, change1y: pct(total, prev), perCapita: pop ? Math.round((total / pop) * 10) / 10 : null }
  }).sort((a, b) => b.total - a.total)
}
