import { getSession } from '~/server/utils/auth'
import { getSiteMode, getDisabledPages } from '~/server/utils/users'

export default defineEventHandler((event) => {
  const session = getSession(event)
  const siteMode = getSiteMode()
  const disabledPages = getDisabledPages()

  if (!session) {
    return {
      authenticated: false,
      siteMode,
      disabledPages,
    }
  }

  return {
    authenticated: true,
    userId: session.user.id,
    username: session.user.username,
    displayName: session.user.displayName,
    role: session.user.role,
    status: session.user.status,
    siteMode,
    disabledPages,
  }
})
