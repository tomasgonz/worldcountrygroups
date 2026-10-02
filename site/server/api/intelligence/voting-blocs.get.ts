import { detectVotingBlocs } from '~/server/utils/voting-blocs'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const sessions = Math.min(10, Math.max(1, parseInt(query.sessions as string) || 5))
  const threshold = Math.min(0.97, Math.max(0.6, parseFloat(query.threshold as string) || 0.85))
  return { ...detectVotingBlocs({ sessions, threshold }), threshold, sessions }
})
