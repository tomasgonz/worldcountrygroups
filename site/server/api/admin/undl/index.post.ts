import { requireAdmin } from '~/server/utils/auth'
import { setUndlKey, testUndl } from '~/server/utils/undl'

/** { key } saves (empty removes); { test: true } runs one read request against the Voting Data collection. */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const b = await readBody(event)
  try {
    if (b?.test) return await testUndl()
    return setUndlKey(b?.key ?? null)
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e.message })
  }
})
