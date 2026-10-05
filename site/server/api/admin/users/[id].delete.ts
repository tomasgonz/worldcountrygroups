import { getSession } from '~/server/utils/auth'
import { getUserById } from '~/server/utils/users'
import { eraseUser } from '~/server/utils/user-data'

export default defineEventHandler((event) => {
  const session = getSession(event)
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'User ID required' })

  if (session?.userId === id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete your own account' })
  }

  const user = getUserById(id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const r = eraseUser(id) // also removes their questions and digest records

  return { ok: true, ...r }
})
