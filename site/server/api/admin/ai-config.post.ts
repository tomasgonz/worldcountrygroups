import { requireAdmin } from '~/server/utils/auth'
import { addProvider, updateProvider, setActiveProvider, setPromptConfig, setPulseStyleConfig } from '~/server/utils/ai-config'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)

  if (body.action === 'add') {
    const { id, name, type, apiKey, baseUrl, model, maxTokens, temperature } = body.provider
    if (!id || !name || !type || !apiKey || !model) {
      throw createError({ statusCode: 400, message: 'Missing required provider fields' })
    }
    addProvider({
      id, name, type, apiKey, model,
      baseUrl: baseUrl || undefined,
      maxTokens: maxTokens || undefined,
      temperature: temperature ?? undefined,
      enabled: true,
    })
    return { ok: true }
  }

  if (body.action === 'update') {
    if (!body.id || !body.updates) {
      throw createError({ statusCode: 400, message: 'Missing id or updates' })
    }
    updateProvider(body.id, body.updates)
    return { ok: true }
  }

  if (body.action === 'set-active') {
    setActiveProvider(body.id ?? null)
    return { ok: true }
  }

  if (body.action === 'save-prompts') {
    setPromptConfig(body.prompts || {})
    return { ok: true }
  }

  if (body.action === 'save-pulse-style') {
    const { tone, temperature, speakerStyleAdherence } = body.style || {}
    const validTones = ['formal-diplomatic', 'analytical', 'journalistic']
    const update: any = {}
    if (tone && validTones.includes(tone)) update.tone = tone
    if (temperature !== undefined && typeof temperature === 'number') update.temperature = temperature
    if (speakerStyleAdherence !== undefined && typeof speakerStyleAdherence === 'number') update.speakerStyleAdherence = speakerStyleAdherence
    setPulseStyleConfig(update)
    return { ok: true }
  }

  throw createError({ statusCode: 400, message: 'Unknown action' })
})
