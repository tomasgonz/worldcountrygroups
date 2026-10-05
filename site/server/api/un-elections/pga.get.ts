import { getPgaElections } from '~/server/utils/un-elections'

/** President of the General Assembly: current president, regional rotation, next election and the list of past presidents. */
export default defineEventHandler(() => {
  const data = getPgaElections()
  if (!data) throw createError({ statusCode: 503, statusMessage: 'UN election data is not loaded yet' })
  return data
})
