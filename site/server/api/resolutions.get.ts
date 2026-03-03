import { defineEventHandler, getQuery } from 'h3'
import { searchResolutions, getAvailableThemes, getThemeCounts } from '../utils/unvotes'

export default defineEventHandler((event) => {
  const query = getQuery(event)

  const page = query.page ? Number(query.page) : 1
  const limit = query.limit ? Number(query.limit) : 20
  const session = query.session ? Number(query.session) : undefined
  const search = (query.search as string) || undefined
  const theme = (query.theme as string) || undefined
  const countries = query.countries ? (query.countries as string).split(',').map(c => c.trim()).filter(Boolean) : undefined
  const groups = query.groups ? (query.groups as string).split(',').map(g => g.trim()).filter(Boolean) : undefined

  const result = searchResolutions({ page, limit, session, search, theme, countries, groups })

  return {
    available: result.meta.totalResolutions > 0,
    resolutions: result.resolutions,
    total: result.total,
    page: result.page,
    pages: result.pages,
    sessions: result.sessions,
    themes: getAvailableThemes(),
    theme_counts: getThemeCounts(),
    meta: result.meta,
  }
})
