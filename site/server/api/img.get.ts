import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

/**
 * Image relay: portraits from Wikimedia Commons and official UN pages are fetched by the
 * server and cached, so visitors' browsers never contact those sites (no IP address is
 * passed to third parties). Only allow-listed hosts; images only; cached for 30 days.
 */
const CACHE = join(process.env.HOME || '/home/exedev', '.cache/wcg/img')
const HOSTS = /^((upload|commons|thumb)\.wikimedia\.org|(www\.)?un\.org|[a-z0-9-]+\.un\.org)$/i
const MAX_BYTES = 5 * 1024 * 1024
const TTL = 30 * 86400_000

export default defineEventHandler(async (event) => {
  const raw = String(getQuery(event).u || '')
  let url: URL
  try { url = new URL(raw) } catch { throw createError({ statusCode: 400, statusMessage: 'Bad image address' }) }
  if (url.protocol !== 'https:' || !HOSTS.test(url.hostname)) throw createError({ statusCode: 400, statusMessage: 'Image host not allowed' })
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true })
  const key = createHash('sha256').update(url.toString()).digest('hex').slice(0, 32)
  const file = join(CACHE, key)
  const meta = file + '.type'
  setHeader(event, 'cache-control', 'public, max-age=2592000, immutable')
  if (existsSync(file) && existsSync(meta) && Date.now() - statSync(file).mtimeMs < TTL) {
    setHeader(event, 'content-type', readFileSync(meta, 'utf-8'))
    return readFileSync(file)
  }
  const res = await fetch(url.toString(), { headers: { 'User-Agent': 'WorldCountryGroups/1.0 (+https://worldcountrygroups.exe.xyz)' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) })
    .catch(() => null)
  const type = res?.headers.get('content-type') || ''
  // raster images only: SVG can carry script and would run on this site's origin
  if (!res || !res.ok || !/^image\/(jpeg|png|gif|webp|avif)/.test(type)) throw createError({ statusCode: 404, statusMessage: 'Image not available' })
  const final = new URL(res.url)
  if (!HOSTS.test(final.hostname)) throw createError({ statusCode: 400, statusMessage: 'Image host not allowed' })
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'Image too large' })
  writeFileSync(file, buf)
  writeFileSync(meta, type)
  setHeader(event, 'content-type', type)
  return buf
})
