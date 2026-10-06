import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { timingSafeEqual } from 'crypto'
import type { H3Event } from 'h3'

const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')

/** Requests from the scheduler: private token, and never through the public proxy. */
export function requireInternal(event: H3Event) {
  const path = join(DATA_DIR, '.internal-token')
  const given = String(getHeader(event, 'x-internal-token') || '')
  const expected = existsSync(path) ? readFileSync(path, 'utf-8').trim() : ''
  const viaProxy = !!getHeader(event, 'x-forwarded-for') || !!getHeader(event, 'x-real-ip')
  if (viaProxy || !expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
}
