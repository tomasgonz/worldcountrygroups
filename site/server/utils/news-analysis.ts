import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import { readDataFile, dataFileMtime } from './data-file'
import { getRegistry } from './wcg'

/**
 * Analysis of the news and statements feeds for the News page:
 * stories (articles about the same event grouped across outlets), countries whose
 * coverage is rising, topic momentum, regional attention and the mix of sources.
 * Results are cached until either feed file changes.
 */

export interface NewsItem {
  id: string
  title: string
  summary: string
  url: string
  kind: 'news' | 'statement'
  source: string        // feed source id
  outlet: string        // publication or office shown to readers
  ownership: string | null
  sourceType: string
  publishedAt: string
  countries: string[]
  topics: string[]
}

export interface Story {
  id: string
  headline: string
  url: string
  outlets: number
  items: number
  officialItems: number
  stateMediaItems: number
  countries: string[]
  topics: string[]
  firstSeen: string
  latest: string
  hourly: number[]      // items per 6-hour bucket over the story window, oldest first
  score: number
  coverage: NewsItem[]
}

// ---------- topics ----------
export const TOPICS: { id: string; label: string; re: RegExp }[] = [
  { id: 'conflict', label: 'Conflict & security', re: /\b(war|wars|attack|attacks|airstrikes?|strikes? on|missiles?|troops|ceasefire|truce|military|drones?|shelling|clashes|insurgen\w*|militants?|terror\w*|hostages?|offensive|army|armed group|peacekeep\w*|invasion|bombing)\b/i },
  { id: 'diplomacy', label: 'Diplomacy', re: /\b(talks|summit|state visit|official visit|visits?|meets|met with|bilateral|foreign ministers?|envoys?|ambassadors?|diplomat\w*|negotiat\w*|accord|memorandum|counterpart|joint statement)\b/i },
  { id: 'politics', label: 'Elections & politics', re: /\b(elections?|electoral|votes?|voters|polls?|parliament\w*|coalition|opposition|coup|protests?|protesters|cabinet|impeach\w*|referendum|constitution\w*|prime minister|president\w*)\b/i },
  { id: 'economy', label: 'Economy & trade', re: /\b(trade|tariffs?|econom\w*|inflation|gdp|investments?|debt|imf|world bank|exports?|imports?|budget|currency|markets?|growth|recession|bonds?|loans?|finance|financing|fiscal)\b/i },
  { id: 'humanitarian', label: 'Humanitarian', re: /\b(humanitarian|refugees?|displaced|famine|hunger|food insecurity|cholera|relief|aid convoy|evacuat\w*|casualties|civilians)\b/i },
  { id: 'climate', label: 'Climate & environment', re: /\b(climate|emissions|floods?|flooding|droughts?|heatwaves?|cyclones?|hurricanes?|typhoons?|wildfires?|cop\s?3\d|biodiversity|deforestation|earthquakes?)\b/i },
  { id: 'rights', label: 'Rights & justice', re: /\b(human rights|rights|courts?|icc|icj|trial|sentenced|convicted|journalists?|detention|detained|torture|executions?|freedom of|tribunal|genocide|war crimes)\b/i },
  { id: 'energy', label: 'Energy', re: /\b(oil|gas|lng|energy|electricity|power plant|opec|renewables?|solar|pipeline|nuclear power|grid)\b/i },
  { id: 'health', label: 'Health', re: /\b(health|disease|outbreaks?|vaccines?|ebola|mpox|malaria|pandemic|hospitals?|world health organi[sz]ation)\b/i },
  { id: 'migration', label: 'Migration', re: /\b(migrants?|migration|asylum|deport\w*|border crossings?|smuggling)\b/i },
  { id: 'tech', label: 'Technology & cyber', re: /\b(artificial intelligence|ai|cyber\w*|semiconductors?|chipmakers?|technology|satellites?|space agency|spacecraft)\b/i },
  { id: 'sanctions', label: 'Sanctions', re: /\b(sanctions?|embargo|asset freeze|blacklist\w*)\b/i },
  { id: 'multilateral', label: 'UN & multilateral', re: /\b(united nations|security council|general assembly|unga|\bun\b|g20|g7|brics|nato|african union|asean|european union|\beu\b|wto|unhcr|unicef|osce)\b/i },
]
const TOPIC_LABEL = Object.fromEntries(TOPICS.map(t => [t.id, t.label]))
export const topicLabel = (id: string) => TOPIC_LABEL[id] || id

