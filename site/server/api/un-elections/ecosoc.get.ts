import { getEcosocElections } from '~/server/utils/un-elections'

/** ECOSOC: members with term ends, the latest June election and the seats up at the next one. */
export default defineEventHandler(() => {
  const data = getEcosocElections()
  if (!data) throw createError({ statusCode: 503, statusMessage: 'UN election data is not loaded yet' })
  return data
})
