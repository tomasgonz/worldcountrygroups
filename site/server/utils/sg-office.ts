import { readDataFile } from './data-file'
import { getRegistry } from './wcg'

/**
 * The Secretary-General's office: senior appointments and statements, from sg-office.json
 * (scripts/fetch_sg_office.py: press.un.org and un.org/sg headlines as indexed by Google News).
 */
export interface SgAppointment {
  title: string; url: string; date: string; source?: string; official?: boolean
  person: string | null; nationality: string | null; nationalityName: string | null
  post: string; category: string; rank: string | null; acting: boolean; dutyCountries: string[]
}
export interface SgStatement { title: string; url: string; date: string; kind: string; countries: string[]; source: string }

const file = () => readDataFile<any>('sg-office.json')

function country(iso3: string | null) {
  if (!iso3) return null
  const m: any = getRegistry().getCountryMembership(iso3)
  return { iso3, name: m?.name || iso3, iso2: m?.iso2 || null }
}

function regions(): Record<string, string> {
  const s = readDataFile<any>('country-stats.json') || {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries<any>(s)) if (k !== '_meta' && v?.iso3 && v.region) out[v.iso3] = v.region
  return out
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString()
const fold = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function sgOffice(o: { country?: string | null; category?: string | null; kind?: string | null; q?: string | null; statements?: number; appointments?: number } = {}) {
  const f = file()
  if (!f) return null
  const meta = f._meta || {}
  const iso = o.country ? o.country.toUpperCase() : null
  const q = o.q ? fold(o.q) : null
  let appts: SgAppointment[] = f.appointments || []
  let stmts: SgStatement[] = f.statements || []
  const allAppts = appts
  if (iso) {
    appts = appts.filter(a => a.nationality === iso || a.dutyCountries.includes(iso))
    stmts = stmts.filter(s => s.countries.includes(iso))
  }
  if (o.category) appts = appts.filter(a => a.category === o.category)
  if (o.kind) stmts = stmts.filter(s => s.kind === o.kind)
  if (q) {
    appts = appts.filter(a => fold(`${a.person} ${a.post} ${a.nationalityName}`).includes(q))
    stmts = stmts.filter(s => fold(s.title).includes(q))
  }

  // who gets appointed: last 36 months, people only (not panels), by nationality and region
  const reg = regions()
  const since36 = daysAgo(1095)
  const people = allAppts.filter(a => a.person && a.date >= since36)
  const byNat = new Map<string, number>()
  const byRegion = new Map<string, number>()
  let unknownNat = 0
  for (const a of people) {
    if (!a.nationality) { unknownNat++; continue }
    byNat.set(a.nationality, (byNat.get(a.nationality) || 0) + 1)
    const r = reg[a.nationality] || 'Other'
    byRegion.set(r, (byRegion.get(r) || 0) + 1)
  }
  const byCategory = (since: string) => {
    const c: Record<string, number> = {}
    for (const a of allAppts) if (a.date >= since) c[a.category] = (c[a.category] || 0) + 1
    return c
  }

  // statements: weekly counts (last 12 weeks) and countries mentioned (last 90 days)
  const weeks: { week: string; n: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const end = new Date(Date.now() - i * 7 * 86400_000)
    const start = new Date(end.getTime() - 7 * 86400_000)
    weeks.push({ week: start.toISOString().slice(0, 10), n: (f.statements || []).filter((s: SgStatement) => s.date >= start.toISOString() && s.date < end.toISOString()).length })
  }
  const mentioned = new Map<string, number>()
  for (const s of (f.statements || []) as SgStatement[]) if (s.date >= daysAgo(90)) for (const c of s.countries) mentioned.set(c, (mentioned.get(c) || 0) + 1)

  return {
    meta: { updatedAt: meta.updated_at || null, firstRun: meta.first_run || null, source: meta.source, categoryLabels: meta.category_labels || {}, kindLabels: meta.kind_labels || {} },
    appointments: appts.slice(0, o.appointments ?? 30).map(a => ({ ...a, nationalityC: country(a.nationality), duty: a.dutyCountries.map(country) })),
    appointmentsTotal: appts.length,
    statements: stmts.slice(0, o.statements ?? 40).map(s => ({ ...s, countriesC: s.countries.map(country) })),
    statementsTotal: stmts.length,
    stats: {
      appointments12m: byCategory(daysAgo(365)),
      appointmentsSince: allAppts.length ? allAppts[allAppts.length - 1].date : null,
      people36m: people.length, unknownNationality: unknownNat,
      byNationality: [...byNat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([iso3, n]) => ({ ...country(iso3)!, n })),
      byRegion: [...byRegion.entries()].sort((a, b) => b[1] - a[1]).map(([region, n]) => ({ region, n })),
      statementWeeks: weeks,
      statementKinds: Object.entries((f.statements || []).filter((s: SgStatement) => s.date >= daysAgo(90)).reduce((acc: Record<string, number>, s: SgStatement) => { acc[s.kind] = (acc[s.kind] || 0) + 1; return acc }, {})).map(([kind, n]) => ({ kind, n })).sort((a: any, b: any) => b.n - a.n),
      statementsFirst: (f.statements || []).length ? (f.statements[f.statements.length - 1] as SgStatement).date : null,
      mentioned90d: [...mentioned.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([iso3, n]) => ({ ...country(iso3)!, n })),
    },
  }
}
