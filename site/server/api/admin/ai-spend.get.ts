import { requireAdmin } from '~/server/utils/auth'
import { spendSummary, spendByPerson } from '~/server/utils/ai-spend'
import { listAsks } from '~/server/utils/ask-runner'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return { ...spendSummary(), byPerson: spendByPerson(listAsks) }
})
