import { getHrcElections } from '~/server/utils/un-elections'

/** Human Rights Council: members by regional group with term ends, the latest October election (votes vs the absolute majority of 97) and the next election's candidates. */
export default defineEventHandler(() => {
  const data = getHrcElections()
  if (!data) throw createError({ statusCode: 503, statusMessage: 'UN election data is not loaded yet' })
  return data
})
