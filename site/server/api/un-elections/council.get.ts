import { getCouncilElections } from '~/server/utils/un-elections'

/** Security Council elections: composition, latest election results by round, next election candidates, history and terms per country. */
export default defineEventHandler(() => {
  const data = getCouncilElections()
  if (!data) throw createError({ statusCode: 503, statusMessage: 'UN election data is not loaded yet' })
  return data
})
