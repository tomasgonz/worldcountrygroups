import { readDataFile } from './data-file'
import { getRegistry } from './wcg'
import { getRecentResolutions, type Resolution } from './unvotes'

/**
 * The General Assembly and ECOSOC: recorded votes analysed by session (from the country-by-country
 * voting data), the Main Committees (bureaus, meetings, press), and ECOSOC (president, members,
 * meetings, press). Sources: un-votes data, ga-assembly.json, un-journal.json, un-elections.json,
 * un-leadership.json.
 */
const VOTE = new Set(['Y', 'N', 'A'])
const GROUPS = ['eu', 'g77', 'au', 'oic', 'asean', 'nam', 'grulac', 'weog', 'eeg']
const BIG = ['USA', 'CHN', 'RUS']

function country(iso3: string) {
  const m: any = getRegistry().getCountryMembership(iso3)
  return { iso3, name: m?.name || iso3, iso2: m?.iso2 || null }
}

function tally(r: Resolution) {
  const t = { yes: 0, no: 0, abstain: 0, absent: 0 }
  for (const v of Object.values(r.v)) {
    if (v === 'Y') t.yes++
    else if (v === 'N') t.no++
    else if (v === 'A') t.abstain++
    else t.absent++
  }
  return t
}

/** Contested: at least 100 countries voting and at least 10% departing from the overall majority. */
function contested(rs: Resolution[]) {
  return rs.filter((r) => {
    const t = tally(r)
    const n = t.yes + t.no + t.abstain
    return n >= 100 && (n - Math.max(t.yes, t.no, t.abstain)) / n >= 0.1
  })
}

const overall = new WeakMap<Resolution, string | null>()
function majority(r: Resolution, members?: string[]): string | null {
  if (!members) {
    if (!overall.has(r)) overall.set(r, majorityOf(r))
    return overall.get(r) as string | null
  }
  return majorityOf(r, members)
}
function majorityOf(r: Resolution, members?: string[]): string | null {
  const c: Record<string, number> = {}
  for (const [k, v] of Object.entries(r.v)) if (VOTE.has(v) && (!members || members.includes(k))) c[v] = (c[v] || 0) + 1
  const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]
  return e ? e[0] : null
}

function agreement(rs: Resolution[], a: (r: Resolution) => string | null, b: (r: Resolution) => string | null) {
  let same = 0, n = 0
  for (const r of rs) {
    const x = a(r), y = b(r)
    if (x && y && VOTE.has(x) && VOTE.has(y)) { n++; if (x === y) same++ }
  }
  return n >= 10 ? { pct: Math.round((same / n) * 1000) / 10, n } : null
}

function sessionVotes() {
  const all = getRecentResolutions(4)
  const sessions = [...new Set(all.map(r => r.s))].sort((a, b) => b - a)
  // the latest session with enough recorded votes to analyse (a new session has only a handful)
  const focus = sessions.find(s => all.filter(r => r.s === s).length >= 30) ?? sessions[0]
  const prev = sessions.find(s => s < focus)
  return { all, sessions, focus, prev }
}

let memo: { key: string; value: any } | null = null

export function gaVotes() {
  const { all, sessions, focus, prev } = sessionVotes()
  if (focus == null) return null
  const key = `${all.length}|${all.reduce((m, r) => (r.d > m ? r.d : m), '')}`
  if (memo?.key === key) return memo.value
  const value = computeVotes(all, sessions, focus, prev)
  memo = { key, value }
  return value
}