function classify(text: string): string[] {
  return TOPICS.filter(t => t.re.test(text)).map(t => t.id).slice(0, 4)
}

// Outlets whose ownership matters to readers (by publication name as Google News reports it)
const OUTLET_OWNERSHIP: Record<string, string> = {
  'xinhua': 'state-run (China)', 'global times': 'state-run (China)', 'cgtn': 'state-run (China)', 'china daily': 'state-run (China)',
  "people's daily": 'state-run (China)', 'tass': 'state-run (Russia)', 'rt': 'state-run (Russia)', 'sputnik': 'state-run (Russia)',
  'ria novosti': 'state-run (Russia)', 'presstv': 'state-run (Iran)', 'press tv': 'state-run (Iran)', 'irna': 'state-run (Iran)',
  'tehran times': 'state-affiliated (Iran)', 'anadolu agency': 'state-run (Türkiye)', 'trt world': 'state-run (Türkiye)',
  'al jazeera': 'state-funded (Qatar)', 'saudi press agency': 'state-run (Saudi Arabia)', 'wam': 'state-run (UAE)',
  'kcna': 'state-run (North Korea)', 'vietnamplus': 'state-run (Viet Nam)', 'bernama': 'state-owned (Malaysia)',
  'antara news': 'state-owned (Indonesia)', 'philippine news agency': 'state-run (Philippines)', 'ahram online': 'state-owned (Egypt)',
  'voice of america': 'US government-funded', 'radio free europe/radio liberty': 'US government-funded', 'france 24': 'public broadcaster (France)',
  'dw': 'publicly funded (Germany)', 'bbc': 'public broadcaster (UK)', 'nhk world': 'public broadcaster (Japan)', 'yonhap news agency': 'publicly funded (South Korea)',
}

