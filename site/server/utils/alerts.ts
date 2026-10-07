import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { getUsers, getUserById } from './users'
import { getRegistry } from './wcg'
import { readDataFile } from './data-file'
import { archiveSince, newsAnalysis } from './news-analysis'
import { addNotifications } from './notifications'
import { sendEmail, SITE_URL } from './email'

/**
 * Alerts on what a user follows: elections announced or moved, official statements,
 * Security Council decisions and vetoes, a surge in news attention, the Secretary-General
 * race (new straw polls, nominations, withdrawals) and keywords. Checked every hour;
 * shown in the site's notifications and, if chosen, emailed at once or as a daily summary.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'alerts.json')

export interface AlertSettings {
  enabled: boolean
  countries: string[]            // ISO3; empty = use the countries the user follows (bookmarks)
  types: { elections: boolean; statements: boolean; unsc: boolean; attention: boolean; sg: boolean }
  keywords: string[]
  email: 'instant' | 'daily' | 'off'
  dailyHour: number              // UTC
}
interface AlertState { lastCheck?: string; elections?: Record<string, string>; sgPolls?: number; sgPollStatus?: Record<string, string>; sgNominees?: string[]; attention?: Record<string, string>; pending?: AlertItem[]; lastDaily?: string }
interface AlertItem { kind: string; title: string; body?: string; url?: string }
interface Store { settings: Record<string, AlertSettings>; state: Record<string, AlertState> }

const DEFAULT_SETTINGS: AlertSettings = { enabled: false, countries: [], types: { elections: true, statements: true, unsc: true, attention: true, sg: true }, keywords: [], email: 'daily', dailyHour: 7 }

function load(): Store {
  try {
    return existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf-8')) : { settings: {}, state: {} }
  } catch {
    return { settings: {}, state: {} }
  }
}

function save(store: Store) {
  const text = JSON.stringify(store)
  writeFileSync(FILE + '.tmp', text)
  renameSync(FILE + '.tmp', FILE)
}

const toIso3 = (code: string) => getRegistry().getCountryMembership(String(code || ''))?.iso3 || (String(code).length === 3 ? String(code).toUpperCase() : null)

export function getSettings(userId: string): AlertSettings & { followed: string[] } {
  const s = load().settings[userId] || DEFAULT_SETTINGS
  const prefs: any = getUserById(userId)?.preferences || {}
  const followed = [...new Set((prefs.bookmarkedCountries || []).map(toIso3).filter(Boolean))] as string[]
  return { ...DEFAULT_SETTINGS, ...s, types: { ...DEFAULT_SETTINGS.types, ...(s.types || {}) }, followed }
}

export function saveSettings(userId: string, b: any): AlertSettings {
  const store = load()
  const prev = store.settings[userId] || DEFAULT_SETTINGS
  const next: AlertSettings = {
    enabled: b.enabled === undefined ? prev.enabled : !!b.enabled,
    countries: Array.isArray(b.countries) ? [...new Set(b.countries.map(toIso3).filter(Boolean))].slice(0, 50) as string[] : prev.countries,
    types: { ...prev.types, ...(b.types || {}) },
    keywords: Array.isArray(b.keywords) ? b.keywords.map((k: any) => String(k).trim()).filter((k: string) => k.length >= 3).slice(0, 20) : prev.keywords,
    email: ['instant', 'daily', 'off'].includes(b.email) ? b.email : prev.email,
    dailyHour: Number.isFinite(Number(b.dailyHour)) ? Math.min(23, Math.max(0, Math.floor(Number(b.dailyHour)))) : prev.dailyHour,
  }
  store.settings[userId] = next
  if (!store.state[userId]) store.state[userId] = {}
  save(store)
  return next
}

export function deleteUserAlerts(userId: string) { const s = load(); delete s.settings[userId]; delete s.state[userId]; save(s) }

const name = (iso3: string) => getRegistry().getCountryMembership(iso3)?.name || iso3
const fmt = (d: string) => new Date(d.length === 10 ? d + 'T12:00:00Z' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Find what's new for one user since their last check (and update their state). */
function collect(userId: string, cfg: AlertSettings & { followed: string[] }, st: AlertState): AlertItem[] {
  const out: AlertItem[] = []
  const countries = cfg.countries.length ? cfg.countries : cfg.followed
  const since = st.lastCheck || new Date().toISOString()
  const first = !st.lastCheck

  if (cfg.types.elections && countries.length) {
    const els = (readDataFile<any>('elections.json')?.elections || []).filter((e: any) => countries.includes(e.iso3) && e.status === 'upcoming')
    const seen = st.elections || {}
    for (const e of els) {
      const key = `${e.iso3}:${e.description}`
      if (!first && seen[key] !== e.date) {
        out.push({ kind: 'election', title: seen[key] ? `${name(e.iso3)}: election date changed to ${fmt(e.date)}` : `${name(e.iso3)}: ${e.description} election on ${e.precision === 'day' ? fmt(e.date) : e.date}`, url: '/elections?tab=national' })
      }
      seen[key] = e.date
    }
    st.elections = seen
  }

  if (cfg.types.statements && countries.length && !first) {
    const rows = archiveSince(since, { iso3s: countries, kind: 'statement', limit: 300 })
    const by = new Map<string, any[]>()
    for (const r of rows) { if (!by.has(r.matched)) by.set(r.matched, []); by.get(r.matched)!.push(r) }
    for (const [iso3, list] of by) {
      const uniq = [...new Map(list.map(r => [r.id, r])).values()]
      out.push({ kind: 'statements', title: `${uniq.length} new official ${uniq.length === 1 ? 'statement' : 'statements'} on ${name(iso3)}`, body: uniq.slice(0, 3).map(r => `• ${r.title}`).join('\n'), url: uniq.length === 1 ? uniq[0].url : `/news?country=${iso3}&kind=statement` })
    }
  }

  if (cfg.types.unsc && !first) {
    const day = since.slice(0, 10)
    const votes = (readDataFile<any>('unsc-votes.json')?.resolutions || []).filter((r: any) => (r.date || '') >= day)
    const vetoes = (readDataFile<any>('unsc-vetoes.json')?.vetoes || []).filter((v: any) => (v.date || '') >= day)
    const names = countries.map(c => [c, name(c)])
    for (const r of votes) {
      const hit = names.find(([, n]) => n && (r.title || '').toLowerCase().includes(n.toLowerCase().split(',')[0]))
      if (hit || !countries.length) out.push({ kind: 'unsc', title: `Security Council resolution ${r.id}: ${r.title}`, url: '/un' })
    }
    for (const v of vetoes) out.push({ kind: 'unsc', title: `Veto in the Security Council (${(v.vetoed_by || []).join(', ')}): ${v.subject}`, url: '/un' })
  }

  if (cfg.types.attention && countries.length) {
    try {
      const a: any = newsAnalysis({})
      const last = st.attention || {}
      for (const c of a.rising || []) {
        if (!countries.includes(c.iso3) || c.ratio < 3 || c.recent < 5) continue
        if (last[c.iso3] && Date.now() - new Date(last[c.iso3]).getTime() < 3 * 86400_000) continue
        if (!first) out.push({ kind: 'attention', title: `${c.name} is drawing unusual attention: ${Math.round(c.recent)} articles a day, ×${c.ratio.toFixed(1)} its usual level`, url: `/news?country=${c.iso3}` })
        last[c.iso3] = new Date().toISOString()
      }
      st.attention = last
    } catch {}
  }

  if (cfg.types.sg) {
    const sg = readDataFile<any>('sg-selection.json')
    const polls = sg?.process?.straw_polls || []
    const nominees = (sg?.candidates || []).map((c: any) => `${c.name}:${c.status}`)
    // one alert when a straw poll is announced, another when its (leaked) results are published
    const prevStatus = st.sgPollStatus || (st.sgPolls !== undefined ? Object.fromEntries(polls.slice(0, st.sgPolls).map((p: any) => [String(p.n), p.results?.length ? 'results' : 'held'])) : null)
    if (!first && prevStatus) {
      for (const p of polls) {
        const was = prevStatus[String(p.n)]
        const has = p.results?.length > 0
        if (has && was !== 'results') {
          const top = [...p.results].sort((a: any, b: any) => (b.encourage || 0) - (a.encourage || 0)).slice(0, 4)
          out.push({ kind: 'sg', title: `Secretary-General race: results of straw poll ${p.n} (${fmt(p.date)})`, body: top.map((r: any) => `• ${r.candidate}: ${r.encourage} encouraged, ${r.discourage} discouraged, ${r.no_opinion ?? 0} no opinion`).join('\n'), url: '/elections' })
        } else if (!has && !was) {
          out.push({ kind: 'sg', title: p.status === 'expected' ? `Secretary-General race: straw poll ${p.n} expected on ${fmt(p.date)}` : `Secretary-General race: straw poll ${p.n} held on ${fmt(p.date)}; results not yet public`, body: p.colour_coded ? 'Colour-coded ballots: permanent members\' votes will be distinguishable.' : undefined, url: '/elections' })
        }
      }
    }
    st.sgPollStatus = Object.fromEntries(polls.map((p: any) => [String(p.n), p.results?.length ? 'results' : (p.status || 'held')]))
    if (!first && st.sgNominees) {
      for (const n of nominees) if (!st.sgNominees.includes(n)) {
        const [nm, status] = n.split(':')
        out.push({ kind: 'sg', title: status === 'withdrawn' ? `Secretary-General race: ${nm} withdrew` : `Secretary-General race: ${nm} is now a candidate`, url: '/elections' })
      }
    }
    st.sgPolls = polls.length
    st.sgNominees = nominees
  }

  if (cfg.keywords.length && !first) {
    for (const k of cfg.keywords) {
      const rows = archiveSince(since, { words: [k], limit: 20 })
      if (rows.length) out.push({ kind: 'keyword', title: `“${k}”: ${rows.length} new ${rows.length === 1 ? 'item' : 'items'}`, body: rows.slice(0, 3).map(r => `• ${r.title} (${r.outlet})`).join('\n'), url: `/news?q=${encodeURIComponent(k)}` })
    }
  }
  st.lastCheck = new Date().toISOString()
  return out
}

