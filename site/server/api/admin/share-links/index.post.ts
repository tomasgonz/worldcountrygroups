import { requireAdmin } from '~/server/utils/auth'
import { createShareLink, linkStatus } from '~/server/utils/share-links'

/** Create a share link: { path, label?, expiresDays?, maxViews? } */
export default defineEventHandler(async (event) => {
  const { user } = requireAdmin(event)
  const b = await readBody(event)
  try {
    const link = createShareLink({ path: b?.path, label: b?.label, expiresDays: b?.expiresDays == null ? 30 : Number(b.expiresDays), maxViews: b?.maxViews ? Number(b.maxViews) : null, createdBy: user.displayName || user.username })
    return { link: { ...link, status: linkStatus(link) } }
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Could not create the link' })
  }
})
