import { getNewsFeedStats } from '~/server/utils/news-feed'

export default defineEventHandler(() => {
  return getNewsFeedStats()
})
