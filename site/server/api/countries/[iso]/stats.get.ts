import { fetchCountryStats } from '~/server/utils/worldbank'

export default defineEventHandler(async (event) => {
  const iso = getRouterParam(event, 'iso')!
  return await fetchCountryStats(iso)
})
