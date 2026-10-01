import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getActiveProvider } from '~/server/utils/ai-config'
import { buildRiskScorePrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const iso = (query.iso as string || '').toUpperCase()
  if (!iso) throw createError({ statusCode: 400, statusMessage: 'Missing iso parameter' })

  const force = query.force === 'true'
  const cacheKey = `risk:${iso}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  // Fetch country briefing data
  const cookie = getRequestHeader(event, 'cookie') || ''
  const briefingData = await $fetch<any>('/api/intelligence/country-briefing', { query: { iso }, headers: { cookie } })

  const messages = buildRiskScorePrompt(briefingData)
  const content = await callLLM(messages)

  const provider = getActiveProvider()!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
