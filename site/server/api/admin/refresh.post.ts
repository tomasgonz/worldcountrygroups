import { requireAdmin } from '~/server/utils/auth'
import { refreshAllData, refreshUNVotingData, refreshThemeClassification, refreshGDELTData, refreshSpeechesData } from '~/server/utils/data-fetcher'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const query = getQuery(event)
  const target = (query.target as string) || 'all'

  if (target === 'unvotes') {
    return await refreshUNVotingData()
  }

  if (target === 'country') {
    return await refreshAllData()
  }

  if (target === 'themes') {
    return await refreshThemeClassification()
  }

  if (target === 'gdelt') {
    return await refreshGDELTData()
  }

  if (target === 'speeches') {
    return await refreshSpeechesData()
  }

  // Default: refresh all five
  const [countryResult, unResult, themeResult, gdeltResult, speechesResult] = await Promise.all([
    refreshAllData(),
    refreshUNVotingData(),
    refreshThemeClassification(),
    refreshGDELTData(),
    refreshSpeechesData(),
  ])

  return {
    country_data: countryResult,
    un_votes: unResult,
    themes: themeResult,
    gdelt: gdeltResult,
    speeches: speechesResult,
  }
})
