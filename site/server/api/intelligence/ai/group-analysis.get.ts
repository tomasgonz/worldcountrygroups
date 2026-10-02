import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildGroupTrendsPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const gid = (query.gid as string || '').toLowerCase()
  if (!gid) throw createError({ statusCode: 400, statusMessage: 'Missing gid parameter' })

  const force = query.force === 'true'
  const cacheKey = `group:${gid}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  const cookie = getRequestHeader(event, 'cookie') || ''
  const groupData = await $fetch('/api/intelligence/group-trends', { query: { gid }, headers: { cookie } })
  const messages = buildGroupTrendsPrompt(groupData)
  const content = await callLLM(messages, { task: 'group-analysis', task: 'group-analysis' })

  const provider = getProviderForTask('group-analysis')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
