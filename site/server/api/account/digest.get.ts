import { requireAuth } from '~/server/utils/auth'
import { getUserPreferences } from '~/server/utils/users'
import { getDigestState } from '~/server/utils/digest'

export default defineEventHandler((event) => {
  const { userId, user } = requireAuth(event)
  const prefs = getUserPreferences(userId)
  return {
    frequency: prefs.emailDigest ?? 'off',
    email: user.email || '',
    countries: prefs.bookmarkedCountries,
    ...getDigestState(userId),
  }
})
