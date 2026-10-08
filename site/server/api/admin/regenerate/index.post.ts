import { requireAdmin } from '~/server/utils/auth'
import { regenerate } from '~/server/utils/regenerate'

/** { id } → start that job or AI task now */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = String((await readBody(event))?.id || '')
  try {
    return regenerate(id)
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Could not start it' })
  }
})
