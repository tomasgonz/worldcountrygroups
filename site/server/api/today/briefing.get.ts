import { isAdminRequest } from '~/server/utils/request-role'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildTodayBriefingPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { getRecentNews } from '~/server/utils/news-feed'
import { getRecentStatements, getTopicDistribution, getP5Activity } from '~/server/utils/statements-feed'
import { getRegistry } from '~/server/utils/wcg'
import { readDataFile } from '~/server/utils/data-file'
import { getJournalDays, getElections } from '~/server/utils/upcoming'
import { getNYTodayKey, getNYWeekRange, isInNYToday, isInNYWindow, formatNYDateLong } from '~/server/utils/un-day'

const DATA_DIR = join(process.cwd(), 'server', 'data')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')

function resolveFile(name: string): string | null {
  const p1 = join(DATA_DIR, name)
  if (existsSync(p1)) return p1
  const p2 = join(ALT_DIR, name)
  if (existsSync(p2)) return p2
  return null
}

function loadJSON(name: string): any {
  const f = resolveFile(name)
  if (!f) return null
  try { return JSON.parse(readFileSync(f, 'utf-8')) } catch { return null }
}

const P5_NAMES: Record<string, string> = { CHN: 'China', FRA: 'France', RUS: 'Russia', GBR: 'United Kingdom', USA: 'United States' }

interface SectionedBriefing {
  headline: string
  atTheUN: string
  inTheWorld: string
  watchList: string
  weekArc: string
  raw: string
}

interface CitationItem {
  id: string
  title: string
  url: string
  source: string
}

function buildCitationMap(todayNews: any[], todayStatements: any[]): Record<string, CitationItem> {
  const map: Record<string, CitationItem> = {}
  todayNews.slice(0, 40).forEach((n, i) => {
    const id = `n${i + 1}`
    map[id] = { id, title: n.title, url: n.url, source: n.source }
  })
  todayStatements.slice(0, 25).forEach((s, i) => {
    const id = `s${i + 1}`
    map[id] = { id, title: s.title, url: s.url, source: s.source }
  })
  return map
}

function splitSections(content: string): SectionedBriefing {
  const markers = ['===HEADLINE===', '===AT_THE_UN===', '===IN_THE_WORLD===', '===WATCH_LIST===', '===WEEK_ARC===']
  const positions = markers.map(m => ({ m, i: content.indexOf(m) }))
  const found = positions.filter(p => p.i >= 0).sort((a, b) => a.i - b.i)

  const out: Record<string, string> = {}
  for (let i = 0; i < found.length; i++) {
    const start = found[i].i + found[i].m.length
    const end = i + 1 < found.length ? found[i + 1].i : content.length
    out[found[i].m] = content.slice(start, end).trim()
  }

  return {
    headline: out['===HEADLINE==='] || '',
    atTheUN: out['===AT_THE_UN==='] || '',
    inTheWorld: out['===IN_THE_WORLD==='] || '',
    watchList: out['===WATCH_LIST==='] || '',
    weekArc: out['===WEEK_ARC==='] || '',
    raw: content,
  }
}

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  // regenerating costs money: only admins may force it
  const force = query.force === 'true' && isAdminRequest(event)

  const now = new Date()
  const todayKey = getNYTodayKey(now)
  const { startKey, endKey } = getNYWeekRange(now)
  const dateLabel = formatNYDateLong(now)
  const cacheKey = `today-brief-${todayKey}`

  // Cached: return immediately unless it's older than REFRESH_HOURS. The UN day moves
  // on (new meetings, statements, news), so a single morning briefing goes stale.
  const cachedEntry = getCachedAnalysis(cacheKey)
  const stale = cachedEntry
    ? Date.now() - new Date(cachedEntry.generatedAt).getTime() > REFRESH_HOURS * 3600 * 1000
    : true
  if (!force && cachedEntry && stale && !_inFlight) {
    // Serve the existing briefing now and rebuild it in the background
    _inFlight = generate(now, todayKey, cacheKey).catch(() => null).finally(() => { _inFlight = null })
  }
  if (!force) {
    const cached = cachedEntry
    if (cached) {
      const parsed = splitSections(cached.content)
      const evidence = gatherEvidence(now)
      return {
        cached: true,
        dateLabel,
        todayKey,
        weekRange: { startKey, endKey },
        briefing: parsed,
        citations: buildCitationMap(evidence.todayNews, evidence.todayStatements),
        generatedAt: cached.generatedAt,
        provider: cached.provider,
        model: cached.model,
        evidence,
        refreshing: stale,
      }
    }
  }

  if (_inFlight && !force) await _inFlight
  else {
    _inFlight = generate(now, todayKey, cacheKey).finally(() => { _inFlight = null })
    await _inFlight
  }
  const fresh = getCachedAnalysis(cacheKey)!
  const evidence = gatherEvidence(now)
  return {
    cached: false,
    dateLabel,
    todayKey,
    weekRange: { startKey, endKey },
    briefing: splitSections(fresh.content),
    citations: buildCitationMap(evidence.todayNews, evidence.todayStatements),
    generatedAt: fresh.generatedAt,
    provider: fresh.provider,
    model: fresh.model,
    evidence,
  }
})

