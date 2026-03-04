import { setSiteMode } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const mode = body?.mode

  if (mode !== 'public' && mode !== 'restricted') {
    throw createError({ statusCode: 400, statusMessage: 'Mode must be "public" or "restricted"' })
  }

  setSiteMode(mode)
  return { ok: true, mode }
})
