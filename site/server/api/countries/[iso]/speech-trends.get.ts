import { getRegistry } from '~/server/utils/wcg'
import {
  getCountrySentimentBySession,
  getThemesByDecade,
  getCountryThemeProfile,
  getCountryMentionNetwork,
  getKeywordSessionTrend,
} from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const registry = getRegistry()

  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  const query = getQuery(event)
  const opts: { startYear?: number; endYear?: number } = {}
  if (query.startYear) opts.startYear = Number(query.startYear)
  if (query.endYear) opts.endYear = Number(query.endYear)

  return {
    sentimentTimeline: getCountrySentimentBySession(iso3, opts),
    themeHeatmap: getThemesByDecade(iso3),
    themeRadar: getCountryThemeProfile(iso3, opts),
    mentionNetwork: getCountryMentionNetwork(iso3, opts),
    keywordTrends: getKeywordSessionTrend(iso3, opts),
  }
})
