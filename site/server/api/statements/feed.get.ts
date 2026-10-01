import { getRecentStatements, getCountryStatements, getStatementsFeedMeta } from '~/server/utils/statements-feed'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const iso = (query.iso as string || '').toUpperCase()
  const type = (query.type as string || '').toLowerCase()
  const limit = Math.min(Math.max(parseInt(query.limit as string) || 20, 1), 100)

  let statements = iso
    ? getCountryStatements(iso, 500)
    : getRecentStatements(500)

  if (type) {
    statements = statements.filter(s => s.type === type)
  }

  statements = statements.slice(0, limit)

  return {
    statements,
    meta: getStatementsFeedMeta(),
  }
})
