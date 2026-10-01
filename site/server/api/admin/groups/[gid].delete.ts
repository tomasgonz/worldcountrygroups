import { unlinkSync } from 'fs'
import { join } from 'path'
import { requireAdmin } from '~/server/utils/auth'
import { getRegistry, reloadRegistry, DATA_DIR } from '~/server/utils/wcg'

export default defineEventHandler((event) => {
  requireAdmin(event)
  const gid = getRouterParam(event, 'gid')
  if (!gid) {
    throw createError({ statusCode: 400, statusMessage: 'Missing group ID' })
  }

  const existing = getRegistry().getGroup(gid)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Group "${gid}" not found` })
  }

  unlinkSync(join(DATA_DIR, `${gid}.json`))
  reloadRegistry()

  return { ok: true, deleted: gid }
})
