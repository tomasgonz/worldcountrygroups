import { requireAuth } from '~/server/utils/auth'
import { getUserPreferences, updateUserPreferences } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const body = await readBody(event)

  const { type, id } = body || {}

  if (!type || !id || !['country', 'group'].includes(type)) {
    throw createError({ statusCode: 400, statusMessage: 'type (country|group) and id are required' })
  }

  const prefs = getUserPreferences(userId)
  const key = type === 'country' ? 'bookmarkedCountries' : 'bookmarkedGroups'
  const idx = prefs[key].indexOf(id)
  const added = idx === -1

  if (added) {
    prefs[key].push(id)
  } else {
    prefs[key].splice(idx, 1)
  }

  updateUserPreferences(userId, prefs)

  return { ok: true, added, type, id }
})
