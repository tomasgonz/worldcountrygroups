/**
 * Wasabi (S3) backup with restic — configuration and operation from the admin page.
 *
 * Secrets live only in the env file (~exedev/.config/wcg-backup/env, mode 600, owner exedev),
 * the same file scripts/backup_wasabi.sh reads. Restic is always run as SCRIPT_USER through
 * bash, which sources the env file for that child process only: secrets never pass through
 * command lines, server logs or API responses.
 */
import { spawn, execFile } from 'child_process'
import { randomBytes } from 'crypto'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, openSync, writeSync, fsyncSync, closeSync, renameSync, chownSync, chmodSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import { SCRIPT_USER } from './run-python'

export const WASABI_REGIONS = [
  'us-east-1', 'us-east-2', 'us-central-1', 'us-west-1', 'us-west-2', 'ca-central-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-south-1',
  'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2',
] as const

const PROJECT_DIR = '/home/exedev/worldcountrygroups'
const BACKUP_SCRIPT = join(PROJECT_DIR, 'scripts/backup_wasabi.sh')
const SAFE_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
const RESTIC = existsSync('/bin/restic') ? '/bin/restic' : 'restic'

// ---------------------------------------------------------------- user / paths

interface PwEntry { uid: number; gid: number; home: string }

function scriptUserEntry(): PwEntry {
  try {
    for (const line of readFileSync('/etc/passwd', 'utf-8').split('\n')) {
      const f = line.split(':')
      if (f[0] === SCRIPT_USER && f.length >= 7) return { uid: +f[2], gid: +f[3], home: f[5] }
    }
  } catch {}
  return { uid: 1000, gid: 1000, home: `/home/${SCRIPT_USER}` }
}

const USER = scriptUserEntry()
export const BACKUP_ENV_FILE = process.env.WCG_BACKUP_ENV || join(USER.home, '.config/wcg-backup/env')
export const BACKUP_LOG_DIR = join(USER.home, '.cache/wcg-backup')
export const BACKUP_LOG_FILE = join(BACKUP_LOG_DIR, 'backup.log')
const BACKUP_LOCK_FILE = join(BACKUP_LOG_DIR, 'backup.lock')

const isRoot = () => typeof process.getuid === 'function' && process.getuid() === 0

/** Minimal environment for children: never leak the server's own env (API keys etc.). */
function childEnv(): NodeJS.ProcessEnv {
  return { PATH: SAFE_PATH, HOME: USER.home, LANG: 'C.UTF-8', USER: SCRIPT_USER, LOGNAME: SCRIPT_USER }
}

/** Command + args to run argv as SCRIPT_USER (runuser when the server is root). */
function asUser(argv: string[]): [string, string[]] {
  return isRoot() ? ['/usr/sbin/runuser', ['-u', SCRIPT_USER, '--', ...argv]] : [argv[0], argv.slice(1)]
}

// ---------------------------------------------------------------- env file parsing

const PLACEHOLDER_RE = /YOUR[-_]|CHANGE_ME|^$/i

function unquote(v: string): string {
  v = v.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

interface ParsedEnv { values: Record<string, string>; rawLines: string[] }

function readEnvFile(): ParsedEnv | null {
  let text: string
  try { text = readFileSync(BACKUP_ENV_FILE, 'utf-8') } catch { return null }
  const values: Record<string, string> = {}
  const rawLines = text.split('\n')
  for (const line of rawLines) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) values[m[1]] = unquote(m[2])
  }
  return { values, rawLines }
}

const isSet = (v?: string) => !!v && !PLACEHOLDER_RE.test(v)

export interface RepoParts { region: string; bucket: string; path: string; endpoint: string }

/** s3:https://s3.<region>.wasabisys.com/<bucket>/<path> → parts */
export function parseRepository(repo?: string): RepoParts | null {
  if (!repo) return null
  const m = repo.match(/^s3:https:\/\/(s3(?:\.([a-z0-9-]+))?\.wasabisys\.com)\/([^/]+)(?:\/(.*))?$/)
  if (!m) return null
  return { endpoint: m[1], region: m[2] || 'us-east-1', bucket: m[3], path: (m[4] || '').replace(/\/+$/, '') }
}

