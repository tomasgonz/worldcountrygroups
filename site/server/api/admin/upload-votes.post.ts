import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync, openSync, readSync, closeSync, statSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Transform } from 'stream'
import { createGunzip } from 'zlib'
import { requireAdmin } from '~/server/utils/auth'
import { refreshUNVotingData } from '~/server/utils/data-fetcher'

/**
 * Upload the UN Digital Library General Assembly voting CSV (e.g. 2026_09_30_ga_voting.csv),
 * optionally gzip-compressed. The raw file is the request body (streamed to disk, not buffered).
 * Query: filename (original name), import=1 to run the voting import afterwards.
 */
const MAX_BYTES = 800 * 1024 * 1024
const REQUIRED = ['undl_id', 'ms_code', 'ms_vote', 'date', 'session']
const DATA_DIR = join(process.env.HOME || '/home/exedev', 'worldcountrygroups', 'scripts', 'data')

function firstLine(path: string): string {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.alloc(8192)
    const n = readSync(fd, buf, 0, buf.length, 0)
    return buf.subarray(0, n).toString('utf-8').split(/\r?\n/)[0].replace(/^﻿/, '')
  } finally { closeSync(fd) }
}

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const q = getQuery(event)
  const original = String(q.filename || 'upload.csv').replace(/[^\w.\-]/g, '_')
  const gz = /\.gz$/i.test(original)
  if (!/\.csv(\.gz)?$/i.test(original)) {
    throw createError({ statusCode: 400, statusMessage: 'Upload the voting file as .csv (or .csv.gz)' })
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

  const tmp = join(DATA_DIR, `.upload-${Date.now()}.csv`)
  let bytes = 0
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length
      if (bytes > MAX_BYTES) return cb(new Error('File is larger than 800 MB'))
      cb(null, chunk)
    },
  })
  try {
    const stages: any[] = [event.node.req, limiter]
    if (gz) stages.push(createGunzip())
    stages.push(createWriteStream(tmp))
    await pipeline(stages as [any, ...any[]])
  } catch (e: any) {
    if (existsSync(tmp)) unlinkSync(tmp)
    throw createError({ statusCode: 400, statusMessage: `Upload failed: ${e?.message || e}` })
  }

  // Validate it is the UN voting file before it can replace anything
  const header = firstLine(tmp).split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const missing = REQUIRED.filter(c => !header.includes(c))
  if (missing.length) {
    unlinkSync(tmp)
    throw createError({ statusCode: 400, statusMessage: `Not a UN voting CSV: missing column(s) ${missing.join(', ')}` })
  }

  // The importer picks the alphabetically last *ga_voting*.csv, so keep a date prefix
  const base = original.replace(/\.gz$/i, '')
  const finalName = /^\d{4}_\d{2}_\d{2}_.*ga_voting.*\.csv$/i.test(base)
    ? base
    : `${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_ga_voting.csv`
  const dest = join(DATA_DIR, finalName)
  renameSync(tmp, dest)
  const size = statSync(dest).size

  let importResult: any = null
  if (q.import === '1' || q.import === 'true') {
    importResult = await refreshUNVotingData()
  }
  return { ok: true, file: finalName, size, columns: header.length, imported: importResult }
})
