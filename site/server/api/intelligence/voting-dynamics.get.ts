import { votingDynamics, groupLoyalty } from '~/server/utils/voting-dynamics'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const sessions = Math.min(10, Math.max(1, parseInt(q.sessions as string) || 5))
  const gap = Math.min(30, Math.max(3, parseInt(q.gap as string) || 10))
  const threshold = Math.min(0.97, Math.max(0.6, parseFloat(q.threshold as string) || 0.85))
  if (q.group) {
    const r = groupLoyalty(String(q.group), sessions)
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Unknown group' })
    return r
  }
  return votingDynamics({ sessions, gap, threshold })
})
