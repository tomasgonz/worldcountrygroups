import { getUsers } from '~/server/utils/users'

export default defineEventHandler(() => {
  const users = getUsers()
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    approvedAt: u.approvedAt,
    approvedBy: u.approvedBy,
  }))
})
