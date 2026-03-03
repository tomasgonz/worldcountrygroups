import { getRegistry } from '~/server/utils/wcg'
import { getResolutionsForCountry, getUNVotesMeta } from '~/server/utils/unvotes'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!
  const membership = getRegistry().getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: `Country '${iso}' not found` })
  }

  const meta = getUNVotesMeta()
  if (!meta) {
    return { available: false, message: 'UN voting data not yet loaded.' }
  }

  const query = getQuery(event)
  const page = query.page ? parseInt(query.page as string, 10) : 1
  const limit = query.limit ? parseInt(query.limit as string, 10) : 20
  const search = (query.search as string) || undefined
  const theme = (query.theme as string) || undefined

  const data = getResolutionsForCountry(membership.iso3, { page, limit, search, theme })

  return {
    available: true,
    country: { name: membership.name, iso2: membership.iso2, iso3: membership.iso3 },
    ...data,
  }
})