// ---------- load and normalise ----------
const asList = (v: any): string[] => {
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v.startsWith('[')) { try { return JSON.parse(v.replace(/'/g, '"')) } catch { return [] } }
  return []
}
const cleanText = (s: string) => (s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, '’').replace(/\s+/g, ' ').trim()
const tidySource = (id: string) => id.replace(/^(gnews|country|region)-/, '').replace(/-/g, ' ').replace(/\b(un|eu|mfa|ohchr|ocha|icj|icc|pga|who|wfp|unhcr|unicef|bbc|dw|osce|oic|sco|adb)\b/gi, m => m.toUpperCase()).replace(/^\w/, c => c.toUpperCase())

let cache: { key: string; items: NewsItem[] } | null = null

export function loadItems(): NewsItem[] {
  const key = `${dataFileMtime('news-feed.json')}|${dataFileMtime('statements-feed.json')}|${dataFileMtime('news-config.json')}`
  if (cache?.key === key) return cache.items
  const names: Record<string, { name: string; ownership?: string }> = {}
  for (const f of ['news-config.json', 'statements-config.json']) {
    for (const s of readDataFile<any>(f)?.sources || []) names[s.id] = { name: String(s.name || s.id).replace(/ \(via Google News\)$/, ''), ownership: s.ownership }
  }
  const out: NewsItem[] = []
  const seen = new Set<string>()
  const add = (x: any, kind: 'news' | 'statement') => {
    const title = cleanText(x.title)
    if (!title || !x.publishedAt) return
    const k = (x.url || '') + '|' + title.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    let summary = cleanText(x.description || x.excerpt || '')
    if (summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) summary = ''
    const meta = names[x.source] || { name: tidySource(x.source || '') }
    const searchSource = /^(country|region|coverage)-|^gnews-/.test(x.source || '') || meta.name.endsWith('news')
    const outlet = cleanText(x.outlet || '') || (searchSource ? meta.name : meta.name)
    const ownership = x.sourceOwnership || OUTLET_OWNERSHIP[outlet.toLowerCase()] || meta.ownership || null
    const topics = classify(`${title} ${summary}`)
    out.push({
      id: x.id || k, title, summary: summary.slice(0, 280), url: x.url, kind, source: x.source, outlet, ownership,
      sourceType: kind === 'statement' ? (x.sourceType || 'official') : (x.sourceType || 'news'),
      publishedAt: x.publishedAt, countries: asList(x.countries).concat(x.country && !asList(x.countries).includes(x.country) ? [x.country] : []),
      topics,
    })
  }
  for (const a of readDataFile<any>('news-feed.json')?.articles || []) add(a, 'news')
  for (const s of readDataFile<any>('statements-feed.json')?.statements || []) if (s.source !== 'un-webtv-schedule') add(s, 'statement')
  out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  cache = { key, items: out }
  try { updateHistory(out) } catch {}
  analysisCache.clear()
  return out
}

// ---------- daily history ----------
// The feed only keeps the most recent items, so daily counts are kept separately and
// merged by taking the larger value per day: counts grow as items arrive and are not
// lost when old items leave the feed.
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const HISTORY = join(DATA_DIR, 'news-history.json')
interface DayCounts { total: number; countries: Record<string, number>; topics: Record<string, number> }
interface History { startedAt: string; days: Record<string, DayCounts> }

function readHistory(): History {
  try { if (existsSync(HISTORY)) return JSON.parse(readFileSync(HISTORY, 'utf-8')) } catch {}
  return { startedAt: new Date().toISOString().slice(0, 10), days: {} }
}

function updateHistory(items: NewsItem[]) {
  const h = readHistory()
  const fresh: Record<string, DayCounts> = {}
  for (const i of items) {
    if (i.kind !== 'news') continue
    const d = i.publishedAt.slice(0, 10)
    const e = (fresh[d] ||= { total: 0, countries: {}, topics: {} })
    e.total++
    for (const c of i.countries) e.countries[c] = (e.countries[c] || 0) + 1
    for (const t of i.topics) e.topics[t] = (e.topics[t] || 0) + 1
  }
  for (const [d, e] of Object.entries(fresh)) {
    const o = (h.days[d] ||= { total: 0, countries: {}, topics: {} })
    o.total = Math.max(o.total, e.total)
    for (const [k, v] of Object.entries(e.countries)) o.countries[k] = Math.max(o.countries[k] || 0, v)
    for (const [k, v] of Object.entries(e.topics)) o.topics[k] = Math.max(o.topics[k] || 0, v)
  }
  const earliest = Object.keys(h.days).sort()[0]
  if (earliest && earliest < h.startedAt) h.startedAt = earliest
  const cutoff = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10)
  for (const d of Object.keys(h.days)) if (d < cutoff) delete h.days[d]
  writeFileSync(HISTORY + '.tmp', JSON.stringify(h))
  renameSync(HISTORY + '.tmp', HISTORY)
}

// ---------- story clustering ----------
const STOP = new Set(('the a an and or of to in on for with by at from as is are was were be been this that these those it its their our we you they he she his her ' +
  'after before over under amid says said say new news live update updates latest report reports first more than into about against during will would could ' +
  'not no can may also how why what who when where which today week year years day days one two three four five six seven eight nine ten us vs via ' +
  'statement press release remarks minister ministers president government official officials meeting meets visit talks').split(' '))

function tokens(title: string): Set<string> {
  const out = new Set<string>()
  for (let w of title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) || []) {
    if (w.length < 3 || STOP.has(w)) continue
    if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
    out.add(w)
  }
  return out
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0
  for (const x of a) if (b.has(x)) n++
  return n
}

const analysisCache = new Map<string, any>()

export interface AnalysisFilters { days?: number; country?: string; topic?: string; region?: string; q?: string; kind?: 'news' | 'statement' | 'all' }

function regionMap(): Record<string, string> {
  const stats = readDataFile<any>('country-stats.json') || {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries<any>(stats)) if (k !== '_meta' && v?.iso3 && v.region) out[v.iso3] = v.region
  return out
}

function filtered(items: NewsItem[], f: AnalysisFilters, regions: Record<string, string>) {
  const q = (f.q || '').toLowerCase().trim()
  return items.filter(i =>
    (!f.country || i.countries.includes(f.country)) &&
    (!f.topic || i.topics.includes(f.topic)) &&
    (!f.region || i.countries.some(c => regions[c] === f.region)) &&
    (!f.kind || f.kind === 'all' || i.kind === f.kind) &&
    (!q || `${i.title} ${i.summary} ${i.outlet}`.toLowerCase().includes(q)))
}

export function buildStories(items: NewsItem[], hours: number): Story[] {
  const now = Date.now()
  const cut = new Date(now - hours * 3600_000).toISOString()
  const pool = items.filter(i => i.publishedAt >= cut && i.publishedAt <= new Date(now + 3600_000).toISOString())
  type C = { tok: Set<string>; countries: Set<string>; members: NewsItem[] }
  const clusters: C[] = []
  for (const it of pool) {
    const t = tokens(it.title)
    if (t.size < 2) continue
    let best: C | null = null
    let bestScore = 0
    for (const c of clusters) {
      const ov = overlap(t, c.tok)
      if (ov < 2) continue
      const coeff = ov / Math.min(t.size, c.tok.size)
      const sharedCountry = it.countries.some(x => c.countries.has(x))
      const ok = (ov >= 3 && coeff >= 0.45) || (ov >= 2 && coeff >= 0.6 && sharedCountry)
      if (ok && coeff + (sharedCountry ? 0.2 : 0) > bestScore) { best = c; bestScore = coeff + (sharedCountry ? 0.2 : 0) }
    }
    if (best) {
      best.members.push(it)
      if (best.members.length <= 4) for (const x of t) best.tok.add(x)
      for (const c of it.countries) best.countries.add(c)
    } else {
      clusters.push({ tok: new Set(t), countries: new Set(it.countries), members: [it] })
    }
  }
  const buckets = Math.max(1, Math.ceil(hours / 6))
  const stories: Story[] = clusters.map((c) => {
    const m = c.members
    const outlets = new Set(m.map(x => x.outlet.toLowerCase()))
    const latest = m.reduce((a, x) => (x.publishedAt > a ? x.publishedAt : a), '')
    const first = m.reduce((a, x) => (x.publishedAt < a ? x.publishedAt : a), latest)
    // headline: prefer an official or wire item that shares the most words with the rest
    const rank = (x: NewsItem) => overlap(tokens(x.title), c.tok) + (x.kind === 'statement' ? 1 : 0) + (['wire', 'official'].includes(x.sourceType) ? 0.5 : 0)
    const head = [...m].sort((a, b) => rank(b) - rank(a))[0]
    const countryCount = new Map<string, number>()
    for (const x of m) for (const k of x.countries) countryCount.set(k, (countryCount.get(k) || 0) + 1)
    const topicCount = new Map<string, number>()
    for (const x of m) for (const k of x.topics) topicCount.set(k, (topicCount.get(k) || 0) + 1)
    const hourly = new Array(buckets).fill(0)
    for (const x of m) {
      const ago = (now - new Date(x.publishedAt).getTime()) / 3600_000
      const b = buckets - 1 - Math.min(buckets - 1, Math.max(0, Math.floor(ago / 6)))
      hourly[b]++
    }
    const ageH = (now - new Date(latest).getTime()) / 3600_000
    const score = (outlets.size + 0.5 * m.filter(x => x.kind === 'statement').length) * Math.exp(-ageH / 36)
    return {
      id: head.id, headline: head.title, url: head.url, outlets: outlets.size, items: m.length,
      officialItems: m.filter(x => x.kind === 'statement').length,
      stateMediaItems: m.filter(x => x.ownership && /state|government/i.test(x.ownership)).length,
      countries: [...countryCount.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 6),
      topics: [...topicCount.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 3),
      firstSeen: first, latest, hourly, score,
      coverage: [...m].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 25),
    }
  })
  return stories.filter(s => s.outlets >= 2).sort((a, b) => b.score - a.score)
}

