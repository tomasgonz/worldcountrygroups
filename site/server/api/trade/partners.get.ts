import { getCountryTradePartners, getPartnerView, getTradeMeta } from '../../utils/trade-partners'

/** GET /api/trade/partners?iso3=BRA  — one country's trade with the tracked partners
 *  GET /api/trade/partners?partner=CHN[&min=1000] — who trades most with one partner */
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const iso3 = typeof q.iso3 === 'string' ? q.iso3.trim().toUpperCase() : ''
  const partner = typeof q.partner === 'string' ? q.partner.trim().toUpperCase() : ''
  const meta = getTradeMeta()
  if (iso3) {
    if (!/^[A-Z]{3}$/.test(iso3)) throw createError({ statusCode: 400, statusMessage: 'Invalid iso3' })
    return { meta, country: getCountryTradePartners(iso3) }
  }
  if (partner) {
    if (!/^[A-Z]{2,4}$/.test(partner)) throw createError({ statusCode: 400, statusMessage: 'Invalid partner' })
    const min = Math.max(0, Number(q.min) || 0)
    const view = getPartnerView(partner, { minTrade: min })
    if (!view && meta) throw createError({ statusCode: 404, statusMessage: 'Unknown partner' })
    return { meta, view }
  }
  throw createError({ statusCode: 400, statusMessage: 'Pass ?iso3= or ?partner=' })
})