function emailBody(items: AlertItem[], intro: string) {
  return `${intro}\n\n` + items.map(i => `${i.title}${i.body ? '\n' + i.body : ''}${i.url ? '\n' + (i.url.startsWith('/') ? SITE_URL + i.url : i.url) : ''}`).join('\n\n') +
    `\n\n—\nAlerts from World Country Groups. Change them on your account page: ${SITE_URL}/account`
}

/** Hourly run for every user with alerts switched on. */
export async function runAlerts(): Promise<{ users: number; alerts: number; emails: number }> {
  const store = load()
  let alerts = 0, emails = 0, users = 0
  const now = new Date()
  for (const u of getUsers()) {
    const raw = store.settings[u.id]
    if (!raw?.enabled || u.status !== 'approved') continue
    users++
    const cfg = getSettings(u.id)
    const st = store.state[u.id] || (store.state[u.id] = {})
    const items = collect(u.id, cfg, st)
    if (items.length) {
      alerts += items.length
      addNotifications(u.id, items.map(i => ({ kind: `alert:${i.kind}`, title: i.title, body: i.body, url: i.url })))
      if (cfg.email === 'instant' && u.email) {
        const r = await sendEmail(u.email, items.length === 1 ? `Alert: ${items[0].title}` : `${items.length} new alerts`, emailBody(items, 'New on what you follow:'))
        if (r.ok) emails++
      } else if (cfg.email === 'daily') {
        st.pending = [...(st.pending || []), ...items].slice(-100)
      }
    }
    if (cfg.email === 'daily' && u.email && now.getUTCHours() === cfg.dailyHour && st.lastDaily?.slice(0, 10) !== now.toISOString().slice(0, 10)) {
      if (st.pending?.length) {
        const r = await sendEmail(u.email, `Your daily alerts: ${st.pending.length} ${st.pending.length === 1 ? 'item' : 'items'}`, emailBody(st.pending, 'Since yesterday, on what you follow:'))
        if (r.ok) { emails++; st.pending = [] }
      }
      st.lastDaily = now.toISOString()
    }
  }
  save(store)
  return { users, alerts, emails }
}