function computeVotes(all: Resolution[], sessions: number[], focus: number, prev: number | undefined) {
  const reg = getRegistry()
  const inFocus = all.filter(r => r.s === focus)
  const inPrev = prev != null ? all.filter(r => r.s === prev) : []
  const cf = contested(inFocus)
  const cp = contested(inPrev)
  const latest = sessions[0]
  const newest = all.filter(r => r.s === latest).sort((a, b) => b.d.localeCompare(a.d))

  // most divided: lowest share in favour among those voting
  const divided = inFocus.map((r) => {
    const t = tally(r)
    const n = t.yes + t.no + t.abstain
    return { id: r.id, date: r.d, title: r.t, tally: t, yesShare: n ? Math.round((t.yes / n) * 1000) / 10 : null }
  }).filter(x => x.yesShare != null).sort((a, b) => (a.yesShare as number) - (b.yesShare as number)).slice(0, 10)

  // groups: how often members vote with their group's majority (median member), and where they split most
  const groups = GROUPS.map((gid) => {
    const g: any = reg.getGroup(gid)
    if (!g) return null
    const members: string[] = g.countries.map((c: any) => c.iso3).filter(Boolean)
    const scores = (rs: Resolution[]) => {
      const vals: number[] = []
      for (const m of members) {
        const a = agreement(rs, r => r.v[m], r => majority(r, members))
        if (a) vals.push(a.pct)
      }
      vals.sort((a, b) => a - b)
      return vals.length ? vals[Math.floor(vals.length / 2)] : null
    }
    const splits = cf.map((r) => {
      const c: Record<string, number> = {}
      let n = 0
      for (const m of members) { const v = r.v[m]; if (VOTE.has(v)) { c[v] = (c[v] || 0) + 1; n++ } }
      const top = Math.max(0, ...Object.values(c))
      return { id: r.id, title: r.t, date: r.d, unity: n ? Math.round((top / n) * 1000) / 10 : null, split: { yes: c.Y || 0, no: c.N || 0, abstain: c.A || 0 } }
    }).filter(x => x.unity != null).sort((a, b) => (a.unity as number) - (b.unity as number)).slice(0, 3)
    const outliers = members.map((m) => {
      const a = agreement(cf, r => r.v[m], r => majority(r, members))
      return a ? { ...country(m), pct: a.pct } : null
    }).filter(Boolean).sort((a: any, b: any) => a.pct - b.pct).slice(0, 4)
    return { gid, name: g.name, acronym: g.acronym || gid.toUpperCase(), members: members.length, cohesion: scores(cf), cohesionPrev: cp.length ? scores(cp) : null, splits, outliers }
  }).filter(Boolean)

  // countries furthest from the overall majority on contested votes, and the biggest movers
  const withMajority = (rs: Resolution[]) => {
    const out: Record<string, { pct: number; n: number }> = {}
    const iso = new Set(rs.flatMap(r => Object.keys(r.v)))
    for (const m of iso) {
      const a = agreement(rs, r => r.v[m], r => majority(r))
      if (a) out[m] = a
    }
    return out
  }
  const nowM = withMajority(cf)
  const prevM = withMajority(cp)
  const mavericks = Object.entries(nowM).filter(([, a]) => a.n >= 30).sort((a, b) => a[1].pct - b[1].pct).slice(0, 12).map(([iso3, a]) => ({ ...country(iso3), pct: a.pct, prev: prevM[iso3]?.pct ?? null }))
  const movers = Object.entries(nowM).filter(([iso3, a]) => prevM[iso3] && a.n >= 30 && prevM[iso3].n >= 30).map(([iso3, a]) => ({ ...country(iso3), pct: a.pct, prev: prevM[iso3].pct, change: Math.round((a.pct - prevM[iso3].pct) * 10) / 10 }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 10)

  // the US, China, Russia and the EU majority: with the overall majority, and with each other
  const eu: string[] = ((reg.getGroup('eu') as any)?.countries || []).map((c: any) => c.iso3)
  const actors: { id: string; label: string; vote: (r: Resolution) => string | null }[] = [
    ...BIG.map(i => ({ id: i, label: country(i).name, vote: (r: Resolution) => r.v[i] || null })),
    { id: 'EU', label: 'EU members (majority)', vote: (r: Resolution) => majority(r, eu) },
  ]
  const powers = actors.map(a => ({
    id: a.id, label: a.label, iso2: a.id === 'EU' ? 'EU' : country(a.id).iso2,
    withMajority: agreement(cf, a.vote, r => majority(r))?.pct ?? null,
    withMajorityPrev: cp.length ? agreement(cp, a.vote, r => majority(r))?.pct ?? null : null,
    pairs: actors.filter(b => b.id !== a.id).map(b => ({ id: b.id, label: b.label, pct: agreement(cf, a.vote, b.vote)?.pct ?? null })),
  }))
  // where the US and China voted differently, most recent first
  const usChina = cf.filter(r => VOTE.has(r.v.USA) && VOTE.has(r.v.CHN) && r.v.USA !== r.v.CHN).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 6)
    .map(r => ({ id: r.id, title: r.t, date: r.d, usa: r.v.USA, chn: r.v.CHN, rus: r.v.RUS || null, tally: tally(r) }))

  return {
    focus, prev: prev ?? null, latestSession: latest,
    lastVote: all.reduce((m, r) => (r.d > m ? r.d : m), ''),
    counts: { recorded: inFocus.length, contested: cf.length, recordedPrev: inPrev.length, contestedPrev: cp.length },
    newest: newest.slice(0, 6).map(r => ({ id: r.id, date: r.d, title: r.t, tally: tally(r) })),
    divided, groups, mavericks, movers, powers, usChina,
  }
}

