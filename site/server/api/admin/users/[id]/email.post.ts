import { requireAdmin } from '~/server/utils/auth'
import { getUserById, updateUser } from '~/server/utils/users'

/** Set a user's email address (used for digests and data alerts). */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = getRouterParam(event, 'id')
  if (!id || !getUserById(id)) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  const email = String((await readBody(event))?.email || '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw createError({ statusCode: 400, statusMessage: 'That is not a valid email address' })
  updateUser(id, { email })
  return { ok: true, email }
})
