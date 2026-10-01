import { getCountryConflict } from '~/server/utils/conflict'
import { getCountrySanctions } from '~/server/utils/sanctions'
import { getCountryNews } from '~/server/utils/news-feed'
import { getCachedAnalysis } from '~/server/utils/ai-cache'
import { getCountryData } from '~/server/utils/countrydata'
import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const codesParam = (query.codes as string) || ''
  if (!codesParam) return { countries: [] }

  const codes = codesParam.split(',').map(c => c.trim().toUpperCase()).filter(Boolean).slice(0, 20)
  const registry = getRegistry()

  const countries = codes.map(iso3 => {
    const membership = registry.getCountryMembership(iso3)
    const countryData = getCountryData(iso3)
    const name = membership?.name || countryData?.name || iso3
    const iso2 = membership?.iso2 || countryData?.iso2 || ''

    // Conflict
    let conflictIntensity = 'none'
    try {
      const conflict = getCountryConflict(iso3)
      if (conflict) conflictIntensity = conflict.conflict_intensity || 'none'
    } catch {}

    // Sanctions
    let sanctionsCount = 0
    try {
      const sanctions = getCountrySanctions(iso3)
      sanctionsCount = sanctions?.length || 0
    } catch {}

    // News
    let newsCount = 0
    let latestHeadline = ''
    let latestUrl = ''
    try {
      const news = getCountryNews(iso3, 5)
      newsCount = news?.length || 0
      if (news?.length) {
        latestHeadline = news[0].title
        latestUrl = news[0].url
      }
    } catch {}

    // Cached AI content
    let riskScore: string | null = null
    let briefingSnippet: string | null = null
    try {
      const cached = getCachedAnalysis(`risk:${iso3}`)
      if (cached?.content) {
        const match = cached.content.match(/(\d+)\/100/)
        if (match) riskScore = match[1]
      }
    } catch {}
    try {
      const cached = getCachedAnalysis(`country:${iso3}`)
      if (cached?.content) {
        briefingSnippet = cached.content.slice(0, 200)
      }
    } catch {}

    return {
      iso3,
      iso2,
      name,
      region: countryData?.region || null,
      conflictIntensity,
      sanctionsCount,
      newsCount,
      latestHeadline,
      latestUrl,
      riskScore,
      briefingSnippet,
    }
  })

  return { countries }
})
