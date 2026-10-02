import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildNewsBriefingPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { getCountryNews } from '~/server/utils/news-feed'
import { getRegistry } from '~/server/utils/wcg'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const iso = (query.iso as string || '').toUpperCase()
  if (!iso) throw createError({ statusCode: 400, statusMessage: 'Missing iso parameter' })

  const force = query.force === 'true'
  const cacheKey = `news-briefing:${iso}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  const articles = getCountryNews(iso, 10)
  if (!articles.length) {
    return { cached: false, content: '', generatedAt: new Date().toISOString(), provider: null, model: null }
  }

  const registry = getRegistry()
  const membership = registry.getCountryMembership(iso)
  const countryName = membership?.name || iso

  const messages = buildNewsBriefingPrompt({
    country: { name: countryName, iso3: iso, region: undefined },
    articles,
  })
  const content = await callLLM(messages, { task: 'news-briefing', task: 'news-briefing' })

  const provider = getProviderForTask('news-briefing')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