function dailySeries(items: NewsItem[], days: number, keyOf: (i: NewsItem) => string[]) {
  const today = new Date()
  const dayKeys: string[] = []
  for (let i = days - 1; i >= 0; i--) dayKeys.push(new Date(today.getTime() - i * 86400_000).toISOString().slice(0, 10))
  const idx = new Map(dayKeys.map((d, i) => [d, i]))
  const series = new Map<string, number[]>()
  for (const it of items) {
    const di = idx.get(it.publishedAt.slice(0, 10))
    if (di === undefined) continue
    for (const k of keyOf(it)) {
      if (!series.has(k)) series.set(k, new Array(days).fill(0))
      series.get(k)![di]++
    }
  }
  return { dayKeys, series }
}

/** Recent (last 2 days) vs baseline (the days before), as a smoothed ratio. */
function momentum(s: number[]) {
  const recent = s.slice(-2).reduce((a, b) => a + b, 0) / 2
  const base = s.slice(0, -2)
  const baseline = base.length ? base.reduce((a, b) => a + b, 0) / base.length : 0
  return { recent, baseline, ratio: (recent + 1) / (baseline + 1), total: s.reduce((a, b) => a + b, 0) }
}

export function newsAnalysis(f: AnalysisFilters) {
  const items = loadItems()
  const key = JSON.stringify(f)
  if (analysisCache.has(key)) return analysisCache.get(key)
  const regions = regionMap()
  const reg = getRegistry()
  const name = (iso3: string) => reg.getCountryMembership(iso3)?.name || iso3
  const iso2 = (iso3: string) => (reg.getCountryMembership(iso3) as any)?.iso2 || ''
  const days = Math.min(30, Math.max(7, f.days || 14))
  const scoped = filtered(items, f, regions)
  const news = scoped.filter(i => i.kind === 'news')

  const stories = buildStories(scoped, 72).slice(0, 30)

  // countries: from the daily history when nothing is filtered, else from the items in the feed
  const unfiltered = !f.country && !f.topic && !f.region && !f.q && (!f.kind || f.kind === 'all')
  const hist = readHistory()
  const fromHistory = (field: 'countries' | 'topics') => {
    const dayKeys: string[] = []
    for (let i = days - 1; i >= 0; i--) dayKeys.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10))
    const series = new Map<string, number[]>()
    dayKeys.forEach((d, di) => {
      for (const [k, v] of Object.entries(hist.days[d]?.[field] || {})) {
        if (!series.has(k)) series.set(k, new Array(days).fill(0))
        series.get(k)![di] = v
      }
    })
    return { dayKeys, series }
  }
  const historyDays = Object.keys(hist.days).filter(d => (hist.days[d]?.total || 0) >= 20).length
  const { dayKeys, series: cSeries } = unfiltered ? fromHistory('countries') : dailySeries(news, days, i => i.countries)
  const countries = [...cSeries.entries()].map(([c, s]) => ({ iso3: c, iso2: iso2(c), name: name(c), series: s, ...momentum(s) }))
  // a trend needs a baseline: at least a week of days with real volume
  const trendsReady = historyDays >= 8
  const rising = trendsReady ? countries.filter(c => c.recent >= 3 && c.baseline > 0 && c.iso3 !== f.country).sort((a, b) => b.ratio - a.ratio).slice(0, 10) : []
  const last48 = [...countries].sort((a, b) => b.recent - a.recent).slice(0, 10)
  const mostCovered = [...countries].sort((a, b) => b.total - a.total).slice(0, 12)

  // topics
  const { series: tSeries } = unfiltered ? fromHistory('topics') : dailySeries(news, days, i => (i.topics.length ? i.topics : ['other']))
  const topics = [...tSeries.entries()].filter(([t]) => t !== 'other')
    .map(([t, s]) => ({ id: t, label: topicLabel(t), series: s, ...momentum(s) }))
    .sort((a, b) => b.total - a.total)

  // regions (last 7 days vs the 7 before)
  const now = Date.now()
  const d7 = new Date(now - 7 * 86400_000).toISOString()
  const d14 = new Date(now - 14 * 86400_000).toISOString()
  const regionCount = new Map<string, { now: number; before: number }>()
  for (const i of news) {
    const rs = new Set(i.countries.map(c => regions[c]).filter(Boolean))
    for (const r of rs) {
      const e = regionCount.get(r) || { now: 0, before: 0 }
      if (i.publishedAt >= d7) e.now++
      else if (i.publishedAt >= d14) e.before++
      regionCount.set(r, e)
    }
  }
  const regionList = [...regionCount.entries()].map(([r, v]) => ({ region: r, ...v })).sort((a, b) => b.now - a.now)

  // source mix (last 7 days)
  const recent = scoped.filter(i => i.publishedAt >= d7)
  const mix = new Map<string, number>()
  for (const i of recent) {
    const k = i.kind === 'statement' ? 'official' : i.ownership && /state|government/i.test(i.ownership) ? 'state media' : ['specialist-media', 'think-tank'].includes(i.sourceType) ? 'specialist' : i.sourceType === 'national-agency' ? 'national agency' : 'independent media'
    mix.set(k, (mix.get(k) || 0) + 1)
  }
  const untagged = news.filter(i => !i.topics.length).length

  const metaIsos = new Set<string>([...stories.flatMap(st => [...st.countries, ...st.coverage.flatMap(c => c.countries)]), ...cSeries.keys()])
  const countryMeta = Object.fromEntries([...metaIsos].map(c => [c, { name: name(c), iso2: iso2(c) }]))
  const out = {
    generatedAt: new Date().toISOString(),
    countryMeta,
    filters: f,
    totals: { items: scoped.length, news: news.length, statements: scoped.length - news.length, outlets: new Set(scoped.map(i => i.outlet.toLowerCase())).size, countries: cSeries.size, topicCoverage: news.length ? 1 - untagged / news.length : 0 },
    days: dayKeys,
    stories,
    rising, last48, mostCovered, topics,
    trends: { ready: trendsReady, historyDays, historyStart: hist.startedAt },
    regions: regionList,
    regionNames: [...new Set(Object.values(regions))].sort(),
    mix: [...mix.entries()].map(([k, v]) => ({ kind: k, count: v })).sort((a, b) => b.count - a.count),
  }
  analysisCache.set(key, out)
  if (analysisCache.size > 60) analysisCache.delete(analysisCache.keys().next().value as string)
  return out
}

/** The plain stream, newest first, with the same filters. */
export function newsStream(f: AnalysisFilters, offset = 0, limit = 40) {
  const regions = regionMap()
  const list = filtered(loadItems(), f, regions)
  const reg = getRegistry()
  const page = list.slice(offset, offset + limit)
  const isos = new Set(page.flatMap(i => i.countries))
  const countryMeta = Object.fromEntries([...isos].map(c => [c, { name: reg.getCountryMembership(c)?.name || c, iso2: (reg.getCountryMembership(c) as any)?.iso2 || '' }]))
  return { total: list.length, items: page, countryMeta }
}