const REFRESH_HOURS = 4
let _inFlight: Promise<any> | null = null

async function generate(now: Date, todayKey: string, cacheKey: string): Promise<void> {
  const dateLabel = formatNYDateLong(now)
  // Gather data
  const registry = getRegistry()
  const getName = (iso3: string) => registry.getCountryMembership(iso3)?.name || P5_NAMES[iso3] || iso3

  const evidence = gatherEvidence(now)

  // SC actions: last 60 days
  const unscVotes = readDataFile('unsc-votes.json')
  const unscVetoes = readDataFile('unsc-vetoes.json')
  const unscActivity = readDataFile('unsc-activity.json')
  const cutoff = new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const allResolutions = (unscVotes?.resolutions || [])
    .filter((r: any) => r.date >= cutoff)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
  const recentVetoesList = (unscVetoes?.vetoes || [])
    .filter((v: any) => v.date >= cutoff)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
  const recentSCActions = allResolutions.slice(0, 8).map((r: any) => {
    const vetoEntry = r.vetoed ? recentVetoesList.find((v: any) => v.draft?.split(/\s+/).includes(r.id)) : null
    return {
      id: r.id, date: r.date, title: r.title, adopted: r.adopted, vetoed: r.vetoed,
      vetoedBy: vetoEntry?.vetoed_by?.map((c: string) => ({ iso3: c, name: getName(c) })) || [],
    }
  })

  const p5Activity = getP5Activity().map(p => ({ ...p, name: getName(p.iso3) }))
  const activeTopics = getTopicDistribution().slice(0, 8)

  const messages = buildTodayBriefingPrompt({
    dateLabel,
    todayNews: evidence.todayNews,
    todayStatements: evidence.todayStatements,
    weekNews: evidence.weekNews,
    weekStatements: evidence.weekStatements,
    recentSCActions,
    recentSCMeetings: (unscActivity?.meetings || []).filter((m: any) => m.date >= cutoff).slice(0, 15),
    recentVetoes: recentVetoesList.slice(0, 5),
    p5Activity,
    activeTopics,
    topCountriesToday: evidence.topCountriesToday,
    topCountriesWeek: evidence.topCountriesWeek,
    weekAheadMeetings: getJournalDays({ location: 'New York', days: 7, includeClosed: false })
      .flatMap(d => d.meetings)
      .filter(m => !m.cancelled)
      .map(m => ({ date: m.date, time: m.time, organ: m.organ, title: m.title, agenda: m.agenda || [] })),
    upcomingElections: getElections({ status: 'upcoming', withinDays: 30, includeIndirect: false })
      .map(e => ({ date: e.date, precision: e.precision, country: e.country, description: e.description })),
  })

  // gpt-5 spends substantial budget on reasoning tokens before output; give it room
  const content = await callLLM(messages, { task: 'today-brief', temperature: 0.5, maxTokens: 24000 })
  const provider = getProviderForTask('today-brief')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)
}

function gatherEvidence(now: Date) {
  const allNews = getRecentNews(500)
  const allStatements = getRecentStatements(200)

  // For today items, sort by (sourceTier ascending, date descending) so tier-1
  // official UN sources get the prompt's top citation slots before tier-3/4
  // commentary. Without this, high-volume sources with fake "now" timestamps
  // (China MFA scrape) crowd out the UN HQ pool (PGA, OHCHR, ICJ, DPPA, OCHA).
  const byTierThenDate = (a: any, b: any) => {
    const ta = a.sourceTier ?? 5
    const tb = b.sourceTier ?? 5
    if (ta !== tb) return ta - tb
    return (b.publishedAt || '').localeCompare(a.publishedAt || '')
  }

  const todayNews = allNews.filter(a => isInNYToday(a.publishedAt, now)).sort(byTierThenDate)
  const todayStatements = allStatements.filter(s => isInNYToday(s.publishedAt, now)).sort(byTierThenDate)
  const weekNews = allNews.filter(a => isInNYWindow(a.publishedAt, 168, now))
  const weekStatements = allStatements.filter(s => isInNYWindow(s.publishedAt, 168, now))

  const countItems = (items: any[]) => {
    const m = new Map<string, number>()
    for (const it of items) {
      for (const c of (it.countries || [])) m.set(c, (m.get(c) || 0) + 1)
    }
    return [...m.entries()].map(([iso3, count]) => ({ iso3, count })).sort((a, b) => b.count - a.count)
  }
  const topCountriesToday = countItems([...todayNews, ...todayStatements])
  const topCountriesWeek = countItems([...weekNews, ...weekStatements])

  return {
    todayNews,
    todayStatements,
    weekNews,
    weekStatements,
    topCountriesToday,
    topCountriesWeek,
    counts: {
      todayNews: todayNews.length,
      todayStatements: todayStatements.length,
      weekNews: weekNews.length,
      weekStatements: weekStatements.length,
    },
  }
}
