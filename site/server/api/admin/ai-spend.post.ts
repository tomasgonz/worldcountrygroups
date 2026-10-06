import { requireAdmin } from '~/server/utils/auth'
import { saveSpendSettings, fetchBilled, checkBudget, spendSummary } from '~/server/utils/ai-spend'

/** { budget?, adminKey? } to save; { action: 'refresh' } to fetch billed costs from OpenAI now. */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const b = (await readBody(event)) || {}
  try {
    if (b.action === 'refresh') {
      const r = await fetchBilled()
      await checkBudget()
      return { refresh: r, summary: spendSummary() }
    }
    saveSpendSettings(b)
    let refresh: any = null
    if (b.adminKey) refresh = await fetchBilled()
    await checkBudget()
    return { refresh, summary: spendSummary() }
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Could not save' })
  }
})
