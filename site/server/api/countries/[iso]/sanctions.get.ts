import { getRegistry } from '~/server/utils/wcg'
import { getCountrySanctions, getCountrySanctionsListings, getSanctionsMeta } from '~/server/utils/sanctions'

export default defineEventHandler((event) => {
  const iso = getRouterParam(event, 'iso')!.toUpperCase()
  const registry = getRegistry()

  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Country not found' })
  }

  const iso3 = membership.iso3.toUpperCase()
  const regimes = getCountrySanctions(iso3)
  const meta = getSanctionsMeta()
  return {
    iso3,
    sanctioned: regimes.length > 0,
    regimes: regimes.map(r => ({
      id: r.id,
      name: r.name,
      resolution: r.resolution,
      established: r.established,
      measures: r.measures,
      note: r.note ?? null,
      listed_individuals: r.listed_individuals ?? null,
      listed_entities: r.listed_entities ?? null,
      latest_listing: r.latest_listing ?? null,
      recent_listings: (r.recent_listings || []).slice(0, 5),
    })),
    // Listed individuals with this nationality / entities located here, under any regime
    listings: getCountrySanctionsListings(iso3),
    source: {
      name: meta.source || null,
      url: meta.source_url || null,
      list_generated: meta.list_generated || null,
      last_updated: meta.last_updated || null,
    },
  }
})
