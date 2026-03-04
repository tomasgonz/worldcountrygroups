import { getUserById, updateUser } from '~/server/utils/users'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, statusMessage: 'User ID required' })

  const user = getUserById(id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  updateUser(id, { status: 'rejected' })

  return { ok: true }
})
