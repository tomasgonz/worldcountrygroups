import { detectVotingBlocs } from '~/server/utils/voting-blocs'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const sessions = Math.min(10, Math.max(1, parseInt(query.sessions as string) || 5))
  const threshold = Math.min(0.95, Math.max(0.5, parseFloat(query.threshold as string) || 0.80))

  const result = detectVotingBlocs({ sessions, threshold })

  return {
    blocs: result.blocs,
    computedAt: result.computedAt,
    threshold,
    sessions,
  }
})
