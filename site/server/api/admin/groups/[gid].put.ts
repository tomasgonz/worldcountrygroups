import { writeFileSync } from 'fs'
import { join } from 'path'
import { requireAdmin } from '~/server/utils/auth'
import { getRegistry, reloadRegistry, DATA_DIR } from '~/server/utils/wcg'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const gid = getRouterParam(event, 'gid')
  if (!gid) {
    throw createError({ statusCode: 400, statusMessage: 'Missing group ID' })
  }

  const existing = getRegistry().getGroup(gid)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: `Group "${gid}" not found` })
  }

  const body = await readBody(event)

  // Validate required fields
  if (!body.acronym || typeof body.acronym !== 'string' || !body.acronym.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Acronym is required' })
  }
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }
  if (!Array.isArray(body.countries) || body.countries.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'At least one country is required' })
  }

  // Validate each country
  for (const c of body.countries) {
    if (!c.name || typeof c.name !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Each country must have a name' })
    }
    if (!c.iso2 || typeof c.iso2 !== 'string' || c.iso2.length !== 2) {
      throw createError({ statusCode: 400, statusMessage: `Invalid iso2 for country "${c.name}"` })
    }
    if (!c.iso3 || typeof c.iso3 !== 'string' || c.iso3.length !== 3) {
      throw createError({ statusCode: 400, statusMessage: `Invalid iso3 for country "${c.name}"` })
    }
  }

  const group = {
    gid,
    acronym: body.acronym.trim(),
    name: body.name.trim(),
    description: (body.description || '').trim(),
    classifier: (body.classifier || '').trim(),
    domains: Array.isArray(body.domains) ? body.domains : [],
    countries: body.countries.map((c: any) => ({
      name: c.name.trim(),
      iso2: c.iso2.toUpperCase(),
      iso3: c.iso3.toUpperCase(),
    })),
    ...(body.founded ? { founded: Number(body.founded) } : {}),
    ...(body.headquarters ? { headquarters: body.headquarters.trim() } : {}),
    ...(body.website ? { website: body.website.trim() } : {}),
    ...(body.official_languages?.length ? { official_languages: body.official_languages } : {}),
  }

  writeFileSync(join(DATA_DIR, `${gid}.json`), JSON.stringify(group, null, 2) + '\n', 'utf-8')
  reloadRegistry()

  return group
})
