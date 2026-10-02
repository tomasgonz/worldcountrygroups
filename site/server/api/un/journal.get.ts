import { getJournalDays, getJournalMeta } from '~/server/utils/upcoming'

/**
 * Official UN meetings programme from the Journal of the United Nations.
 *   ?location=New York | Geneva | all   (default New York)
 *   ?days=8                              today + the following days (max 14)
 *   ?public=true                         leave out closed meetings / consultations
 */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const loc = typeof q.location === 'string' ? q.location.replace(/-/g, ' ').trim() : ''
  const location = /^all$/i.test(loc) ? 'all' : /^geneva$/i.test(loc) ? 'Geneva' : 'New York'
  const days = q.days != null && !Number.isNaN(Number(q.days)) ? Number(q.days) : 8
  return {
    meta: getJournalMeta(),
    location,
    days: getJournalDays({ location, days, includeClosed: q.public === 'true' ? false : undefined }),
  }
})
