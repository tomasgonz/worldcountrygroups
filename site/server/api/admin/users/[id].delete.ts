import { getSession } from '~/server/utils/auth'
import { getUserById, deleteUser } from '~/server/utils/users'

export default defineEventHandler((event) => {
  const session = getSession(event)
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'User ID required' })

  if (session?.userId === id) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete your own account' })
  }

  const user = getUserById(id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  deleteUser(id)

  return { ok: true }
})
