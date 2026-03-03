import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getCountryData } from '../utils/countrydata'
import { getConflictMeta } from '../utils/conflict'

export default defineEventHandler(() => {
  const paths = [
    join(process.cwd(), 'server', 'data', 'conflict-events.json'),
    join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data', 'conflict-events.json'),
  ]

  let raw: any = null
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        raw = JSON.parse(readFileSync(p, 'utf-8'))
      } catch {}
      break
    }
  }

  if (!raw?.countries) {
    return { countries: [], meta: getConflictMeta() }
  }

  const countries = Object.entries(raw.countries).map(([iso3, data]: [string, any]) => {
    const cd = getCountryData(iso3)
    return {
      iso3,
      iso2: cd?.iso2 || null,
      name: cd?.name || iso3,
      ...data,
    }
  })

  countries.sort((a: any, b: any) => b.total_fatalities - a.total_fatalities)

  return {
    countries,
    meta: raw._meta || null,
  }
})
