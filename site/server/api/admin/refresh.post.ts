import { requireAdmin } from '~/server/utils/auth'
import { refreshAllData, refreshUNVotingData, refreshThemeClassification } from '~/server/utils/data-fetcher'

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

  // Default: refresh all three
  const [countryResult, unResult, themeResult] = await Promise.all([
    refreshAllData(),
    refreshUNVotingData(),
    refreshThemeClassification(),
  ])

  return {
    country_data: countryResult,
    un_votes: unResult,
    themes: themeResult,
  }
})
