import { isAIConfigured } from '~/server/utils/llm-client'
import { generateUNBriefing, cachedUNBriefing, splitBriefingSections } from '~/server/utils/un-briefing'

/** Council analysis for the UN Monitor: the stored copy (regenerated every 4 hours by the scheduler), or written now. */
export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }
  const force = getQuery(event).force === 'true'
  const cached = force ? null : cachedUNBriefing()
  if (cached) {
    return { cached: true, ...splitBriefingSections(cached.content), generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
  }
  try {
    const g = await generateUNBriefing()
    return { cached: false, ...splitBriefingSections(g.content), generatedAt: new Date().toISOString(), provider: g.provider, model: g.model }
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: e?.message || 'Could not write the analysis; try again' })
  }
})
