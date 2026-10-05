import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'

/**
 * The privacy policy text, editable in the admin (Markdown). Each save keeps the previous
 * version so it can be restored. Until it is edited, the built-in default is shown.
 */
const DATA_DIR = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const FILE = join(DATA_DIR, 'privacy-policy.json')
const DEFAULT_FILE = join(DATA_DIR, 'privacy-policy.default.md')
const KEEP_VERSIONS = 30

export interface PolicyVersion { markdown: string; updatedAt: string; updatedBy: string; note?: string }
interface Store { current: PolicyVersion; history: PolicyVersion[] }

function defaultPolicy(): PolicyVersion {
  const markdown = existsSync(DEFAULT_FILE) ? readFileSync(DEFAULT_FILE, 'utf-8') : 'Privacy policy not yet written.'
  return { markdown, updatedAt: '2026-10-05T00:00:00.000Z', updatedBy: 'default' }
}

function load(): Store {
  try { if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf-8')) } catch {}
  return { current: defaultPolicy(), history: [] }
}

export function getPolicy(): PolicyVersion { return load().current }
export function getPolicyHistory(): PolicyVersion[] { return load().history }

export function savePolicy(markdown: string, by: string, note?: string): PolicyVersion {
  const s = load()
  const text = String(markdown || '').replace(/\r\n/g, '\n').trim()
  if (text.length < 50) throw new Error('The policy is too short')
  if (text.length > 200_000) throw new Error('The policy is too long')
  if (text === s.current.markdown.trim()) return s.current
  const next: PolicyVersion = { markdown: text + '\n', updatedAt: new Date().toISOString(), updatedBy: by, note: (note || '').slice(0, 200) || undefined }
  const store: Store = { current: next, history: [s.current, ...s.history].slice(0, KEEP_VERSIONS) }
  writeFileSync(FILE + '.tmp', JSON.stringify(store, null, 2))
  renameSync(FILE + '.tmp', FILE)
  return next
}
