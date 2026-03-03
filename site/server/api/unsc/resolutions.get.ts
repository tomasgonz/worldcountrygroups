import { getUNSCResolutions } from '~/server/utils/unsc-votes'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = query.page ? parseInt(query.page as string, 10) : 1
  const limit = query.limit ? parseInt(query.limit as string, 10) : 20
  const search = (query.search as string) || undefined
  const vetoed_only = query.vetoed_only === 'true'

  return getUNSCResolutions({ page, limit, search, vetoed_only })
})
