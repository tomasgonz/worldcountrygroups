import { getNewsConfig } from '~/server/utils/news-config'

export default defineEventHandler(() => {
  const config = getNewsConfig()
  return { sources: config.sources, maxArticles: config.maxArticles }
})
