import {
  getStatementSources,
  addStatementSource,
  updateStatementSource,
  removeStatementSource,
  setStatementSourceEnabled,
} from '~/server/utils/statements-config'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { action } = body

  if (action === 'add') {
    const { source } = body
    if (!source?.id || !source?.name || !source?.url) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required source fields (id, name, url)' })
    }
    addStatementSource({
      id: source.id,
      name: source.name,
      url: source.url,
      type: source.type || 'rss',
      country: source.country || '',
      category: source.category || 'major-mission',
      enabled: source.enabled ?? true,
      scrapeConfig: source.scrapeConfig || undefined,
      lastFetch: null,
      lastError: null,
      statementCount: 0,
    })
    return { ok: true, sources: getStatementSources() }
  }

  if (action === 'update') {
    const { id, ...fields } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })
    const { action: _a, ...update } = fields
    updateStatementSource(id, update)
    return { ok: true, sources: getStatementSources() }
  }

  if (action === 'toggle') {
    const { id, enabled } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })
    setStatementSourceEnabled(id, !!enabled)
    return { ok: true, sources: getStatementSources() }
  }

  if (action === 'remove') {
    const { id } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing source id' })
    removeStatementSource(id)
    return { ok: true, sources: getStatementSources() }
  }

  if (action === 'test') {
    const { url } = body
    if (!url) throw createError({ statusCode: 400, statusMessage: 'Missing URL to test' })
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'WCG-StatementFetcher/1.0' },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` }
      }
      const text = await response.text()
      const isXml = text.trimStart().startsWith('<')
      const isHtml = /<html/i.test(text.slice(0, 500))
      return {
        ok: true,
        contentType: response.headers.get('content-type') || 'unknown',
        format: isHtml ? 'html' : isXml ? 'xml' : 'unknown',
        size: text.length,
        preview: text.slice(0, 500),
      }
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to fetch URL' }
    }
  }

  throw createError({ statusCode: 400, statusMessage: `Unknown action: ${action}` })
})
