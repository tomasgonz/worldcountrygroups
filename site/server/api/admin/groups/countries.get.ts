import { requireAdmin } from '~/server/utils/auth'
import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return getRegistry().getAllCountries()
})
