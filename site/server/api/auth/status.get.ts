import { getSession } from '~/server/utils/auth'
import { getSiteMode, getDisabledPages } from '~/server/utils/users'
import { shareFromEvent } from '~/server/utils/share-links'

export default defineEventHandler((event) => {
  const session = getSession(event)
  const siteMode = getSiteMode()
  const disabledPages = getDisabledPages()

  if (!session) {
    const share = shareFromEvent(event)
    return {
      authenticated: false,
      siteMode,
      disabledPages,
      share: share ? { path: share.path, label: share.label, expiresAt: share.expiresAt } : null,
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
