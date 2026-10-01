import { getRecentNews, getCountryNews, getNewsFeedMeta } from '~/server/utils/news-feed'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const iso = (query.iso as string || '').toUpperCase()
  const limit = Math.min(Math.max(parseInt(query.limit as string) || 20, 1), 50)

  const articles = iso
    ? getCountryNews(iso, limit)
    : getRecentNews(limit)

  return {
    articles,
    meta: getNewsFeedMeta(),
  }
})
