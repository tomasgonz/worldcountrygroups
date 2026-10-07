import { getRegistry } from '~/server/utils/wcg'
import { countryBudget } from '~/server/utils/un-budget'
import { sgOffice } from '~/server/utils/sg-office'

/** A country at the UN Secretariat: budget share and dues, Fifth Committee statements, appointments, SG statements naming it. */
export default defineEventHandler((event) => {
  const code = String(getRouterParam(event, 'iso') || '').toUpperCase()
  const m: any = getRegistry().getCountryMembership(code)
  const iso3 = m?.iso3 || (code.length === 3 ? code : null)
  if (!iso3) throw createError({ statusCode: 404, statusMessage: 'Unknown country' })
  const sg = sgOffice({ country: iso3, statements: 8, appointments: 50 })
  const appts = sg?.appointments || []
  return {
    iso3,
    budget: countryBudget(iso3),
    nationals: appts.filter((a: any) => a.nationality === iso3).slice(0, 12),
    postedHere: appts.filter((a: any) => a.dutyCountries.includes(iso3) && a.nationality !== iso3).slice(0, 8),
    sgStatements: sg?.statements || [],
    sgStatementsTotal: sg?.statementsTotal || 0,
    sgUpdated: sg?.meta.updatedAt || null,
  }
})
