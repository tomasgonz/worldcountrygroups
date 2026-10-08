import { readDataFile } from './data-file'
import { getRegistry } from './wcg'
import { getUserPreferences, updateUserPreferences } from './users'
import { archiveSearch, archiveForCountries, archiveCounts } from './news-analysis'
import { getRecentResolutions } from './unvotes'
import { getElections } from './upcoming'
import { sgOffice } from './sg-office'
import { countryBudget } from './un-budget'
import { leadership } from './un-leadership'
import { gaVotes } from './ga-assembly'

/**
 * Watchlists: what is new about the countries, groups, UN offices and topics a user follows.
 * Countries and groups are the user's bookmarks; offices and topics are extra preferences.
 * The same content feeds the watchlist page and the email digest.
 */
export interface WatchSet { countries: string[]; groups: string[]; offices: string[]; topics: string[] }

export function getWatchSet(userId: string): WatchSet {
  const p: any = getUserPreferences(userId) || {}
  const reg = getRegistry()
  const iso = (c: string) => (reg.getCountryMembership(c) as any)?.iso3 || (c.length === 3 ? c.toUpperCase() : null)
  return {
    countries: [...new Set((p.bookmarkedCountries || []).map(iso).filter(Boolean))] as string[],
    groups: [...new Set((p.bookmarkedGroups || []) as string[])],
    offices: [...new Set((p.watchOffices || []) as string[])],
    topics: [...new Set((p.watchTopics || []) as string[])],
  }
}

export function setWatchExtras(userId: string, b: { offices?: string[]; topics?: string[] }) {
  const p: any = { ...(getUserPreferences(userId) || { bookmarkedCountries: [], bookmarkedGroups: [] }) }
  if (Array.isArray(b.offices)) p.watchOffices = [...new Set(b.offices.map(String))].slice(0, 30)
  if (Array.isArray(b.topics)) p.watchTopics = [...new Set(b.topics.map(t => String(t).trim()).filter(t => t.length >= 3 && t.length <= 60))].slice(0, 20)
  updateUserPreferences(userId, p)
  return getWatchSet(userId)
}

const VOTE: Record<string, string> = { Y: 'yes', N: 'no', A: 'abstained', X: 'absent' }

function country(iso3: string) {
  const m: any = getRegistry().getCountryMembership(iso3)
  return { iso3, name: m?.name || iso3, iso2: m?.iso2 || null }
}

