import { requireAdmin } from '~/server/utils/auth'
import { savePolicy } from '~/server/utils/privacy-policy'

/** Save a new version of the privacy policy: { markdown, note? } */
export default defineEventHandler(async (event) => {
  const { user } = requireAdmin(event)
  const b = await readBody(event)
  try {
    return { current: savePolicy(b?.markdown, user.displayName || user.username, b?.note) }
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Could not save' })
  }
})
