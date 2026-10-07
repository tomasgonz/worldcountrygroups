import { payers, session, budgetNews, un80 } from '~/server/utils/un-budget'

/** UN budget, reform and the Fifth Committee. ?topic=fifth|reform|budget&official=1&q= for the news list. */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const s = session()
  if (!s) return { available: false }
  return {
    available: true, session: s, payers: payers(), un80: un80(),
    news: budgetNews({ topic: q.topic ? String(q.topic) : null, official: q.official === '1', q: q.q ? String(q.q).slice(0, 80) : null, limit: 80 }),
  }
})
