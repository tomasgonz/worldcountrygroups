import { requireAdmin } from '~/server/utils/auth'
import { addProvider, updateProvider, setActiveProvider, setPromptConfig, setPulseStyleConfig, getAIConfig, setTaskModels } from '~/server/utils/ai-config'
import { callLLM } from '~/server/utils/llm-client'

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
    // Only editable fields; a blank or masked key ("sk-p...1234") keeps the stored key
    const u = body.updates
    const updates: Record<string, any> = {}
    for (const k of ['name', 'model', 'baseUrl', 'enabled']) if (u[k] !== undefined) updates[k] = u[k]
    if (u.temperature !== undefined) updates.temperature = u.temperature === '' || u.temperature === null ? undefined : Number(u.temperature)
    if (u.maxTokens !== undefined) updates.maxTokens = u.maxTokens === '' || u.maxTokens === null ? undefined : Number(u.maxTokens)
    if (typeof u.apiKey === 'string' && u.apiKey.trim() && !u.apiKey.includes('...')) updates.apiKey = u.apiKey.trim()
    if (updates.model !== undefined && !String(updates.model).trim()) {
      throw createError({ statusCode: 400, message: 'Model cannot be empty' })
    }
    updateProvider(body.id, updates)
    return { ok: true }
  }

  if (body.action === 'duplicate') {
    // Add another model that reuses an existing provider's API key (the key never leaves the server)
    const src = getAIConfig().providers.find(p => p.id === body.sourceId)
    if (!src) throw createError({ statusCode: 404, message: 'Source provider not found' })
    const model = String(body.model || '').trim()
    if (!model) throw createError({ statusCode: 400, message: 'Choose a model' })
    const ids = new Set(getAIConfig().providers.map(p => p.id))
    let id = `${src.type}-${model}`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
    for (let i = 2; ids.has(id); i++) id = `${src.type}-${model}-${i}`.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
    addProvider({ ...src, id, name: String(body.name || '').trim() || `${src.name.split(' ')[0]} ${model}`, model, enabled: true })
    if (body.activate) setActiveProvider(id)
    return { ok: true, id }
  }

  if (body.action === 'test') {
    const p = getAIConfig().providers.find(x => x.id === body.id)
    if (!p) throw createError({ statusCode: 404, message: 'Provider not found' })
    const started = Date.now()
    try {
      // Reasoning models spend tokens before answering, so allow some room
      const reply = await callLLM([{ role: 'user', content: 'Reply with exactly: OK' }], { provider: p, maxTokens: 2000 })
      return { ok: !!reply?.trim(), reply: (reply || '').trim().slice(0, 120), ms: Date.now() - started, model: p.model }
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e).slice(0, 300), ms: Date.now() - started, model: p.model }
    }
  }

  if (body.action === 'set-active') {
    setActiveProvider(body.id ?? null)
    return { ok: true }
  }

  if (body.action === 'save-task-models') {
    setTaskModels(body.taskModels || {})
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
