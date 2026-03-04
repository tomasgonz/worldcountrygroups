import { getThemeAggregation, getConflictMentions, getSentimentDistribution } from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const session = query.session ? Number(query.session) : undefined

  return {
    themes: getThemeAggregation(session),
    conflicts: getConflictMentions(session),
    sentiment: getSentimentDistribution(session),
  }
})