export function wasabiEndpoint(region: string): string {
  return region === 'us-east-1' ? 's3.wasabisys.com' : `s3.${region}.wasabisys.com`
}

export function buildRepository(region: string, bucket: string, path: string): string {
  return `s3:https://${wasabiEndpoint(region)}/${bucket}${path ? '/' + path : ''}`
}

// ---------------------------------------------------------------- validation

export function validateBucket(b: string): string | null {
  if (b.length < 3 || b.length > 63) return 'Bucket name must be 3–63 characters'
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(b)) return 'Bucket name may only contain lowercase letters, digits, dots and hyphens, and must start and end with a letter or digit'
  if (b.includes('..') || b.includes('.-') || b.includes('-.')) return 'Bucket name has invalid dot/hyphen sequence'
  if (/^\d+\.\d+\.\d+\.\d+$/.test(b)) return 'Bucket name must not look like an IP address'
  if (b.startsWith('xn--') || b.endsWith('-s3alias')) return 'Bucket name uses a reserved prefix/suffix'
  return null
}

export function validatePath(p: string): string | null {
  if (p.length > 200) return 'Path is too long'
  if (!/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(p)) return 'Path may only contain letters, digits, ".", "_", "-" and "/" separators'
  if (p.split('/').some(s => s === '.' || s === '..')) return 'Path must not contain "." or ".." segments'
  return null
}

export function validateAccessKey(k: string): string | null {
  if (!/^[A-Za-z0-9]{16,128}$/.test(k)) return 'Access key must be 16–128 letters/digits (Wasabi access keys are 20 characters)'
  return null
}

export function validateSecretKey(k: string): string | null {
  if (!/^[A-Za-z0-9+/=]{20,128}$/.test(k)) return 'Secret key must be 20–128 characters of letters, digits, "+", "/" or "="'
  return null
}

// ---------------------------------------------------------------- config (read / write)

export interface BackupConfigInfo {
  envFileExists: boolean
  configured: boolean
  region: string | null
  bucket: string | null
  path: string | null
  endpoint: string | null
  accessKeyMasked: string | null
  accessKeySet: boolean
  secretKeySet: boolean
  passwordSet: boolean
}

export function getConfigInfo(): BackupConfigInfo {
  const env = readEnvFile()
  const v = env?.values || {}
  const repo = parseRepository(v.RESTIC_REPOSITORY)
  const bucketOk = !!repo && isSet(repo.bucket)
  const accessKeySet = isSet(v.AWS_ACCESS_KEY_ID)
  const secretKeySet = isSet(v.AWS_SECRET_ACCESS_KEY)
  const passwordSet = isSet(v.RESTIC_PASSWORD)
  return {
    envFileExists: !!env,
    configured: !!env && bucketOk && accessKeySet && secretKeySet && passwordSet,
    region: repo?.region ?? null,
    bucket: bucketOk ? repo!.bucket : null,
    path: repo?.path ?? null,
    endpoint: repo?.endpoint ?? null,
    accessKeyMasked: accessKeySet ? v.AWS_ACCESS_KEY_ID.slice(0, 4) + '…' : null,
    accessKeySet,
    secretKeySet,
    passwordSet,
  }
}

export interface SaveConfigInput { region?: unknown; bucket?: unknown; accessKey?: unknown; secretKey?: unknown; path?: unknown }

/**
 * Validate and write the env file atomically (mode 600, owner SCRIPT_USER).
 * An existing real RESTIC_PASSWORD line is kept byte-for-byte. If there is none (or a
 * placeholder), a new password is generated and returned — the only time it is ever shown.
 */
