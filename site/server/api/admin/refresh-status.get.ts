import { requireAdmin } from '~/server/utils/auth'
import { getRefreshStatus, getUNRefreshStatus, getThemeRefreshStatus, getGDELTRefreshStatus, getSpeechesRefreshStatus } from '~/server/utils/data-fetcher'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return {
    country: getRefreshStatus(),
    unvotes: getUNRefreshStatus(),
    themes: getThemeRefreshStatus(),
    gdelt: getGDELTRefreshStatus(),
    speeches: getSpeechesRefreshStatus(),
  }
})
