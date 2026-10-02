import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildBilateralPrepPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const a = (query.a as string || '').toUpperCase()
  const b = (query.b as string || '').toUpperCase()
  if (!a || !b) throw createError({ statusCode: 400, statusMessage: 'Missing a and b parameters' })

  const force = query.force === 'true'
  const sorted = [a, b].sort()
  const cacheKey = `bilateral:${sorted[0]}-${sorted[1]}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  const cookie = getRequestHeader(event, 'cookie') || ''
  const bilateralData = await $fetch('/api/intelligence/bilateral-prep', { query: { a, b }, headers: { cookie } })
  const messages = buildBilateralPrepPrompt(bilateralData)
  const content = await callLLM(messages, { task: 'bilateral-analysis' })

  const provider = getProviderForTask('bilateral-analysis')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
