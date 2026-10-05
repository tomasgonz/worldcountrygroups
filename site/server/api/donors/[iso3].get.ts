import { getDonorProfile } from '~/server/utils/donors'
import { getRegistry } from '~/server/utils/wcg'

/** One donor's (and/or recipient's) aid profile: trend, %GNI, top recipients/donors, sectors, news. */
export default defineEventHandler((event) => {
  let code = String(getRouterParam(event, 'iso3') || '').toUpperCase()
  if (code.length === 2 && code !== 'EU') {
    const m = getRegistry().getCountryMembership(code)
    if (m?.iso3) code = m.iso3
  }
  if (!/^([A-Z]{3}|EU)$/.test(code)) throw createError({ statusCode: 400, statusMessage: 'Expected an ISO3 code or EU' })
  return getDonorProfile(code) ?? { code, has_data: false, is_donor: false, is_recipient: false, donor: null, recipient: null, news: [] }
})
