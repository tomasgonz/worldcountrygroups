import { getDonorNews } from '~/server/utils/donors'

/** Donor news stream. Query: donor (ISO3, EU, OECD), topic, q, days, limit. */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : undefined }
  return getDonorNews({ donor: str(q.donor), topic: str(q.topic), q: str(q.q), days: num(q.days), limit: num(q.limit) ?? 60 })
})
