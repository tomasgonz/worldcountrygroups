import { isAdminRequest } from '~/server/utils/request-role'
import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildAnomalyDetectionPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { getConflictHotspots } from '~/server/utils/conflict'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  // regenerating costs money: only admins may force it
  const force = query.force === 'true' && isAdminRequest(event)
  const cacheKey = 'anomalies:global'

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  const conflictHotspots = getConflictHotspots()

  const data = {
    conflictHotspots,
  }

  const messages = buildAnomalyDetectionPrompt(data)
  const content = await callLLM(messages, { task: 'anomalies' })

  const provider = getProviderForTask('anomalies')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
