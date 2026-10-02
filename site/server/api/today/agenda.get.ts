import { getRecentStatements, getStatementsFeedMeta } from '~/server/utils/statements-feed'
import { readDataFile, dataFileMtime } from '~/server/utils/data-file'
import { getNYTodayKey, isInNYToday } from '~/server/utils/un-day'
import { getRecentNews } from '~/server/utils/news-feed'
import { getJournalDays, getJournalMeta, getElections, getElectionsMeta } from '~/server/utils/upcoming'

/**
 * Factual "what is happening at the UN" data for the Today page. No AI involved,
 * so it is always available and as current as the underlying feeds.
 */

const NY = 'America/New_York'
const nyKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: NY })
const nyTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: NY, hour: 'numeric', minute: '2-digit' })
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')

const BODY_ORDER = ['General Assembly', 'Security Council', 'Economic and Social Council', 'Human Rights Council',
  'Conferences', 'Press Conferences', 'Media Stakeouts', 'Meetings & Events', 'Side Events']

export default defineEventHandler(() => {
  const now = new Date()
  const todayKey = getNYTodayKey(now)
  const tomorrowKey = nyKey(new Date(now.getTime() + 24 * 3600 * 1000).toISOString())

  // --- UN Web TV schedule (today and tomorrow, New York time) ---
  const schedule = getRecentStatements(5000).filter(s => s.source === 'un-webtv-schedule')
  const seen = new Set<string>()
  const toItem = (s: any) => ({
    time: nyTime(s.publishedAt),
    start: s.publishedAt,
    title: decode(s.title),
    body: s.type || 'Other',
    url: s.url,
    past: new Date(s.publishedAt).getTime() < now.getTime() - 90 * 60 * 1000,
  })
  const pick = (key: string) => schedule
    .filter(s => nyKey(s.publishedAt) === key)
    .filter((s) => {
      const k = `${s.publishedAt}|${decode(s.title)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map(toItem)
    .sort((a, b) => a.start.localeCompare(b.start))
  const today = pick(todayKey)
  const tomorrow = pick(tomorrowKey)
  const byBody = (items: any[]) => {
    const groups = new Map<string, any[]>()
    for (const it of items) {
      if (!groups.has(it.body)) groups.set(it.body, [])
      groups.get(it.body)!.push(it)
    }
    return [...groups.entries()]
      .sort((a, b) => (BODY_ORDER.indexOf(a[0]) + 100) % 100 - (BODY_ORDER.indexOf(b[0]) + 100) % 100)
      .map(([body, items]) => ({ body, items }))
  }

  // --- Security Council: latest meetings and outcomes ---
  const activity = readDataFile<any>('unsc-activity.json')
  const scMeetings = (activity?.meetings || []).slice(0, 10)
  const votes = readDataFile<any>('unsc-votes.json')
  const lastDecision = (votes?.resolutions || [])[0] || null

  // --- the week ahead: UN Journal programme (New York and Geneva) ---
  const trimMeeting = (m: any) => ({ ...m, agenda: (m.agenda || []).slice(0, 8), documents: (m.documents || []).slice(0, 8) })
  const journalMeta = getJournalMeta()
  const journalDays = getJournalDays({ location: 'all', days: 8 })
    .map(d => ({ ...d, meetings: d.meetings.map(trimMeeting) }))
  const journal = {
    updated: journalMeta.updated,
    sourceUrl: journalMeta.sourceUrl,
    newYork: journalDays.filter(d => d.location === 'New York'),
    geneva: journalDays.filter(d => d.location === 'Geneva'),
  }

  // --- elections in the next 60 days (Wikipedia, CC BY-SA) ---
  const electionsMeta = getElectionsMeta()
  const elections = {
    attribution: electionsMeta.attribution,
    licenseUrl: electionsMeta.licenseUrl,
    pages: electionsMeta.pages,
    updated: electionsMeta.updated,
    upcoming: getElections({ status: 'upcoming', withinDays: 60, limit: 40 }),
    recent: getElections({ status: 'past', limit: 6 }),
  }

  // --- freshness of every feed this page relies on ---
  const statementsMeta = getStatementsFeedMeta() as any
  const newsMeta = readDataFile<any>('news-feed.json')?._meta
  const newsLatest = newsMeta?.last_updated || dataFileMtime('news-feed.json')
  const freshness = [
    { label: 'UN schedule & statements', updated: statementsMeta?.last_updated || null },
    { label: 'News', updated: newsLatest },
    { label: 'Security Council record', updated: dataFileMtime('unsc-activity.json') },
    { label: 'UN Journal', updated: journalMeta.updated },
  ]

  // --- headline numbers for the summary strip ---
  const statementsToday = getRecentStatements(5000)
    .filter(s => s.source !== 'un-webtv-schedule' && isInNYToday(s.publishedAt, now)).length
  const newsToday = getRecentNews(2000).filter(a => isInNYToday(a.publishedAt, now)).length
  const year = String(now.getFullYear())
  const decisionsThisYear = (votes?.resolutions || []).filter((r: any) => r.date?.startsWith(year))
  const stats = {
    meetingsToday: today.filter(i => !/press|stakeout/i.test(i.body)).length,
    statementsToday,
    newsToday,
    scResolutionsThisYear: decisionsThisYear.filter((r: any) => r.adopted).length,
    scVetoesThisYear: decisionsThisYear.filter((r: any) => r.vetoed).length,
  }

  return {
    stats,
    nowIso: now.toISOString(),
    todayKey,
    tomorrowKey,
    schedule: { today: byBody(today), tomorrow: byBody(tomorrow), todayCount: today.length, tomorrowCount: tomorrow.length },
    securityCouncil: { meetings: scMeetings, lastDecision },
    journal,
    elections,
    freshness,
  }
})
