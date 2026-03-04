import { getRegistry } from '~/server/utils/wcg'
import { getCountrySpeeches, getSpeechText } from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const iso = (getRouterParam(event, 'iso') || '').toUpperCase()
  const sessionParam = getRouterParam(event, 'session') || ''
  const session = parseInt(sessionParam, 10)

  if (isNaN(session)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid session number' })
  }

  const registry = getRegistry()
  let iso3 = iso
  if (iso.length === 2) {
    const membership = registry.getCountryMembership(iso)
    if (membership) iso3 = membership.iso3
  }

  const speeches = getCountrySpeeches(iso3)
  const meta = speeches.find(s => s.session === session)
  if (!meta) {
    throw createError({ statusCode: 404, statusMessage: 'Speech not found' })
  }

  const text = getSpeechText(iso3, session)
  return { meta, text }
})
