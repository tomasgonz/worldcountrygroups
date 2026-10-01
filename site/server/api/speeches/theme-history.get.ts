import { getAllSpeeches } from '~/server/utils/speeches'
import { getRegistry } from '~/server/utils/wcg'

/**
 * Share of General Debate speeches per year that give a theme high or medium priority,
 * for all speakers and, optionally, for the members of a group or a single country.
 * Query: theme (required), group (gid or ISO3, optional)
 */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const theme = String(q.theme || 'climate_change')
  const groupId = String(q.group || '')

  let members: Set<string> | null = null
  let groupName = ''
  if (groupId) {
    const registry = getRegistry()
    const g = registry.getGroup(groupId)
    if (g) {
      members = new Set(g.countries.map(c => c.iso3))
      groupName = g.acronym || g.name
    } else if (/^[A-Za-z]{3}$/.test(groupId)) {
      members = new Set([groupId.toUpperCase()])
      groupName = registry.getCountryMembership(groupId.toUpperCase())?.name || groupId.toUpperCase()
    }
  }

  const years = new Map<number, { n: number; hit: number; gn: number; ghit: number }>()
  for (const s of getAllSpeeches()) {
    if (!s.analysis) continue
    const y = years.get(s.year) || { n: 0, hit: 0, gn: 0, ghit: 0 }
    const has = (s.analysis.themes || []).some(t => t.name === theme && t.relevance !== 'low')
    y.n++; if (has) y.hit++
    if (members?.has(s.iso3)) { y.gn++; if (has) y.ghit++ }
    years.set(s.year, y)
  }
  const series = [...years.entries()].sort((a, b) => a[0] - b[0]).map(([year, y]) => ({
    year,
    world: y.n ? Math.round((y.hit / y.n) * 1000) / 10 : null,
    group: members ? (y.gn ? Math.round((y.ghit / y.gn) * 1000) / 10 : null) : undefined,
    speeches: y.n,
    groupSpeeches: members ? y.gn : undefined,
  }))
  return { theme, group: groupId || null, groupName, series }
})
