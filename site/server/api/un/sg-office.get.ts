import { sgOffice } from '~/server/utils/sg-office'

/** Secretary-General's appointments and statements. ?country=ISO3&category=&kind=&q=&more=1 */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const r = sgOffice({
    country: q.country ? String(q.country) : null, category: q.category ? String(q.category) : null,
    kind: q.kind ? String(q.kind) : null, q: q.q ? String(q.q).slice(0, 80) : null,
    statements: q.more ? 200 : 40, appointments: q.more ? 200 : 30,
  })
  if (!r) return { available: false }
  return { available: true, ...r }
})
