import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildCompareAnalysisPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const mode = query.mode as string || 'groups'
  const identifiers = (query.identifiers as string || '').split(',').map(s => s.trim()).filter(Boolean)
  if (identifiers.length < 2) throw createError({ statusCode: 400, statusMessage: 'Need at least 2 identifiers' })

  const force = query.force === 'true'
  const sortedIds = [...identifiers].sort().join('-')
  const cacheKey = `compare:${mode}:${sortedIds}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  // Fetch comparison data
  const cookie = getRequestHeader(event, 'cookie') || ''
  let comparison: any
  let entities: any[]

  if (mode === 'countries') {
    comparison = await $fetch<any>('/api/countries/compare', { query: { countries: identifiers.join(',') }, headers: { cookie } })
    entities = (comparison as any[]).map((c: any) => ({ label: c.name, iso2: c.iso2 }))
  } else {
    comparison = await $fetch<any>('/api/groups/compare', { query: { groups: identifiers.join(',') }, headers: { cookie } })
    entities = comparison.groups?.map((g: any) => ({ label: g.acronym, name: g.name })) || []
  }

  const messages = buildCompareAnalysisPrompt({ mode, entities, comparison })
  const content = await callLLM(messages, { task: 'compare-analysis', task: 'compare-analysis' })

  const provider = getProviderForTask('compare-analysis')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
