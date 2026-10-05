import { newsAnalysis, type AnalysisFilters } from '~/server/utils/news-analysis'

/** Stories, rising countries, topic momentum, regions and source mix for the News page. */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const f: AnalysisFilters = {
    days: Number(q.days) || 14,
    country: q.country ? String(q.country).toUpperCase().slice(0, 3) : undefined,
    topic: q.topic ? String(q.topic).slice(0, 30) : undefined,
    region: q.region ? String(q.region).slice(0, 60) : undefined,
    q: q.q ? String(q.q).slice(0, 100) : undefined,
    kind: q.kind === 'news' || q.kind === 'statement' ? q.kind : 'all',
  }
  return newsAnalysis(f)
})