export function saveConfig(input: SaveConfigInput): { generatedPassword: string | null } {
  const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '')
  const region = str(input.region)
  const bucket = str(input.bucket)
  const path = str(input.path) || 'worldcountrygroups'
  const accessKeyIn = str(input.accessKey)
  const secretKeyIn = str(input.secretKey)

  const bad = (msg: string) => { throw createError({ statusCode: 400, statusMessage: msg }) }
  if (!(WASABI_REGIONS as readonly string[]).includes(region)) bad('Unknown Wasabi region')
  const be = validateBucket(bucket); if (be) bad(be)
  const pe = validatePath(path); if (pe) bad(pe)

  const existing = readEnvFile()
  const ev = existing?.values || {}

  let accessKey = accessKeyIn
  if (!accessKey) {
    if (!isSet(ev.AWS_ACCESS_KEY_ID)) bad('Access key is required')
    accessKey = ev.AWS_ACCESS_KEY_ID
  }
  const ae = validateAccessKey(accessKey); if (ae) bad(accessKeyIn ? ae : 'The stored access key is not valid; please enter it again')

  let secretKey = secretKeyIn
  if (!secretKey) {
    if (!isSet(ev.AWS_SECRET_ACCESS_KEY)) bad('Secret key is required')
    secretKey = ev.AWS_SECRET_ACCESS_KEY
  }
  const se = validateSecretKey(secretKey); if (se) bad(secretKeyIn ? se : 'The stored secret key is not valid; please enter it again')

  // Keep the existing real password line verbatim; otherwise generate one.
  let passwordLine: string | null = null
  let generatedPassword: string | null = null
  if (existing && isSet(ev.RESTIC_PASSWORD)) {
    passwordLine = existing.rawLines.filter(l => /^\s*(?:export\s+)?RESTIC_PASSWORD=/.test(l)).pop() || null
  }
  if (!passwordLine) {
    generatedPassword = randomBytes(30).toString('base64url') // 40 chars, [A-Za-z0-9_-]
    passwordLine = `RESTIC_PASSWORD=${generatedPassword}`
  }

  // Keep any other variables the admin may have added by hand (e.g. RESTIC_CACHE_DIR).
  const managed = new Set(['RESTIC_REPOSITORY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'RESTIC_PASSWORD'])
  const extra = (existing?.rawLines || []).filter(l => {
    const m = l.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)=/)
    return m && !managed.has(m[1])
  })

  const lines = [
    '# Wasabi backup settings for scripts/backup_wasabi.sh — managed from the admin page.',
    '# Keep this file private (chmod 600). Never commit it.',
    `RESTIC_REPOSITORY=${buildRepository(region, bucket, path)}`,
    `AWS_ACCESS_KEY_ID=${accessKey}`,
    `AWS_SECRET_ACCESS_KEY=${secretKey}`,
    '# Encryption password for the backups. Without it the backups cannot be restored:',
    '# keep a copy in a password manager.',
    passwordLine,
    ...extra,
    '',
  ]
  const content = lines.join('\n')
  // Defence in depth: nothing but plain KEY=value lines and comments may be written.
  for (const l of lines) {
    if (l === '' || l.startsWith('#')) continue
    if (/[\r\n\0`$;&|<>(){}\\!*?[\]~\s"']/.test(l.replace(/^[A-Z_][A-Z0-9_]*=/, '')) && l !== passwordLine && !extra.includes(l)) {
      bad('Refusing to write an unsafe value')
    }
  }

  writeEnvAtomically(content)
  return { generatedPassword }
}

function writeEnvAtomically(content: string) {
  const dir = dirname(BACKUP_ENV_FILE)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    if (isRoot()) chownSync(dir, USER.uid, USER.gid)
  }
  const tmp = join(dir, `.env.tmp-${process.pid}-${randomBytes(4).toString('hex')}`)
  const fd = openSync(tmp, 'wx', 0o600)
  try {
    writeSync(fd, content)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  try {
    chmodSync(tmp, 0o600)
    if (isRoot()) chownSync(tmp, USER.uid, USER.gid)
    renameSync(tmp, BACKUP_ENV_FILE)
  } catch (e) {
    try { unlinkSync(tmp) } catch {}
    throw e
  }
}

// ---------------------------------------------------------------- running restic / the script

interface RunResult { code: number; stdout: string; stderr: string; timedOut: boolean }

/** Strip anything that could be a secret from output before it leaves the server. */
function redact(text: string): string {
  const v = readEnvFile()?.values || {}
  let out = text
  for (const k of ['AWS_SECRET_ACCESS_KEY', 'RESTIC_PASSWORD', 'AWS_ACCESS_KEY_ID']) {
    const s = v[k]
    if (s && s.length >= 8) out = out.split(s).join(k === 'AWS_ACCESS_KEY_ID' ? s.slice(0, 4) + '…' : '[redacted]')
  }
  return out
}

function run(argv: string[], timeoutMs: number): Promise<RunResult> {
  const [cmd, args] = asUser(argv)
  return new Promise((resolve) => {
    execFile(cmd, args, { env: childEnv(), cwd: PROJECT_DIR, timeout: timeoutMs, killSignal: 'SIGTERM', maxBuffer: 32 * 1024 * 1024 }, (err: any, stdout, stderr) => {
      resolve({
        code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
        timedOut: !!err?.killed,
      })
    })
  })
}

/** Run restic as SCRIPT_USER with the env file sourced by bash for this child only. */
function runRestic(args: string[], timeoutMs: number): Promise<RunResult> {
  // $0 = env file, "$@" = restic args. No secret appears in argv.
  const sh = 'set -a; . "$0" || exit 99; set +a; exec ' + RESTIC + ' "$@"'
  return run(['/bin/bash', '-c', sh, BACKUP_ENV_FILE, ...args], timeoutMs)
}

export type RepoState = 'ok' | 'not-initialized' | 'auth-error' | 'bucket-not-found' | 'wrong-password' | 'wrong-region' | 'access-denied' | 'network-error' | 'timeout' | 'not-configured' | 'error'

export interface TestResult { state: RepoState; message: string; detail?: string; testedAt: string }

let lastTest: TestResult | null = null
export const getLastTest = () => lastTest

export function classifyResticError(out: string): { state: RepoState; message: string } {
  const t = out.toLowerCase()
  if (t.includes('access key id you provided does not exist') || t.includes('invalidaccesskeyid'))
    return { state: 'auth-error', message: 'Wasabi does not recognise this access key. Check the access key (and that it belongs to the account with the bucket).' }
  if (t.includes('signature we calculated does not match') || t.includes('signaturedoesnotmatch'))
    return { state: 'auth-error', message: 'The secret key is wrong for this access key.' }
  if (t.includes('specified bucket does not exist') || t.includes('nosuchbucket'))
    return { state: 'bucket-not-found', message: 'The bucket does not exist in this region. Create it in the Wasabi console, or check the bucket name and region.' }
  if (t.includes('permanentredirect') || t.includes('must be addressed using the specified endpoint') || t.includes('authorizationheadermalformed') || t.includes('region') && t.includes('wrong'))
    return { state: 'wrong-region', message: 'The bucket exists but in a different region. Pick the region shown for the bucket in the Wasabi console.' }
  if (t.includes('wrong password') || t.includes('no key found'))
    return { state: 'wrong-password', message: 'A repository exists here but the backup password does not open it. Use the original password, or a different path/bucket.' }
  if (t.includes('access denied') || t.includes('accessdenied') || t.includes('forbidden'))
    return { state: 'access-denied', message: 'Access denied. The access key needs read/write permission on this bucket.' }
  if (t.includes('is there a repository at the following location') || (t.includes('unable to open config file') && (t.includes('does not exist') || t.includes('nosuchkey'))))
    return { state: 'not-initialized', message: 'Connection works but there is no backup repository here yet. Click “Initialize” to create it.' }
  if (t.includes('no such host') || t.includes('dial tcp') || t.includes('connection refused') || t.includes('i/o timeout') || t.includes('tls handshake'))
    return { state: 'network-error', message: 'Could not reach Wasabi (network/DNS error).' }
  return { state: 'error', message: 'Restic reported an error (see details).' }
}

function tailLines(text: string, n: number): string {
  return redact(text).split('\n').map(l => l.trimEnd()).filter(Boolean).slice(-n).join('\n').slice(-2000)
}

export async function testConnection(): Promise<TestResult> {
  const now = () => new Date().toISOString()
  if (!getConfigInfo().configured) {
    lastTest = { state: 'not-configured', message: 'Save the region, bucket and keys first.', testedAt: now() }
    return lastTest
  }
  const r = await runRestic(['cat', 'config', '--no-lock', '--no-cache'], 60_000)
  if (r.timedOut) {
    lastTest = { state: 'timeout', message: 'Wasabi did not answer within 60 seconds.', testedAt: now() }
  } else if (r.code === 0) {
    lastTest = { state: 'ok', message: 'Connected. The backup repository exists and the password opens it.', testedAt: now() }
  } else {
    const c = classifyResticError(r.stderr + '\n' + r.stdout)
    lastTest = { ...c, detail: tailLines(r.stderr || r.stdout, 6), testedAt: now() }
  }
  return lastTest
}

export async function initRepository(): Promise<{ ok: boolean; message: string; detail?: string }> {
  if (isBackupRunning()) return { ok: false, message: 'A backup is running; try again later.' }
  const t = await testConnection()
  if (t.state === 'ok') return { ok: false, message: 'The repository already exists — nothing to do.' }
  if (t.state !== 'not-initialized') return { ok: false, message: `Cannot initialize: ${t.message}`, detail: t.detail }
  const r = await run(['/bin/bash', BACKUP_SCRIPT, 'init'], 180_000)
  if (r.code === 0) {
    lastTest = { state: 'ok', message: 'Repository created.', testedAt: new Date().toISOString() }
    return { ok: true, message: 'Repository created. You can now run the first backup.' }
  }
  const c = classifyResticError(r.stderr + '\n' + r.stdout)
  return { ok: false, message: r.timedOut ? 'Initialization timed out.' : c.message, detail: tailLines(r.stderr || r.stdout, 6) }
}

/** Any backup_wasabi.sh process (started from here or by cron) counts as running. */
export function isBackupRunning(): boolean {
  try {
    for (const pid of readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue
      let cmd = ''
      try { cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf-8') } catch { continue }
      const argv = cmd.split('\0')
      if (argv.some(a => a.endsWith('backup_wasabi.sh')) && !argv.includes('snapshots') && !argv.includes('init') && !argv.includes('restore')) return true
    }
  } catch {}
  return false
}

export function startBackup(): { started: boolean; message: string } {
  if (!getConfigInfo().configured) return { started: false, message: 'Backup is not configured yet.' }
  if (isBackupRunning()) return { started: false, message: 'A backup is already running.' }
  if (!existsSync(BACKUP_LOG_DIR)) {
    mkdirSync(BACKUP_LOG_DIR, { recursive: true, mode: 0o755 })
    if (isRoot()) chownSync(BACKUP_LOG_DIR, USER.uid, USER.gid)
  }
  // flock guards against double starts; the lock fd (9) is inherited by the script for its whole run.
  const sh = [
    'exec 9>>"$1"',
    'if ! flock -n 9; then echo "=== Backup not started $(date -Is): another backup holds the lock ===" >> "$2"; exit 75; fi',
    'echo "=== Backup started $(date -Is) (admin page) ===" >> "$2"',
    'exec /bin/bash "$0" >> "$2" 2>&1',
  ].join('\n')
  const [cmd, args] = asUser(['/bin/sh', '-c', sh, BACKUP_SCRIPT, BACKUP_LOCK_FILE, BACKUP_LOG_FILE])
  const child = spawn(cmd, args, { env: childEnv(), cwd: PROJECT_DIR, detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
  return { started: true, message: 'Backup started in the background. This page refreshes the status while it runs.' }
}

// ---------------------------------------------------------------- log + snapshots

export interface LastResult {
  logExists: boolean
  logUpdatedAt: string | null
  lastFinishedAt: string | null
  lastStartedAt: string | null
  lastRunFailed: boolean
  errorLines: string[]
  tail: string[]
}

const ERROR_RE = /fatal|error|unable to|denied|failed|does not exist|no such|permission|refusing|not started/i

export function readLastResult(running: boolean): LastResult {
  let text = ''
  let mtime: Date | null = null
  try {
    const st = statSync(BACKUP_LOG_FILE)
    mtime = st.mtime
    // Only the last 256 KB matter.
    const buf = readFileSync(BACKUP_LOG_FILE)
    text = buf.subarray(Math.max(0, buf.length - 256 * 1024)).toString('utf-8')
  } catch {
    return { logExists: false, logUpdatedAt: null, lastFinishedAt: null, lastStartedAt: null, lastRunFailed: false, errorLines: [], tail: [] }
  }
  const lines = redact(text).split('\n').map(l => l.trimEnd()).filter(Boolean)
  let lastFinishedIdx = -1, lastFinishedAt: string | null = null
  let lastStartIdx = -1, lastStartedAt: string | null = null
  lines.forEach((l, i) => {
    const f = l.match(/^Backup finished (\S+)/)
    if (f) { lastFinishedIdx = i; lastFinishedAt = f[1] }
    const s = l.match(/^=== Backup started (\S+)/)
    if (s) { lastStartIdx = i; lastStartedAt = s[1] }
  })
  // Lines belonging to the most recent run that did not end with "Backup finished".
  const after = lines.slice(Math.max(lastFinishedIdx, lastStartIdx) + 1)
  const errorLines = after.filter(l => ERROR_RE.test(l)).slice(-10).map(l => l.slice(0, 300))
  const lastRunFailed = !running && lastFinishedIdx < lines.length - 1 && errorLines.length > 0
  return {
    logExists: true,
    logUpdatedAt: mtime ? mtime.toISOString() : null,
    lastFinishedAt,
    lastStartedAt,
    lastRunFailed,
    errorLines: lastRunFailed || running ? errorLines : [],
    tail: lines.slice(-15).map(l => l.slice(0, 300)),
  }
}

export interface SnapshotInfo { id: string; shortId: string; time: string; hostname: string; tags: string[]; paths: string[]; size: number | null; filesNew: number | null; dataAdded: number | null }

export async function listSnapshots(): Promise<{ ok: boolean; snapshots: SnapshotInfo[]; message?: string; state?: RepoState }> {
  if (!getConfigInfo().configured) return { ok: false, snapshots: [], message: 'Backup is not configured yet.', state: 'not-configured' }
  const r = await runRestic(['snapshots', '--json', '--no-lock'], 90_000)
  if (r.code !== 0 || r.timedOut) {
    const c = r.timedOut ? { state: 'timeout' as RepoState, message: 'Listing snapshots timed out.' } : classifyResticError(r.stderr + '\n' + r.stdout)
    return { ok: false, snapshots: [], ...c }
  }
  let raw: any[] = []
  try { raw = JSON.parse(r.stdout || '[]') || [] } catch { return { ok: false, snapshots: [], message: 'Could not parse restic output.', state: 'error' } }
  const snapshots = raw.map((s: any): SnapshotInfo => ({
    id: String(s.id || ''),
    shortId: String(s.short_id || String(s.id || '').slice(0, 8)),
    time: String(s.time || ''),
    hostname: String(s.hostname || ''),
    tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
    paths: Array.isArray(s.paths) ? s.paths.map(String) : [],
    // restic >= 0.17 includes a summary; 0.16 does not.
    size: typeof s.summary?.total_bytes_processed === 'number' ? s.summary.total_bytes_processed : null,
    filesNew: typeof s.summary?.files_new === 'number' ? s.summary.files_new : null,
    dataAdded: typeof s.summary?.data_added === 'number' ? s.summary.data_added : null,
  })).sort((a, b) => b.time.localeCompare(a.time))
  return { ok: true, snapshots }
}

export function getBackupStatus() {
  const config = getConfigInfo()
  const running = isBackupRunning()
  return {
    ...config,
    regions: WASABI_REGIONS,
    defaultPath: 'worldcountrygroups',
    running,
    lastResult: readLastResult(running),
    lastTest,
  }
}
