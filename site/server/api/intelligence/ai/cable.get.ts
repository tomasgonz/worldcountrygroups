import { isAIConfigured, getAIStatus, callLLM } from '~/server/utils/llm-client'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { buildDiplomaticCablePrompt } from '~/server/utils/ai-prompts'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, message: 'AI provider not configured' })
  }

  const query = getQuery(event)
  const type = (query.type as string) || 'country'
  const iso = ((query.iso as string) || '').toUpperCase()
  const a = ((query.a as string) || '').toUpperCase()
  const b = ((query.b as string) || '').toUpperCase()
  const force = query.force === 'true'

  // Build cache key
  let cacheKey: string
  if (type === 'bilateral') {
    if (!a || !b) throw createError({ statusCode: 400, message: 'a and b parameters required for bilateral cable' })
    const sorted = [a, b].sort()
    cacheKey = `cable:bilateral:${sorted[0]}-${sorted[1]}`
  } else {
    if (!iso) throw createError({ statusCode: 400, message: 'iso parameter required for country cable' })
    cacheKey = `cable:country:${iso}`
  }

  // Check cache
  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  // Fetch briefing data
  let briefingData: any
  if (type === 'bilateral') {
    briefingData = await $fetch('/api/intelligence/bilateral-prep', { query: { a, b } })
  } else {
    briefingData = await $fetch('/api/intelligence/country-briefing', { query: { iso } })
  }

  // Build prompt and call LLM
  const messages = buildDiplomaticCablePrompt({ type: type as 'country' | 'bilateral', briefingData })
  const content = await callLLM(messages, { task: 'cable', maxTokens: 4000 })

  const status = getAIStatus()
  setCachedAnalysis(cacheKey, content, status.provider || 'unknown', 'default')

  return {
    cached: false,
    content,
    generatedAt: new Date().toISOString(),
    provider: status.provider,
    model: 'default',
  }
})
