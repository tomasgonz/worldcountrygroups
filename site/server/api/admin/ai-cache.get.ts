import { getAnalysisCacheStats } from '~/server/utils/ai-cache'

export default defineEventHandler(async (event) => {
  return getAnalysisCacheStats()
})
