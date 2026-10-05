import { getPairProducts } from '../../utils/trade-products'

/** GET /api/trade/products?iso3=BRA&partner=CHN — top HS chapters (UN Comtrade), fetched on demand and cached. */
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const iso3 = String(q.iso3 || '').toUpperCase()
  const partner = String(q.partner || '').toUpperCase()
  if (!/^[A-Z]{3}$/.test(iso3) || !/^[A-Z]{3}$/.test(partner)) throw createError({ statusCode: 400, statusMessage: 'Pass ?iso3=&partner= (ISO3 codes)' })
  return await getPairProducts(iso3, partner)
})
