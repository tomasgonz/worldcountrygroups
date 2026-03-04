import { getUserById, updateUser } from '~/server/utils/users'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!
  const user = getUserById(id)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  // Toggle: if suspended, unsuspend (restore to approved); if approved, suspend
  const newStatus = user.status === 'suspended' ? 'approved' : 'suspended'
  updateUser(id, { status: newStatus })
  return { ok: true, status: newStatus }
})
