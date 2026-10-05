import { getSgSelection, getSgNews, getSgSummary } from '~/server/utils/sg-selection'

/**
 * UN Secretary-General selection tracker: official nominees, process timeline, dialogues,
 * Security Council straw polls (leaked tallies), "also mentioned" names (not candidates) and news.
 * Query: candidate (id, name or surname) filters the news stream; news_limit (default 120).
 */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const d = getSgSelection()
  if (!d) throw createError({ statusCode: 503, statusMessage: 'Secretary-General selection data is not available yet' })
  const candidate = typeof q.candidate === 'string' && q.candidate.trim() ? q.candidate.trim() : null
  const n = Number(q.news_limit)
  const limit = Number.isFinite(n) && n > 0 ? Math.min(n, 400) : 120
  return {
    ...d,
    summary: getSgSummary(),
    news: getSgNews({ candidate, limit }),
  }
})
