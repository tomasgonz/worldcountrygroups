import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildSpeechSummaryPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { getCountrySpeeches, getSpeechText } from '~/server/utils/speeches'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const iso = (query.iso as string || '').toUpperCase()
  const session = parseInt(query.session as string || '0')
  if (!iso || !session) throw createError({ statusCode: 400, statusMessage: 'Missing iso or session parameter' })

  const force = query.force === 'true'
  const cacheKey = `speech:${iso}:${session}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  const text = getSpeechText(iso, session)
  if (!text) throw createError({ statusCode: 404, statusMessage: 'Speech text not found' })

  const speeches = getCountrySpeeches(iso)
  const meta = speeches.find(s => s.session === session)
  if (!meta) throw createError({ statusCode: 404, statusMessage: 'Speech metadata not found' })

  const messages = buildSpeechSummaryPrompt({
    text,
    meta,
    analysis: (meta as any).analysis || null,
  })
  const content = await callLLM(messages, { task: 'speech-summary', maxTokens: 4096 })

  const provider = getProviderForTask('speech-summary')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
