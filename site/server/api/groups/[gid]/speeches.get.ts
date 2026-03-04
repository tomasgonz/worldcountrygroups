import { getRegistry } from '~/server/utils/wcg'
import { getCountrySpeeches } from '~/server/utils/speeches'
import type { SpeechMeta } from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid')!
  const group = getRegistry().getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso3Codes = new Set(group.countries.map(c => c.iso3).filter(Boolean))
  const countryLookup = new Map<string, { iso2: string; name: string }>()
  for (const c of group.countries) {
    if (c.iso3) countryLookup.set(c.iso3, { iso2: c.iso2, name: c.name })
  }

  // Gather speeches per member
  const allSpeeches: SpeechMeta[] = []
  const countrySpeechMap = new Map<string, SpeechMeta[]>()

  for (const iso3 of iso3Codes) {
    const speeches = getCountrySpeeches(iso3)
    if (speeches.length) {
      countrySpeechMap.set(iso3, speeches)
      allSpeeches.push(...speeches)
    }
  }

  if (!allSpeeches.length) {
    return { available: false, totalSpeeches: 0, membersWithSpeeches: 0, totalMembers: iso3Codes.size, themes: [], sentiment: { positive: 0, negative: 0, neutral: 0, mixed: 0 }, emergingTopics: [], countries: [] }
  }

  // Theme aggregation
  const themes = new Map<string, { count: number; high: number; medium: number; low: number }>()
  const sentiment = { positive: 0, negative: 0, neutral: 0, mixed: 0 }
  const topicCounts = new Map<string, number>()

  for (const s of allSpeeches) {
    if (s.analysis?.themes) {
      for (const t of s.analysis.themes) {
        const entry = themes.get(t.name) || { count: 0, high: 0, medium: 0, low: 0 }
        entry.count++
        if (t.relevance === 'high') entry.high++
        else if (t.relevance === 'medium') entry.medium++
        else entry.low++
        themes.set(t.name, entry)
      }
    }
    if (s.analysis?.sentiment?.overall) {
      const key = s.analysis.sentiment.overall as keyof typeof sentiment
      if (key in sentiment) sentiment[key]++
    }
    if (s.analysis?.policy_positions) {
      for (const p of s.analysis.policy_positions) {
        topicCounts.set(p.topic, (topicCounts.get(p.topic) || 0) + 1)
      }
    }
  }

  const themeList = [...themes.entries()]
    .map(([theme, stats]) => ({
      theme,
      ...stats,
      highPct: stats.count > 0 ? Math.round((stats.high / stats.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const emergingTopics = [...topicCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Per-country summary — latest session only for each country
  const countries = [...countrySpeechMap.entries()].map(([iso3, speeches]) => {
    const info = countryLookup.get(iso3)
    // speeches are already sorted by year desc
    const latestSession = speeches[0]?.session
    const latestSpeeches = speeches.filter(s => s.session === latestSession)
    return {
      iso3,
      iso2: info?.iso2 || '',
      name: info?.name || iso3,
      speechCount: speeches.length,
      speeches: latestSpeeches.map(s => ({
        session: s.session,
        year: s.year,
        speaker: s.speaker,
        speaker_title: s.speaker_title,
        word_count: s.word_count,
        keywords: s.keywords,
        analysis: s.analysis || null,
      })),
    }
  }).sort((a, b) => b.speechCount - a.speechCount)

  return {
    available: true,
    totalSpeeches: allSpeeches.length,
    membersWithSpeeches: countrySpeechMap.size,
    totalMembers: iso3Codes.size,
    themes: themeList,
    sentiment,
    emergingTopics,
    countries,
  }
})
