import { getElections, getElectionsMeta, getNextElection } from '~/server/utils/upcoming'

/**
 * National elections calendar (Wikipedia "national electoral calendar" pages, CC BY-SA).
 *   ?iso3=FRA          one country (also returns `next`, its next scheduled election)
 *   ?status=upcoming   upcoming | past | all (default all)
 *   ?days=60           only elections in the next N days
 *   ?direct=true       leave out indirect elections (e.g. by parliament)
 *   ?limit=50
 */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const iso3 = typeof q.iso3 === 'string' && /^[A-Za-z]{3}$/.test(q.iso3) ? q.iso3.toUpperCase() : undefined
  const status = q.status === 'upcoming' || q.status === 'past' ? q.status : 'all'
  const days = q.days != null && !Number.isNaN(Number(q.days)) ? Math.max(0, Math.min(Number(q.days), 800)) : undefined
  const limit = q.limit != null && !Number.isNaN(Number(q.limit)) ? Math.max(1, Math.min(Number(q.limit), 500)) : undefined
  const elections = getElections({
    iso3,
    status,
    withinDays: days,
    includeIndirect: q.direct === 'true' ? false : undefined,
    limit,
  })
  return {
    meta: getElectionsMeta(),
    next: iso3 ? getNextElection(iso3) : null,
    count: elections.length,
    elections,
  }
})
