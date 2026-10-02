import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { timingSafeEqual } from 'crypto'
import { refreshAllData, refreshThemeClassification } from '~/server/utils/data-fetcher'

const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')

/**
 * Lets the scheduler (scripts/refresh_site_data.py) run the refreshes that live
 * inside the site. Only accepted with the private token from .internal-token,
 * and never through the public proxy (which adds X-Forwarded-For).
 */
export default defineEventHandler(async (event) => {
  const path = join(DATA_DIR, '.internal-token')
  const given = String(getHeader(event, 'x-internal-token') || '')
  const expected = existsSync(path) ? readFileSync(path, 'utf-8').trim() : ''
  const viaProxy = !!getHeader(event, 'x-forwarded-for') || !!getHeader(event, 'x-real-ip')
  if (viaProxy || !expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  const target = String(getQuery(event).target || '')
  if (target === 'country') return await refreshAllData()
  if (target === 'themes') return await refreshThemeClassification()
  throw createError({ statusCode: 400, statusMessage: 'Unknown target' })
})
