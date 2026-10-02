import { requireAdmin } from '~/server/utils/auth'
import { setPrices } from '~/server/utils/ai-usage'

/** Save model prices (USD per million tokens) used to estimate cost. */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  return { ok: true, prices: setPrices(body?.prices || {}) }
})
