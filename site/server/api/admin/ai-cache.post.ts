import { clearAnalysisCache, setAnalysisCacheMaxAge } from '~/server/utils/ai-cache'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const action = body?.action as string

  switch (action) {
    case 'set-max-age': {
      const hours = Number(body.hours)
      if (!hours || hours < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid hours value' })
      setAnalysisCacheMaxAge(hours)
      return { ok: true }
    }
    case 'clear-all':
      clearAnalysisCache()
      return { ok: true }
    case 'clear-entry': {
      const key = body.key as string
      if (!key) throw createError({ statusCode: 400, statusMessage: 'Missing key' })
      clearAnalysisCache(key)
      return { ok: true }
    }
    default:
      throw createError({ statusCode: 400, statusMessage: `Unknown action: ${action}` })
  }
})
