import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getActiveProvider } from '~/server/utils/ai-config'
import { buildSmartSearchPrompt } from '~/server/utils/ai-prompts'
import { getRegistry } from '~/server/utils/wcg'
import { getCountryData } from '~/server/utils/countrydata'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const q = (query.q as string || '').trim()
  if (!q) throw createError({ statusCode: 400, statusMessage: 'Missing q parameter' })

  const registry = getRegistry()
  const allGroups = registry.listGroups()
  const allCountries = registry.listCountries()

  // Find relevant countries and groups by searching query terms
  const terms = q.toLowerCase().split(/\s+/)
  const matchedCountries = allCountries
    .filter((c: any) => terms.some(t => c.name.toLowerCase().includes(t) || c.iso3.toLowerCase() === t || c.iso2.toLowerCase() === t))
    .slice(0, 5)
    .map((c: any) => {
      const membership = registry.getCountryMembership(c.iso3)
      const countryData = getCountryData(c.iso2)
      return {
        name: c.name,
        iso3: c.iso3,
        iso2: c.iso2,
        region: countryData?.region || null,
        population: countryData?.population || null,
        gdp: countryData?.gdp || null,
        groups: membership?.groups.map((g: any) => ({ acronym: g.acronym, name: g.name })).slice(0, 10) || [],
      }
    })

  const matchedGroups = allGroups
    .filter((g: any) => terms.some(t =>
      g.name.toLowerCase().includes(t) ||
      g.acronym.toLowerCase().includes(t) ||
      g.gid.includes(t)
    ))
    .slice(0, 5)
    .map((g: any) => ({
      acronym: g.acronym,
      name: g.name,
      country_count: g.country_count,
      domains: g.domains,
    }))

  const context = {
    countries: matchedCountries,
    groups: matchedGroups,
  }

  const messages = buildSmartSearchPrompt(q, context)
  const content = await callLLM(messages)

  const provider = getActiveProvider()!
  return { content, generatedAt: new Date().toISOString(), provider: provider.name }
})
