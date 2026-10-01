import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getActiveProvider, getPulseStyleConfig, type PulseStyleConfig, type PulseTone } from '~/server/utils/ai-config'
import { buildDiplomaticPulsePrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { getConflictHotspots } from '~/server/utils/conflict'
import { getAllSpeeches } from '~/server/utils/speeches'
import { getRecentNews } from '~/server/utils/news-feed'
import { getRegistry } from '~/server/utils/wcg'

const VALID_TONES: PulseTone[] = ['formal-diplomatic', 'analytical', 'journalistic']

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const force = query.force === 'true'

  // Parse style params from query, merge with saved config
  const savedStyle = getPulseStyleConfig()
  const styleParams: PulseStyleConfig = {
    tone: (VALID_TONES.includes(query.tone as PulseTone) ? query.tone : savedStyle.tone) as PulseTone,
    temperature: query.temperature ? Math.max(0, Math.min(1.5, parseFloat(query.temperature as string) || savedStyle.temperature)) : savedStyle.temperature,
    speakerStyleAdherence: query.speakerStyleAdherence ? Math.max(0, Math.min(100, parseInt(query.speakerStyleAdherence as string) || savedStyle.speakerStyleAdherence)) : savedStyle.speakerStyleAdherence,
  }

  const cacheKey = `diplomatic-pulse:weekly:${styleParams.tone}:t${styleParams.temperature}:s${styleParams.speakerStyleAdherence}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      const { headlines, analysis } = splitPulseContent(cached.content)
      return { cached: true, content: cached.content, headlines, analysis, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model, style: styleParams }
    }
  }

  // Gather data
  const registry = getRegistry()
  const hotspots = getConflictHotspots()
  const speeches = getAllSpeeches()

  const recentNews = getRecentNews(20).map(a => ({
    title: a.title,
    source: a.source,
    publishedAt: a.publishedAt,
    countries: a.countries,
    topics: a.topics,
  }))

  // Collect ISO3 codes mentioned in current news
  const newsCountries = new Set<string>()
  for (const n of recentNews) {
    for (const iso3 of (n.countries || [])) {
      newsCountries.add(iso3)
    }
  }

  // Build country context: group memberships + GA positions for countries in the news
  const countryContext: Record<string, any> = {}
  for (const iso3 of newsCountries) {
    const membership = registry.getCountryMembership(iso3)
    if (!membership) continue
    const entry: any = {
      name: membership.name,
      groups: (membership.groups || []).slice(0, 8).map((g: any) => g.acronym || g.name),
    }
    // Find their most recent GA speech (compact summary only)
    const speech = speeches.find((s: any) => s.iso3 === iso3)
    if (speech) {
      entry.gaSession = { year: speech.year, session: speech.session, speaker: speech.speaker, title: speech.analysis?.speaker_title || speech.speaker_title || null }
      if (speech.analysis?.policy_positions?.length) {
        entry.gaSession.positions = speech.analysis.policy_positions.slice(0, 3).map((p: any) =>
          typeof p === 'object' ? `${p.topic}: ${p.position || p.stance || 'stated'}` : p
        )
      }
      if (speech.analysis?.summary) {
        entry.gaSession.summary = speech.analysis.summary
      }
    }
    countryContext[iso3] = entry
  }

  const data = {
    hotspots,
    recentNews,
    countryContext,
  }

  const messages = buildDiplomaticPulsePrompt(data, styleParams)
  const content = await callLLM(messages, { temperature: styleParams.temperature })

  const provider = getActiveProvider()!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  const { headlines, analysis } = splitPulseContent(content)
  return { cached: false, content, headlines, analysis, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model, style: styleParams }
})

function splitPulseContent(content: string): { headlines: string; analysis: string } {
  const parts = content.split(/\n---\n/)
  if (parts.length >= 2) {
    return { headlines: parts[0].trim(), analysis: parts.slice(1).join('\n---\n').trim() }
  }
  // Fallback: first paragraph as headlines, rest as analysis
  const lines = content.split('\n')
  const breakIdx = lines.findIndex((l, i) => i > 2 && l.startsWith('#'))
  if (breakIdx > 0) {
    return { headlines: lines.slice(0, breakIdx).join('\n').trim(), analysis: lines.slice(breakIdx).join('\n').trim() }
  }
  return { headlines: content, analysis: '' }
}
