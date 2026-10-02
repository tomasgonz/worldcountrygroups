import { requireAuth } from '~/server/utils/auth'
import { listAsks, staleDatasets, canView } from '~/server/utils/ask-runner'

/** The question log, one row per conversation: your own, or those others shared. */
export default defineEventHandler((event) => {
  const { user } = requireAuth(event)
  const q = String(getQuery(event).q || '').toLowerCase()
  const scope = String(getQuery(event).scope || 'mine')
  const all = listAsks()
  const byThread = new Map<string, typeof all>()
  for (const a of all) {
    const t = a.threadId || a.id
    if (!byThread.has(t)) byThread.set(t, [])
    byThread.get(t)!.push(a)
  }
  const rows = []
  for (const [tid, turns] of byThread) {
    const root = turns.find(a => a.id === tid)
    if (!root) continue // the first question was deleted
    const visible = scope === 'shared' ? root.shared && canView(root, user)
      : scope === 'all' ? user.role === 'admin'
      : root.userId === user.id
    if (!visible) continue
    if (q && !turns.some(a => a.question.toLowerCase().includes(q))) continue
    const latest = turns.reduce((m, a) => (a.createdAt > m.createdAt ? a : m), root)
    rows.push({
      id: root.id, question: root.question, mode: root.mode, template: root.template, createdAt: root.createdAt,
      lastActivity: latest.createdAt, followUps: turns.length - 1, status: root.status,
      userName: root.userName, mine: root.userId === user.id, shared: root.shared, model: root.model,
      review: root.review?.status || null, stale: turns.some(a => a.status === 'done' && staleDatasets(a).length > 0),
    })
  }
  return rows.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)).slice(0, 200)
})
