import { getSaid, SAID_SECTIONS } from '~/server/utils/said'

/** Notable quotes of the day and week for a section: ?section=un|budget|leadership */
export default defineEventHandler((event) => {
  const section = String(getQuery(event).section || 'un')
  if (!(section in SAID_SECTIONS)) throw createError({ statusCode: 400, statusMessage: 'Unknown section' })
  return getSaid(section) || { today: null, week: null }
})
