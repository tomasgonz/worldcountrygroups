import {
  getNewsSources,
  addNewsSource,
  updateNewsSource,
  removeNewsSource,
  setNewsSourceEnabled,
} from '~/server/utils/news-config'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { action } = body

  if (action === 'add') {
    const { source } = body
    if (!source?.id || !source?.name || !source?.url) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required source fields (id, name, url)' })
    }
    addNewsSource({
      id: source.id,
      name: source.name,
      url: source.url,
      type: source.type || 'rss',
      enabled: source.enabled ?? true,
      category: source.category || 'wire',
      lastFetch: null,
      lastError: null,
      articleCount: 0,
    })
    return { ok: true, sources: getNewsSources() }
  }

  if (action === 'update') {
    const { id, ...fields } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })
    const { action: _a, ...update } = fields
    updateNewsSource(id, update)
    return { ok: true, sources: getNewsSources() }
  }

  if (action === 'toggle') {
    const { id, enabled } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })
    setNewsSourceEnabled(id, !!enabled)
    return { ok: true, sources: getNewsSources() }
  }

  if (action === 'remove') {
    const { id } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })
    removeNewsSource(id)
    return { ok: true, sources: getNewsSources() }
  }

  if (action === 'test-reliefweb') {
    // Check an appname against the live ReliefWeb API (approval is required since Nov 2025)
    const appname = String(body.appname || '').trim()
    if (!appname) throw createError({ statusCode: 400, statusMessage: 'Enter the appname ReliefWeb approved' })
    try {
      const r = await fetch(`https://api.reliefweb.int/v2/reports?appname=${encodeURIComponent(appname)}&limit=3&sort[]=date.created:desc&fields[include][]=title`)
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok || j.error) return { ok: false, message: j?.error?.message || `HTTP ${r.status}` }
      return { ok: true, message: `Approved: ${j.totalCount?.toLocaleString?.() ?? ''} reports available`, sample: (j.data || []).map((d: any) => d.fields?.title).filter(Boolean) }
    } catch (e: any) {
      return { ok: false, message: String(e?.message || e) }
    }
  }

  if (action === 'test') {
    const { url } = body
    if (!url) throw createError({ statusCode: 400, statusMessage: 'Missing URL to test' })
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'WCG-NewsFetcher/1.0' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
      const text = await response.text()
      const isXml = text.trimStart().startsWith('<')
      const isJson = text.trimStart().startsWith('{') || text.trimStart().startsWith('[')
      return {
        ok: true,
        contentType: response.headers.get('content-type') || 'unknown',
        format: isXml ? 'xml' : isJson ? 'json' : 'unknown',
        size: text.length,
        preview: text.slice(0, 500),
      }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to fetch URL' }
    }
  }

  throw createError({ statusCode: 400, statusMessage: `Unknown action: ${action}` })
})
