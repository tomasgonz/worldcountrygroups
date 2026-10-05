import { newsStream, type AnalysisFilters } from '~/server/utils/news-analysis'

/** Every item (news and official statements), newest first, with the News page filters. */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const f: AnalysisFilters = {
    country: q.country ? String(q.country).toUpperCase().slice(0, 3) : undefined,
    topic: q.topic ? String(q.topic).slice(0, 30) : undefined,
    region: q.region ? String(q.region).slice(0, 60) : undefined,
    q: q.q ? String(q.q).slice(0, 100) : undefined,
    kind: q.kind === 'news' || q.kind === 'statement' ? q.kind : 'all',
  }
  return newsStream(f, Math.max(0, Number(q.offset) || 0), Math.min(100, Math.max(1, Number(q.limit) || 40)))
})
