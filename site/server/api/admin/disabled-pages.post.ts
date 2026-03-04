import { setDisabledPages } from '~/server/utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const pages = Array.isArray(body.pages) ? body.pages.filter((p: any) => typeof p === 'string') : []
  setDisabledPages(pages)
  return { ok: true, pages }
})