const COMMITTEE_ORGAN: Record<string, RegExp> = {
  plenary: /^General Assembly$/i, first: /^First Committee/i, second: /^Second Committee/i, third: /^Third Committee/i,
  fourth: /^Fourth Committee|Special Political and Decolonization/i, fifth: /^Fifth Committee/i, sixth: /^Sixth Committee/i,
}

function journal() {
  return (readDataFile<any>('un-journal.json')?.meetings || []) as any[]
}

export function gaCommittees() {
  const f = readDataFile<any>('ga-assembly.json')
  const meetings = journal()
  const today = new Date().toISOString().slice(0, 10)
  const press = (f?.press || []) as any[]
  const pick = (bid: string) => press.filter(p => p.bodies.includes(bid)).slice(0, 6).map(p => ({ title: p.title, url: p.url, date: p.date }))
  const comm = (f?.committees || []).map((c: any) => {
    const ms = meetings.filter(m => m.group === 'General Assembly' && COMMITTEE_ORGAN[c.id]?.test(m.organ || '') && !m.cancelled)
    const next = ms.filter(m => m.date >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3)
    return {
      ...c, bureau: c.bureau ? { ...c.bureau, iso: countryFromName(c.bureau.country) } : null,
      next: next.map(m => ({ date: m.date, time: m.time, title: m.title, agenda: (m.agenda || []).slice(0, 3), url: m.journal_url })),
      press: pick(c.id), link: c.id === 'fifth' ? '/un-budget' : null,
    }
  })
  const plenaryNext = meetings.filter(m => m.group === 'General Assembly' && COMMITTEE_ORGAN.plenary.test(m.organ || '') && m.date >= today && !m.cancelled)
    .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4).map(m => ({ date: m.date, time: m.time, title: m.title, agenda: (m.agenda || []).slice(0, 3), url: m.journal_url }))
  return { session: f?.session ?? null, updatedAt: f?._meta?.updated_at ?? null, committees: comm, plenary: { next: plenaryNext, press: pick('plenary') } }
}

function countryFromName(name: string | null | undefined) {
  if (!name) return null
  const n = name.replace(/^Kingdom of the /, '').trim().toLowerCase()
  const c: any = (getRegistry().getAllCountries() as any[]).find((x: any) => (x.name || '').toLowerCase() === n || (x.name || '').toLowerCase().startsWith(n))
  return c ? { iso3: c.iso3, iso2: c.iso2 || null, name: c.name } : null
}

export function ecosoc() {
  const e = readDataFile<any>('un-elections.json')?.ecosoc || {}
  const L = readDataFile<any>('un-leadership.json')
  const pres = (L?.offices || []).find((o: any) => o.id === 'ecosoc')?.holder || null
  const meetings = journal()
  const today = new Date().toISOString().slice(0, 10)
  const ms = meetings.filter(m => m.group === 'Economic and Social Council' && !m.cancelled)
  const byOrgan: Record<string, number> = {}
  for (const m of ms) byOrgan[m.organ] = (byOrgan[m.organ] || 0) + 1
  const members = (e.members || []) as any[]
  const groups: Record<string, any[]> = {}
  for (const m of members) (groups[m.group || 'Other'] ||= []).push({ iso3: m.iso3, iso2: m.iso2, name: m.name, termEnd: m.term_end })
  const press = ((readDataFile<any>('ga-assembly.json')?.press || []) as any[]).filter(p => p.bodies.includes('ecosoc')).slice(0, 6)
  return {
    president: pres ? { name: pres.name, nationality: pres.nationality || pres.country?.name || null, since: pres.since || null } : null,
    year: e.year ?? null, seats: e.seats_total ?? 54, seatsByGroup: e.seats_by_group || null,
    members: groups, leaving: members.filter(m => m.term_end === (e.year ?? new Date().getFullYear())).map(m => ({ iso3: m.iso3, iso2: m.iso2, name: m.name })),
    nextElection: e.next_election || null,
    meetings: { upcoming: ms.filter(m => m.date >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6).map(m => ({ date: m.date, time: m.time, organ: m.organ, title: m.title, url: m.journal_url, location: m.location })),
      bodies: Object.entries(byOrgan).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([organ, n]) => ({ organ, n })) },
    press: press.map((p: any) => ({ title: p.title, url: p.url, date: p.date })),
  }
}
