import { getRegistry } from '~/server/utils/wcg'
import { getCountryVoteSummary, getUNVotesMeta } from '~/server/utils/unvotes'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!
  const membership = getRegistry().getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: `Country '${iso}' not found` })
  }

  const meta = getUNVotesMeta()
  if (!meta) {
    return { available: false, message: 'UN voting data not yet loaded. Trigger a data refresh.' }
  }

  const summary = getCountryVoteSummary(membership.iso3)

  return {
    available: true,
    country: { name: membership.name, iso2: membership.iso2, iso3: membership.iso3 },
    meta: {
      updated_at: meta.updated_at,
      total_resolutions: meta.total_resolutions,
    },
    sessions: summary?.sessions ?? {},
  }
})
