import { requireAdmin } from '~/server/utils/auth'
import { getAIConfig } from '~/server/utils/ai-config'

/** Models available to a configured provider, fetched with its stored API key. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = String(getQuery(event).id || '')
  const p = getAIConfig().providers.find(x => x.id === id)
  if (!p) throw createError({ statusCode: 404, message: 'Provider not found' })

  try {
    if (p.type === 'anthropic') {
      const res = await fetch(`${p.baseUrl || 'https://api.anthropic.com'}/v1/models?limit=100`, {
        headers: { 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data: any = await res.json()
      return { models: (data.data || []).map((m: any) => ({ id: m.id, label: m.display_name || m.id, created: m.created_at || null })) }
    }
    const base = p.baseUrl || 'https://api.openai.com/v1'
    const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${p.apiKey}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data: any = await res.json()
    let models = (data.data || []).map((m: any) => ({ id: m.id, label: m.id, created: m.created ? new Date(m.created * 1000).toISOString() : null }))
    if (p.type === 'openai') {
      // keep text/chat models; drop embeddings, audio, image, moderation, realtime, etc.
      models = models.filter((m: any) => /^(gpt-|o\d|chatgpt)/.test(m.id)
        && !/(embed|audio|tts|transcribe|realtime|image|search|moderation|instruct|dall-e|whisper|codex)/.test(m.id))
    }
    models.sort((a: any, b: any) => (b.created || '').localeCompare(a.created || '') || a.id.localeCompare(b.id))
    return { models }
  } catch (e: any) {
    return { models: [], error: String(e?.message || e) }
  }
})
