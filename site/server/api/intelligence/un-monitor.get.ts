import { readDataFile } from '~/server/utils/data-file'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import {
  getRecentStatements,
  getStatementsBySource,
  getMostMentionedCountries,
  getTopicDistribution,
  getP5Activity,
  getStatementsFeedMeta,
  getStatementTypeBreakdown,
} from '~/server/utils/statements-feed'
import {
  getThemeAggregation,
  getConflictMentions,
  getSpeechesMeta,
} from '~/server/utils/speeches'
import { getRecentNews } from '~/server/utils/news-feed'
import { getRegistry } from '~/server/utils/wcg'

const DATA_DIR = join(process.cwd(), 'server', 'data')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')

function resolveFile(name: string): string | null {
  const p1 = join(DATA_DIR, name)
  if (existsSync(p1)) return p1
  const p2 = join(ALT_DIR, name)
  if (existsSync(p2)) return p2
  return null
}

let _unscVotes: any = null
let _unscVetoes: any = null
let _unscHistory: any = null
let _unscActivity: any = null

function loadJSON(name: string): any {
  const f = resolveFile(name)
  if (!f) return null
  try { return JSON.parse(readFileSync(f, 'utf-8')) } catch { return null }
}

function ensureUNSC() {
  _unscVotes = readDataFile('unsc-votes.json')
  _unscVetoes = readDataFile('unsc-vetoes.json')
  _unscHistory = readDataFile('unsc-history.json')
  _unscActivity = readDataFile('unsc-activity.json')
}

const P5 = ['CHN', 'FRA', 'RUS', 'GBR', 'USA']
const P5_ISO2: Record<string, string> = { CHN: 'CN', FRA: 'FR', RUS: 'RU', GBR: 'GB', USA: 'US' }
const P5_NAMES: Record<string, string> = { CHN: 'China', FRA: 'France', RUS: 'Russia', GBR: 'United Kingdom', USA: 'United States' }

// Filter date: beginning of previous year (so we capture ~last 12-15 months)
function getRecentCutoff(): string {
  const now = new Date()
  return `${now.getFullYear() - 1}-01-01`
}

