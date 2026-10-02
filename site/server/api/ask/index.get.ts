import { requireAuth } from '~/server/utils/auth'
import { listAsks, staleDatasets } from '~/server/utils/ask-runner'

/** The question log: your own questions plus those others shared. */
export default defineEventHandler((event) => {
  const { user } = requireAuth(event)
  const q = String(getQuery(event).q || '').toLowerCase()
  const scope = String(getQuery(event).scope || 'mine')
  return listAsks()
    .filter(a => (scope === 'shared' ? a.shared : a.userId === user.id || (user.role === 'admin' && scope === 'all')))
    .filter(a => !q || a.question.toLowerCase().includes(q))
    .slice(0, 200)
    .map(a => ({
      id: a.id, question: a.question, mode: a.mode, template: a.template, createdAt: a.createdAt, status: a.status,
      userName: a.userName, mine: a.userId === user.id, shared: a.shared, model: a.model,
      review: a.review?.status || null, stale: a.status === 'done' ? staleDatasets(a).length > 0 : false,
    }))
})
