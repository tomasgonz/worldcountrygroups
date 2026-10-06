import { requireAuth } from '~/server/utils/auth'
import { saveSettings, getSettings } from '~/server/utils/alerts'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  saveSettings(userId, (await readBody(event)) || {})
  return { settings: getSettings(userId) }
})