function timeAgoLabel(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  if (days < 365) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.floor(days / 365)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

export default defineEventHandler(() => {
  const registry = getRegistry()
  const getName = (iso3: string) => {
    const m = registry.getCountryMembership(iso3)
    return m?.name || P5_NAMES[iso3] || iso3
  }
  const getIso2 = (iso3: string) => {
    const m = registry.getCountryMembership(iso3)
    return m?.iso2 || P5_ISO2[iso3] || ''
  }

  const cutoff = getRecentCutoff()
  const currentYear = new Date().getFullYear()

  // ==========================================
  // 1. BRIEFING — narrative data for "what's happening now"
  // ==========================================
  let briefing: any = {}
  try {
    ensureUNSC()

    // Latest UNSC action
    const allResolutions = (_unscVotes?.resolutions || [])
      .filter((r: any) => r.date >= cutoff)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))

    const latestAction = allResolutions[0] || null
    const recentVetoes = (_unscVetoes?.vetoes || [])
      .filter((v: any) => v.date >= cutoff)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))

    // Build headline from latest action
    let headline = ''
    let headlineDetail = ''
    if (latestAction) {
      if (latestAction.vetoed) {
        const vetoEntry = recentVetoes.find((v: any) => v.draft?.split(/\s+/).includes(latestAction.id))
        const vetoBy = vetoEntry?.vetoed_by?.map((c: string) => getName(c)).join(' and ') || 'P5 member'
        headline = `${latestAction.title} — vetoed by ${vetoBy}`
        headlineDetail = `Draft ${latestAction.id} was blocked on ${latestAction.date} with a vote of ${latestAction.tally?.yes}-${latestAction.tally?.no}-${latestAction.tally?.abstain}`
      } else if (latestAction.adopted) {
        headline = `${latestAction.title} — adopted`
        headlineDetail = `Resolution ${latestAction.id} was adopted on ${latestAction.date} with a vote of ${latestAction.tally?.yes}-${latestAction.tally?.no}-${latestAction.tally?.abstain}`
      } else {
        headline = `${latestAction.title} — draft not adopted`
        headlineDetail = `Draft ${latestAction.id} failed to get the required nine votes on ${latestAction.date} (${latestAction.tally?.yes}-${latestAction.tally?.no}-${latestAction.tally?.abstain})`
      }
    }

    // Key developments: recent resolutions + vetoes (combined, sorted by date)
    const keyDevelopments = allResolutions.slice(0, 7).map((r: any) => {
      const vetoEntry = r.vetoed ? recentVetoes.find((v: any) => v.draft?.split(/\s+/).includes(r.id)) : null
      return {
        id: r.id,
        date: r.date,
        timeAgo: timeAgoLabel(r.date),
        title: r.title,
        adopted: r.adopted,
        vetoed: r.vetoed,
        vetoedBy: vetoEntry?.vetoed_by?.map((c: string) => ({ iso3: c, iso2: getIso2(c), name: getName(c) })) || [],
        tally: r.tally,
      }
    })

    // Active topics from statements
    const topics = getTopicDistribution().slice(0, 8)

    // Recent vetoes with context
    const vetoesNow = recentVetoes.slice(0, 5).map((v: any) => ({
      date: v.date,
      timeAgo: timeAgoLabel(v.date),
      draft: v.draft,
      subject: v.subject,
      vetoedBy: v.vetoed_by?.map((c: string) => ({ iso3: c, iso2: getIso2(c), name: getName(c) })) || [],
    }))

    // Speech themes as background context (not displayed raw, but feeds the briefing)
    let backgroundThemes: string[] = []
    try {
      const speechMeta = getSpeechesMeta()
      const sessions = speechMeta?.sessions || []
      const currentSession = sessions.length > 0 ? Math.max(...sessions) : null
      if (currentSession) {
        const themes = getThemeAggregation(currentSession).slice(0, 5)
        backgroundThemes = themes.map((t: any) => t.theme)
        const conflicts = getConflictMentions(currentSession).slice(0, 5)
        briefing.gaContext = {
          session: currentSession,
          topThemes: themes.map((t: any) => t.theme),
          topConflicts: conflicts.map((c: any) => ({ name: c.conflict, mentions: c.mentions })),
        }
      }
    } catch {}

    // Summary stats
    const adopted = allResolutions.filter((r: any) => r.adopted).length
    const vetoed = allResolutions.filter((r: any) => r.vetoed).length

    // Every recent Council meeting (briefings, debates, adoptions), newest first
    const scMeetings = (_unscActivity?.meetings || []).slice(0, 12).map((m: any) => ({
      ...m,
      timeAgo: timeAgoLabel(m.date),
    }))

    briefing = {
      ...briefing,
      scMeetings,
      scDataUpdated: _unscActivity?._meta?.last_updated || _unscVotes?._meta?.last_updated || null,
      headline,
      headlineDetail,
      latestActionDate: latestAction?.date || null,
      keyDevelopments,
      activeTopics: topics,
      recentVetoes: vetoesNow,
      stats: { resolutionsConsidered: allResolutions.length, adopted, vetoed },
    }
  } catch {}

  // ==========================================
  // 2. NEWS — UN-related headlines from news sources
  // ==========================================
  let news: any[] = []
  try {
    const UN_KEYWORDS = ['UN ', 'United Nations', 'Security Council', 'UNSC', 'General Assembly',
      'UNGA', 'Secretary-General', 'Guterres', 'peacekeep', 'UNICEF', 'UNHCR', 'WHO ',
      'UNRWA', 'UNESCO', 'humanitarian aid', 'ceasefire', 'sanctions']
    const UN_SOURCES = ['un-news', 'passblue']

    const allNews = getRecentNews(200)
    const unNews = allNews.filter(a => {
      if (UN_SOURCES.includes(a.source)) return true
      const text = (a.title + ' ' + (a.description || '')).toLowerCase()
      return UN_KEYWORDS.some(kw => text.includes(kw.toLowerCase()))
    })

    news = unNews.slice(0, 15).map(a => ({
      id: a.id,
      title: a.title,
      description: a.description?.slice(0, 200) || '',
      url: a.url,
      source: a.source,
      publishedAt: a.publishedAt,
      timeAgo: timeAgoLabel(a.publishedAt),
      countries: a.countries?.slice(0, 4) || [],
      topics: a.topics || [],
    }))
  } catch {}

  // ==========================================
  // 3. STATEMENTS — current diplomatic activity
  // ==========================================
  let statements: any = {}
  try {
    const recent = getRecentStatements(30)
    const bySource = getStatementsBySource()
    const byTopic = getTopicDistribution()
    const byType = getStatementTypeBreakdown()
    const mentionedRaw = getMostMentionedCountries(15)
    const mentionedCountries = mentionedRaw.map(m => ({
      iso3: m.iso3,
      iso2: getIso2(m.iso3),
      name: getName(m.iso3),
      count: m.count,
    }))
    const p5Raw = getP5Activity()
    const p5 = p5Raw.map(p => ({
      iso3: p.iso3,
      iso2: getIso2(p.iso3),
      name: getName(p.iso3),
      count: p.count,
      latest: p.latest,
    }))

    statements = { recent, bySource, byTopic, byType, mentionedCountries, p5 }
  } catch {}

  // ==========================================
  // 4. SECURITY COUNCIL — current composition + recent activity only
  // ==========================================
  let securityCouncil: any = {}
  try {
    ensureUNSC()

    // Current E10
    const elected: any[] = []
    if (_unscHistory?.terms) {
      for (const [iso3, terms] of Object.entries(_unscHistory.terms) as [string, number[][]][]) {
        for (const [start, end] of terms) {
          if (start <= currentYear && end >= currentYear) {
            elected.push({ iso3, iso2: getIso2(iso3), name: getName(iso3), start, end })
          }
        }
      }
    }

    // Only recent resolutions (2025+)
    const recentResolutions = (_unscVotes?.resolutions || [])
      .filter((r: any) => r.date >= cutoff)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))
      .map((r: any) => ({
        id: r.id,
        date: r.date,
        title: r.title,
        adopted: r.adopted,
        vetoed: r.vetoed,
        tally: r.tally,
        votes: r.votes,
      }))

    securityCouncil = {
      permanent: P5,
      elected,
      recentResolutions,
    }
  } catch {}

  // ==========================================
  // 5. ARCHIVE — historical data grouped by year for browsing
  // ==========================================
  let archive: any = {}
  try {
    ensureUNSC()
    const allRes = _unscVotes?.resolutions || []
    const allVetoes = _unscVetoes?.vetoes || []

    // Group by year
    const years = new Map<number, { resolutions: any[]; vetoes: any[] }>()
    for (const r of allRes) {
      const y = parseInt(r.date?.slice(0, 4))
      if (!y) continue
      if (!years.has(y)) years.set(y, { resolutions: [], vetoes: [] })
      years.get(y)!.resolutions.push({
        id: r.id, date: r.date, title: r.title,
        adopted: r.adopted, vetoed: r.vetoed, tally: r.tally,
      })
    }
    for (const v of allVetoes) {
      const y = parseInt(v.date?.slice(0, 4))
      if (!y) continue
      if (!years.has(y)) years.set(y, { resolutions: [], vetoes: [] })
      years.get(y)!.vetoes.push({
        date: v.date, draft: v.draft, subject: v.subject,
        vetoed_by: v.vetoed_by?.map((c: string) => ({ iso3: c, name: getName(c) })),
      })
    }

    // Convert to sorted array
    const yearList = [...years.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, data]) => ({ year, ...data }))

    archive = { years: yearList }
  } catch {}

  // ==========================================
  // META
  // ==========================================
  let lastUpdated = ''
  try {
    const meta = getStatementsFeedMeta()
    lastUpdated = meta?.last_updated || ''
  } catch {}

  return {
    meta: { lastUpdated },
    briefing,
    news,
    statements,
    securityCouncil,
    archive,
  }
})
