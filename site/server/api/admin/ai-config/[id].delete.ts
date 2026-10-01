import { requireAdmin } from '~/server/utils/auth'
import { removeProvider } from '~/server/utils/ai-config'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing provider id' })
  removeProvider(id)
  return { ok: true }
})
