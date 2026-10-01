import { readDataFile } from '~/server/utils/data-file'
import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getActiveProvider } from '~/server/utils/ai-config'
import { buildUNBriefingPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import {
  getRecentStatements,
  getTopicDistribution,
  getP5Activity,
} from '~/server/utils/statements-feed'
import {
  getThemeAggregation,
  getConflictMentions,
  getSpeechesMeta,
} from '~/server/utils/speeches'
import { getRecentNews } from '~/server/utils/news-feed'
import { getRegistry } from '~/server/utils/wcg'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'server', 'data')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')

function resolveFile(name: string): string | null {
  const p1 = join(DATA_DIR, name)
  if (existsSync(p1)) return p1
  const p2 = join(ALT_DIR, name)
  if (existsSync(p2)) return p2
  return null
}

const REFRESH_HOURS = 4

function loadJSON(name: string): any {
  const f = resolveFile(name)
  if (!f) return null
  try { return JSON.parse(readFileSync(f, 'utf-8')) } catch { return null }
}

const P5_NAMES: Record<string, string> = { CHN: 'China', FRA: 'France', RUS: 'Russia', GBR: 'United Kingdom', USA: 'United States' }
const P5_ISO2: Record<string, string> = { CHN: 'CN', FRA: 'FR', RUS: 'RU', GBR: 'GB', USA: 'US' }

const CACHE_KEY = 'un-monitor-briefing'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const force = query.force === 'true'

  if (!force) {
    const cached = getCachedAnalysis(CACHE_KEY)
    // Regenerate when the cached text is empty or older than REFRESH_HOURS
    const fresh = cached && cached.content?.trim()
      && Date.now() - new Date(cached.generatedAt).getTime() < REFRESH_HOURS * 3600 * 1000
    if (cached && fresh) {
      const parsed = splitBriefingSections(cached.content)
      return {
        cached: true,
        ...parsed,
        generatedAt: cached.generatedAt,
        provider: cached.provider,
        model: cached.model,
      }
    }
  }

  const registry = getRegistry()
  const getName = (iso3: string) => {
    const m = registry.getCountryMembership(iso3)
    return m?.name || P5_NAMES[iso3] || iso3
  }
  const getIso2 = (iso3: string) => {
    const m = registry.getCountryMembership(iso3)
    return m?.iso2 || P5_ISO2[iso3] || ''
  }

  // Gather UNSC data
  const cutoff = `${new Date().getFullYear() - 1}-01-01`
  const unscVotes = readDataFile('unsc-votes.json')
  const unscVetoes = readDataFile('unsc-vetoes.json')

  const allResolutions = (unscVotes?.resolutions || [])
    .filter((r: any) => r.date >= cutoff)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))

  const recentVetoesList = (unscVetoes?.vetoes || [])
    .filter((v: any) => v.date >= cutoff)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))

  const keyDevelopments = allResolutions.slice(0, 7).map((r: any) => {
    const vetoEntry = r.vetoed ? recentVetoesList.find((v: any) => v.draft?.split(/\s+/).includes(r.id)) : null
    return {
      id: r.id,
      date: r.date,
      title: r.title,
      adopted: r.adopted,
      vetoed: r.vetoed,
      vetoedBy: vetoEntry?.vetoed_by?.map((c: string) => ({ iso3: c, name: getName(c) })) || [],
      tally: r.tally,
    }
  })

  const recentVetoes = recentVetoesList.slice(0, 5).map((v: any) => ({
    date: v.date,
    subject: v.subject,
    vetoedBy: v.vetoed_by?.map((c: string) => ({ iso3: c, name: getName(c) })) || [],
  }))

  const adopted = allResolutions.filter((r: any) => r.adopted).length
  const vetoed = allResolutions.filter((r: any) => r.vetoed).length

  // P5 activity
  const p5Activity = getP5Activity().map(p => ({
    ...p,
    name: getName(p.iso3),
    iso2: getIso2(p.iso3),
  }))

  // Topics
  const activeTopics = getTopicDistribution().slice(0, 8)

  // Statements
  const statements = getRecentStatements(15)

  // News — UN-filtered
  const UN_KEYWORDS = ['UN ', 'United Nations', 'Security Council', 'UNSC', 'General Assembly',
    'UNGA', 'Secretary-General', 'Guterres', 'peacekeep', 'UNICEF', 'UNHCR', 'WHO ',
    'UNRWA', 'UNESCO', 'humanitarian aid', 'ceasefire', 'sanctions']
  const UN_SOURCES = ['un-news', 'passblue']
  const allNews = getRecentNews(200)
  const news = allNews.filter(a => {
    if (UN_SOURCES.includes(a.source)) return true
    const text = (a.title + ' ' + (a.description || '')).toLowerCase()
    return UN_KEYWORDS.some(kw => text.includes(kw.toLowerCase()))
  }).slice(0, 12)

  // GA context
  let gaContext: any = undefined
  try {
    const speechMeta = getSpeechesMeta()
    const sessions = speechMeta?.sessions || []
    const currentSession = sessions.length > 0 ? Math.max(...sessions) : null
    if (currentSession) {
      const themes = getThemeAggregation(currentSession).slice(0, 5)
      const conflicts = getConflictMentions(currentSession).slice(0, 5)
      gaContext = {
        session: currentSession,
        topThemes: themes.map((t: any) => t.theme),
        topConflicts: conflicts.map((c: any) => ({ name: c.conflict, mentions: c.mentions })),
      }
    }
  } catch {}

  const messages = buildUNBriefingPrompt({
    keyDevelopments,
    recentVetoes,
    stats: { resolutionsConsidered: allResolutions.length, adopted, vetoed },
    p5Activity,
    statements,
    news,
    activeTopics,
    gaContext,
  })

  // Reasoning models spend much of the budget before writing; give them room
  const content = await callLLM(messages, { temperature: 0.6, maxTokens: 16000 })
  const provider = getActiveProvider()!
  if (!content?.trim()) {
    throw createError({ statusCode: 502, statusMessage: 'The AI provider returned an empty briefing; try again' })
  }
  setCachedAnalysis(CACHE_KEY, content, provider.name, provider.model)

  const parsed = splitBriefingSections(content)
  return {
    cached: false,
    ...parsed,
    generatedAt: new Date().toISOString(),
    provider: provider.name,
    model: provider.model,
  }
})

function splitBriefingSections(content: string): { overview: string; newsDigest: string; statementsDigest: string; content: string } {
  const newsMarker = '===NEWS==='
  const stmtMarker = '===STATEMENTS==='

  const newsIdx = content.indexOf(newsMarker)
  const stmtIdx = content.indexOf(stmtMarker)

  if (newsIdx >= 0 && stmtIdx >= 0) {
    return {
      overview: content.slice(0, newsIdx).trim(),
      newsDigest: content.slice(newsIdx + newsMarker.length, stmtIdx).trim(),
      statementsDigest: content.slice(stmtIdx + stmtMarker.length).trim(),
      content,
    }
  }

  // Fallback: everything is the overview
  return {
    overview: content.trim(),
    newsDigest: '',
    statementsDigest: '',
    content,
  }
}
