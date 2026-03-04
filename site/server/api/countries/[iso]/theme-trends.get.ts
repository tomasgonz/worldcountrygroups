import { getRegistry } from '~/server/utils/wcg'
import { getCountryThemeTrends, getUNVotesMeta } from '~/server/utils/unvotes'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!
  const membership = getRegistry().getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: `Country '${iso}' not found` })
  }

  const meta = getUNVotesMeta()
  if (!meta) {
    return { available: false, trends: [] }
  }

  const trends = getCountryThemeTrends(membership.iso3)

  return { available: true, trends }
})
