import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getProviderForTask } from '~/server/utils/ai-config'
import { buildGroupSuggestionsPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { getRegistry } from '~/server/utils/wcg'
import { getCountryData } from '~/server/utils/countrydata'
import { getCountryVDem } from '~/server/utils/vdem'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const gid = (query.gid as string || '').toLowerCase()
  if (!gid) throw createError({ statusCode: 400, statusMessage: 'Missing gid parameter' })

  const force = query.force === 'true'
  const cacheKey = `suggestions:${gid}`

  if (!force) {
    const cached = getCachedAnalysis(cacheKey)
    if (cached) {
      return { cached: true, content: cached.content, generatedAt: cached.generatedAt, provider: cached.provider, model: cached.model }
    }
  }

  const registry = getRegistry()
  const group = registry.getGroup(gid)
  if (!group) throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })

  const memberIso3s = new Set(group.countries.map(c => c.iso3))
  const allCountries = registry.listCountries()

  // Find non-member candidates with basic data
  const candidates = allCountries
    .filter((c: any) => !memberIso3s.has(c.iso3))
    .slice(0, 30)
    .map((c: any) => {
      const countryData = getCountryData(c.iso2)
      const membership = registry.getCountryMembership(c.iso3)
      const vdem = getCountryVDem(c.iso3)
      // Find group overlaps: other groups this country is in that also have members of our group
      const groupOverlaps = membership?.groups
        .filter((g: any) => g.gid !== gid && group.countries.some((mc: any) => {
          const mm = registry.getCountryMembership(mc.iso3)
          return mm?.groups.some((mg: any) => mg.gid === g.gid)
        }))
        .map((g: any) => g.acronym)
        .slice(0, 5) || []

      return {
        name: c.name,
        iso3: c.iso3,
        region: countryData?.region || null,
        regime: vdem?.latest?.regime || null,
        groupOverlaps,
      }
    })

  const members = group.countries.map(c => ({ name: c.name, iso3: c.iso3 }))

  const messages = buildGroupSuggestionsPrompt({
    group: { name: group.name, acronym: group.acronym, description: group.description, domains: group.domains },
    members,
    candidates,
  })
  const content = await callLLM(messages, { task: 'group-suggestions' })

  const provider = getProviderForTask('group-suggestions')!
  setCachedAnalysis(cacheKey, content, provider.name, provider.model)

  return { cached: false, content, generatedAt: new Date().toISOString(), provider: provider.name, model: provider.model }
})
