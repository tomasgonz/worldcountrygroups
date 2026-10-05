import { requireAdmin } from '~/server/utils/auth'
import { getPolicy, getPolicyHistory } from '~/server/utils/privacy-policy'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return { current: getPolicy(), history: getPolicyHistory() }
})
