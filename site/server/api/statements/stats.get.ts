import { getStatementsFeedStats } from '~/server/utils/statements-feed'

export default defineEventHandler(() => {
  return getStatementsFeedStats()
})
