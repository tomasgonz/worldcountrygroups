import { isAuthenticated } from '~/server/utils/auth'
import { getDataMeta } from '~/server/utils/countrydata'

export default defineEventHandler((event) => {
  const authenticated = isAuthenticated(event)
  const meta = getDataMeta()

  return {
    authenticated,
    data_updated_at: meta?.updated_at ?? null,
    configured: !!(useRuntimeConfig().adminPassword),
  }
})
