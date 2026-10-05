import { getTradeMeta, getTradeShifts, getTradeCountries } from '../../utils/trade-partners'

/** GET /api/trade/summary[?limit=20] — metadata, partner list, countries and the biggest shifts. */
export default defineEventHandler((event) => {
  const limit = Number(getQuery(event).limit) || 20
  return { meta: getTradeMeta(), countries: getTradeCountries(), shifts: getTradeShifts(limit) }
})
