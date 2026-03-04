import { getRegistry } from '~/server/utils/wcg'
import { getGroupStats, getCountriesData } from '~/server/utils/countrydata'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const groupsParam = (query.groups as string) || ''
  const gids = groupsParam.split(',').map(g => g.trim().toLowerCase()).filter(Boolean)

  if (gids.length < 2 || gids.length > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Provide 2-5 comma-separated group IDs via ?groups=' })
  }

  const registry = getRegistry()
  const groups = gids.map(gid => {
    const group = registry.getGroup(gid)
    if (!group) {
      throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
    }
    return group
  })

  const statsResults = groups.map(g =>
    getGroupStats(g.countries.map(c => c.iso2).filter(Boolean))
  )

  // Compute extended stats per group
  const extendedStats = groups.map(g => {
    const iso2s = g.countries.map(c => c.iso2).filter(Boolean)
    const countriesMap = getCountriesData(iso2s)
    let gdpPerCapitaSum = 0, gdpPerCapitaWeight = 0
    let lifeExpSum = 0, lifeExpCount = 0
    let hdiSum = 0, hdiCount = 0
    let areaSum = 0
    let milPersonnel = 0
    let defBudget = 0

    for (const d of countriesMap.values()) {
      if (d.gdp_per_capita != null && d.population != null) {
        gdpPerCapitaSum += d.gdp_per_capita * d.population
        gdpPerCapitaWeight += d.population
      }
      if (d.life_expectancy != null) { lifeExpSum += d.life_expectancy; lifeExpCount++ }
      if (d.hdi != null) { hdiSum += d.hdi; hdiCount++ }
      if (d.area_km2 != null) { areaSum += d.area_km2 }
      if (d.military_expenditure != null) { defBudget += d.military_expenditure }
    }

    return {
      gdp_per_capita: gdpPerCapitaWeight > 0 ? Math.round(gdpPerCapitaSum / gdpPerCapitaWeight) : null,
      life_expectancy: lifeExpCount > 0 ? Math.round((lifeExpSum / lifeExpCount) * 10) / 10 : null,
      hdi: hdiCount > 0 ? Math.round((hdiSum / hdiCount) * 1000) / 1000 : null,
      area_km2: areaSum > 0 ? areaSum : null,
      defense_budget: defBudget > 0 ? defBudget : null,
    }
  })

  // Build ISO2-keyed country sets per group
  const countrySets = new Map<string, Set<string>>()
  for (const group of groups) {
    const isoSet = new Set(group.countries.map(c => c.iso2).filter(Boolean))
    countrySets.set(group.gid, isoSet)
  }

  // Country lookup by ISO2
  const iso2ToCountry = new Map<string, { name: string; iso2: string; iso3: string }>()
  for (const group of groups) {
    for (const c of group.countries) {
      if (c.iso2 && !iso2ToCountry.has(c.iso2)) {
        iso2ToCountry.set(c.iso2, { name: c.name, iso2: c.iso2, iso3: c.iso3 })
      }
    }
  }

  function isoListToCountries(isos: string[]) {
    return isos
      .map(iso => iso2ToCountry.get(iso))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name))
  }

  // Pairwise overlap
  const pairs: Record<string, any[]> = {}
  for (let i = 0; i < gids.length; i++) {
    for (let j = i + 1; j < gids.length; j++) {
      const setA = countrySets.get(gids[i])!
      const setB = countrySets.get(gids[j])!
      const shared = [...setA].filter(iso => setB.has(iso))
      pairs[`${gids[i]}:${gids[j]}`] = isoListToCountries(shared)
    }
  }

  // Common to ALL
  let commonIsos = [...countrySets.get(gids[0])!]
  for (let i = 1; i < gids.length; i++) {
    const s = countrySets.get(gids[i])!
    commonIsos = commonIsos.filter(iso => s.has(iso))
  }

  // Unique to each group
  const unique: Record<string, any[]> = {}
  for (const gid of gids) {
    const mine = countrySets.get(gid)!
    const others = gids.filter(g => g !== gid)
    const otherUnion = new Set<string>()
    for (const o of others) {
      for (const iso of countrySets.get(o)!) otherUnion.add(iso)
    }
    const exclusiveIsos = [...mine].filter(iso => !otherUnion.has(iso))
    unique[gid] = isoListToCountries(exclusiveIsos)
  }

  return {
    groups: groups.map((g, i) => ({
      gid: g.gid,
      acronym: g.acronym,
      name: g.name,
      domains: g.domains,
      country_count: g.countries.length,
      countries: g.countries
        .map(c => ({ name: c.name, iso2: c.iso2, iso3: c.iso3 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      stats: statsResults[i],
      extended: extendedStats[i],
    })),
    overlap: {
      pairs,
      common: isoListToCountries(commonIsos),
    },
    unique,
  }
})