function majority(v: Record<string, string>) {
  const c: Record<string, number> = {}
  for (const x of Object.values(v)) if (x === 'Y' || x === 'N' || x === 'A') c[x] = (c[x] || 0) + 1
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

function countryNews(iso3: string, since: string, limit = 4) {
  const from = since.slice(0, 10)
  const counts = archiveCounts(iso3, from)
  const pick = (l: any[]) => l.slice(0, limit).map(i => ({ title: i.title, url: i.url, outlet: i.outlet, date: i.publishedAt }))
  const news = archiveSearch({ iso3, from, kind: 'news', limit }) as any[]
  const statements = archiveSearch({ iso3, from, kind: 'statement', limit }) as any[]
  return { newsCount: counts.news, statementCount: counts.statement, news: pick(news), statements: pick(statements) }
}

export function countryItem(iso3: string, since: string) {
  const c = country(iso3)
  const ga = getRecentResolutions(2).filter(r => r.d >= since.slice(0, 10) && r.v[iso3])
    .sort((a, b) => b.d.localeCompare(a.d))
    .map((r) => { const m = majority(r.v); return { id: r.id, date: r.d, title: r.t.replace(/\s*:\s*resolution.*$/i, ''), vote: VOTE[r.v[iso3]] || r.v[iso3], againstMajority: !!m && r.v[iso3] !== m && r.v[iso3] !== 'X', url: `https://digitallibrary.un.org/record/${r.id}` } })
  const sc = ((readDataFile<any>('unsc-votes.json')?.resolutions || []) as any[]).filter(r => r.date >= since.slice(0, 10) && r.votes?.[iso3])
    .map(r => ({ id: r.id, date: r.date, title: r.title, vote: VOTE[r.votes[iso3]] || r.votes[iso3], adopted: r.adopted }))
  const sg = sgOffice({ country: iso3, statements: 20, appointments: 20 })
  const appointments = (sg?.appointments || []).filter((a: any) => a.date >= since).map((a: any) => ({ person: a.person, post: a.post, date: a.date, url: a.url, kind: a.nationality === iso3 ? 'national' : 'posted here' }))
  const sgStatements = (sg?.statements || []).filter((s: any) => s.date >= since).slice(0, 4).map((s: any) => ({ title: s.title, url: s.url, date: s.date }))
  const quotes = ((readDataFile<any>('quotes-said.json')?.quotes || []) as any[]).filter(q => q.iso3 === iso3 && q.date >= since.slice(0, 10)).slice(0, 3).map(q => ({ q: q.q, speaker: q.speaker, date: q.date, url: q.url }))
  const budget: any = countryBudget(iso3)
  const fifth = (budget?.statements || []).filter((s: any) => (s.date || '') >= since.slice(0, 10)).map((s: any) => ({ topic: s.topic, date: s.date, url: s.url, onBehalfOf: s.onBehalfOf }))
  const elections = getElections({ iso3, status: 'upcoming', withinDays: 90 }).filter((e: any) => !e.indirect).slice(0, 2).map((e: any) => ({ date: e.date, type: e.type, precision: e.precision }))
  const news = countryNews(iso3, since)
  const items = ga.length + sc.length + appointments.length + sgStatements.length + quotes.length + fifth.length + news.newsCount + news.statementCount
  return { kind: 'country', id: iso3, ...c, total: items, ga, sc, appointments, sgStatements, quotes, fifth, elections, ...news,
    dues: budget?.pct != null ? { pct: budget.pct, paid: budget.paid, paidDate: budget.paidDate, article19: budget.article19 } : null }
}

function groupItem(gid: string, since: string) {
  const g: any = getRegistry().getGroup(gid)
  if (!g) return null
  const isos: string[] = g.countries.map((c: any) => c.iso3).filter(Boolean)
  const v = gaVotes()
  const coh = v?.groups.find((x: any) => x.gid === gid) || null
  const news = archiveForCountries(isos, Math.max(1, Math.round((Date.now() - new Date(since).getTime()) / 86400_000)), 5)
  const nameHits = (archiveSearch({ words: [g.acronym && g.acronym.length > 2 ? g.acronym : g.name], from: since.slice(0, 10), limit: 5 }) as any[])
    .map(i => ({ title: i.title, url: i.url, outlet: i.outlet, date: i.publishedAt }))
  const elections = getElections({ status: 'upcoming', withinDays: 45 }).filter((e: any) => e.iso3 && isos.includes(e.iso3) && !e.indirect).slice(0, 5)
    .map((e: any) => ({ date: e.date, country: e.country, iso3: e.iso3, type: e.type }))
  return { kind: 'group', id: gid, name: g.name, acronym: g.acronym || '', members: isos.length,
    cohesion: coh ? { session: v.focus, pct: coh.cohesion, prev: coh.cohesionPrev, apart: coh.outliers.slice(0, 3).map((o: any) => o.name) } : null,
    mentions: nameHits, membersInNews: news ? news.byCountry.slice(0, 5).map((c: any) => ({ ...country(c.iso3), n: c.n })) : [], newsTotal: news?.total || 0, elections,
    total: nameHits.length + elections.length }
}

function officeItem(id: string, since: string) {
  const o = (leadership()?.offices || []).find((x: any) => x.id === id)
  if (!o) return null
  const st = (o.statements || []).filter((s: any) => s.date >= since)
  return { kind: 'office', id, name: o.label, short: o.short, holder: o.holder ? { name: o.holder.name, acting: !!o.holder.acting } : null, note: o.note || null,
    statements: st.slice(0, 5).map((s: any) => ({ title: s.title, url: s.url, date: s.date })), total: st.length }
}

function topicItem(topic: string, since: string) {
  const words = topic.split(/\s+/).filter(w => w.length > 2).slice(0, 4)
  const hits = archiveSearch({ words, from: since.slice(0, 10), limit: 30 }) as any[]
  return { kind: 'topic', id: topic, name: topic, total: hits.length, statements: hits.filter(h => h.kind === 'statement').length,
    items: hits.slice(0, 6).map(i => ({ title: i.title, url: i.url, outlet: i.outlet, date: i.publishedAt, kind: i.kind })) }
}

/** Everything new for a user's watchlist over the last `days` days. */
export function watchFeed(userId: string, days = 7) {
  const set = getWatchSet(userId)
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const countries = set.countries.slice(0, 25).map(c => countryItem(c, since))
  const groups = set.groups.slice(0, 15).map(g => groupItem(g, since)).filter(Boolean)
  const offices = set.offices.map(o => officeItem(o, since)).filter(Boolean)
  const topics = set.topics.map(t => topicItem(t, since))
  return { days, since, set, countries, groups, offices, topics,
    offices_available: (leadership()?.offices || []).map((o: any) => ({ id: o.id, short: o.short, label: o.label, holder: o.holder?.name || null })) }
}

/** Plain-text digest of the feed, for email. Returns null when nothing is new. */
export function watchDigestText(userId: string, days: number, siteUrl: string): string | null {
  const f = watchFeed(userId, days)
  const lines: string[] = []
  const d = (s: string) => new Date(s.length === 10 ? s + 'T12:00:00Z' : s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  for (const c of f.countries) {
    if (!c.total && !c.elections.length) continue
    lines.push(`\n${c.name.toUpperCase()}`)
    for (const v of c.ga.slice(0, 5)) lines.push(`• General Assembly, ${d(v.date)}: voted ${v.vote}${v.againstMajority ? ' (against the majority)' : ''} on ${v.title}`)
    for (const v of c.sc.slice(0, 3)) lines.push(`• Security Council, ${d(v.date)}: voted ${v.vote} on ${v.id} (${v.title})`)
    for (const a of c.appointments) lines.push(`• Appointed (${a.kind}): ${a.person}, ${a.post}`)
    for (const s of c.fifth.slice(0, 2)) lines.push(`• Fifth Committee statement: ${s.topic || 'statement'}${s.onBehalfOf ? ` (for ${s.onBehalfOf})` : ''}`)
    for (const q of c.quotes) lines.push(`• “${q.q}” (${q.speaker})`)
    for (const s of c.sgStatements.slice(0, 2)) lines.push(`• Secretary-General: ${s.title}`)
    if (c.newsCount || c.statementCount) lines.push(`• ${c.newsCount} news items and ${c.statementCount} official statements. Latest: ${(c.statements[0] || c.news[0])?.title || ''}`)
    for (const e of c.elections) lines.push(`• Election ahead: ${e.type}, ${e.precision === 'day' ? d(e.date) : e.date}`)
  }
  for (const g of f.groups as any[]) {
    if (!g.total && !g.newsTotal) continue
    lines.push(`\n${(g.acronym || g.name).toUpperCase()}`)
    if (g.cohesion) lines.push(`• Voting cohesion (session ${g.cohesion.session}): ${Math.round(g.cohesion.pct)}%${g.cohesion.apart.length ? `; most often apart: ${g.cohesion.apart.join(', ')}` : ''}`)
    for (const m of g.mentions.slice(0, 3)) lines.push(`• ${m.title} (${m.outlet})`)
    for (const e of g.elections) lines.push(`• Election ahead in ${e.country}: ${e.type}, ${d(e.date)}`)
  }
  for (const o of f.offices as any[]) {
    if (!o.total) continue
    lines.push(`\n${o.short}${o.holder ? ` (${o.holder.name})` : ''}`)
    for (const s of o.statements.slice(0, 4)) lines.push(`• ${s.title}`)
  }
  for (const t of f.topics) {
    if (!t.total) continue
    lines.push(`\n“${t.name}”: ${t.total} items`)
    for (const i of t.items.slice(0, 4)) lines.push(`• ${i.title} (${i.outlet})`)
  }
  if (!lines.length) return null
  return `What's new on your watchlist, last ${days === 1 ? '24 hours' : `${days} days`}:\n${lines.join('\n')}\n\nSee it all, with links: ${siteUrl}/dashboard`
}

// ---------------------------------------------------------------- email digest
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { getUsers } from './users'
import { sendEmail, SITE_URL } from './email'

const STATE = join(process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data'), 'watch-digest-state.json')
function loadState(): Record<string, { lastSent?: string; lastError?: string | null }> {
  try {
    return existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf-8')) : {}
  } catch {
    return {}
  }
}
function saveState(s: Record<string, any>) {
  writeFileSync(STATE + '.tmp', JSON.stringify(s, null, 1))
  renameSync(STATE + '.tmp', STATE)
}

/** Hourly: send each due digest (daily, or weekly on the user's setting) at 07:00 UTC or later. */
export async function runWatchDigests(o: { force?: boolean; userId?: string } = {}) {
  const st = loadState()
  const now = Date.now()
  const report: Record<string, string> = {}
  for (const u of getUsers()) {
    if (o.userId && u.id !== o.userId) continue
    const freq = (u.preferences as any)?.emailDigest || 'off'
    if (!o.force && (freq === 'off' || u.status !== 'approved')) continue
    if (!u.email) { report[u.username] = 'no email address'; continue }
    const last = st[u.id]?.lastSent ? new Date(st[u.id].lastSent!).getTime() : 0
    const due = freq === 'daily' ? now - last > 20 * 3600_000 : now - last > 6.5 * 86400_000
    if (!o.force && (!due || new Date().getUTCHours() < 7)) { report[u.username] = 'not due'; continue }
    const days = freq === 'daily' ? 1 : 7
    const text = watchDigestText(u.id, days, SITE_URL)
    if (!text) { st[u.id] = { lastSent: new Date().toISOString(), lastError: null }; report[u.username] = 'nothing new'; continue }
    const r = await sendEmail(u.email, `Your watchlist: ${days === 1 ? 'today' : 'this week'}`, text + `\n\n—\nWorld Country Groups. Change what you follow or stop these emails: ${SITE_URL}/dashboard`)
    st[u.id] = { lastSent: r.ok ? new Date().toISOString() : st[u.id]?.lastSent, lastError: r.ok ? null : r.error || 'failed' }
    report[u.username] = r.ok ? 'sent' : `failed: ${r.error}`
  }
  saveState(st)
  return report
}
