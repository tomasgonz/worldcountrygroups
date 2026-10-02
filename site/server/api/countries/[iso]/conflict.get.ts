import { getRegistry } from '~/server/utils/wcg'
import { getCountryConflict, getConflictMeta } from '~/server/utils/conflict'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const registry = getRegistry()

  // Resolve to iso3
  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  const m = getConflictMeta()
  const meta = {
    source: m.source,
    source_url: m.source_url ?? null,
    period: m.period,
    period_start: m.period_start ?? null,
    period_end: m.period_end ?? null,
    candidate_from: m.candidate_from ?? null,
    last_updated: m.last_updated,
  }

  const data = getCountryConflict(iso3)
  if (!data) {
    return { has_data: false, iso3, meta }
  }

  return { has_data: true, iso3, ...data, meta }
})
