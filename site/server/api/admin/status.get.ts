import { getSession } from '~/server/utils/auth'

export default defineEventHandler((event) => {
  const session = getSession(event)
  return {
    authenticated: !!session && session.user.role === 'admin',
  }
})
