import { getIcjElections } from '~/server/utils/un-elections'

/** International Court of Justice: judges with roles and term ends, the latest triennial election (General Assembly and Security Council rounds), by-elections and the next election's candidates. */
export default defineEventHandler(() => {
  const data = getIcjElections()
  if (!data) throw createError({ statusCode: 503, statusMessage: 'UN election data is not loaded yet' })
  return data
})
