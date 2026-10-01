import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const DATA_DIR = join(process.cwd(), 'server', 'data')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')

const _cache = new Map<string, { mtime: number; checked: number; data: any }>()

/**
 * Read a JSON file from server/data, re-reading it when the file changes on disk
 * (checked at most every 30s). Scheduled fetchers rewrite these files, so modules
 * must not hold on to the first copy they loaded.
 */
export function readDataFile<T = any>(name: string): T | null {
  const hit = _cache.get(name)
  const now = Date.now()
  if (hit && now - hit.checked < 30_000) return hit.data
  const path = [join(DATA_DIR, name), join(ALT_DIR, name)].find(p => existsSync(p))
  if (!path) return null
  try {
    const mtime = statSync(path).mtimeMs
    if (hit && hit.mtime === mtime) {
      hit.checked = now
      return hit.data
    }
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    _cache.set(name, { mtime, checked: now, data })
    return data
  } catch {
    return hit?.data ?? null
  }
}

export function dataFileMtime(name: string): string | null {
  const path = [join(DATA_DIR, name), join(ALT_DIR, name)].find(p => existsSync(p))
  if (!path) return null
  try { return new Date(statSync(path).mtimeMs).toISOString() } catch { return null }
}
