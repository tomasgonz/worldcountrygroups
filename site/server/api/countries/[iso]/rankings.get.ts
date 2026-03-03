import { getRegistry } from '~/server/utils/wcg'
import { getCountriesData, getGroupStats } from '~/server/utils/countrydata'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!
  const registry = getRegistry()
  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: `Country '${iso}' not found` })
  }

  const countryIso2 = membership.iso2

  const rankings = membership.groups.map((groupSummary) => {
    const group = registry.getGroup(groupSummary.gid)!
    const iso2Codes = group.countries.map(c => c.iso2).filter(Boolean)

    const groupStats = getGroupStats(iso2Codes)
    const countriesMap = getCountriesData(iso2Codes)

    const entries = iso2Codes.map((code) => {
      const d = countriesMap.get(code.toUpperCase())
      return {
        iso2: code,
        gdp: d?.gdp ?? null,
        population: d?.population ?? null,
        co2: d?.co2 ?? null,
      }
    })

    function getRankAndValue(
      entries: { iso2: string; gdp: number | null; population: number | null; co2: number | null }[],
      field: 'gdp' | 'population' | 'co2',
      targetIso2: string,
      total: number | null
    ) {
      const sorted = entries
        .filter(e => e[field] !== null)
        .sort((a, b) => (b[field] as number) - (a[field] as number))
      const idx = sorted.findIndex(e => e.iso2 === targetIso2)
      if (idx === -1) return { value: null, pct: null, rank: null, of: sorted.length }
      const value = sorted[idx][field] as number
      const pct = total && total > 0 ? Math.round((value / total) * 10000) / 100 : null
      return { value, pct, rank: idx + 1, of: sorted.length }
    }

    return {
      gid: groupSummary.gid,
      acronym: groupSummary.acronym,
      name: groupSummary.name,
      country_count: groupSummary.country_count,
      gdp: getRankAndValue(entries, 'gdp', countryIso2, groupStats.gdp?.total ?? null),
      population: getRankAndValue(entries, 'population', countryIso2, groupStats.population?.total ?? null),
      co2: getRankAndValue(entries, 'co2', countryIso2, groupStats.co2?.total ?? null),
    }
  })

  return rankings
})
