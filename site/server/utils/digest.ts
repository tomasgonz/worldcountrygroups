import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
export const PROJECT_ROOT = join(process.env.HOME || '/home/exedev', 'worldcountrygroups')

export function getDigestState(userId: string): { lastSent: string | null; lastError: string | null } {
  try {
    const p = join(DATA_DIR, 'digest-state.json')
    if (!existsSync(p)) return { lastSent: null, lastError: null }
    const u = JSON.parse(readFileSync(p, 'utf-8'))?.users?.[userId] || {}
    return { lastSent: u.lastSent ?? null, lastError: u.lastError ?? null }
  } catch {
    return { lastSent: null, lastError: null }
  }
}
