import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'fs'
import { execSync, spawn } from 'child_process'
import { join } from 'path'
import { pythonCommand, SCRIPT_USER } from '~/server/utils/run-python'

export interface CronJob {
  id: string
  label: string
  script: string            // path relative to the project root, may include arguments
  schedule: string
  enabled: boolean
  lastRun: string | null    // legacy; job-status.json now holds run results
  lastError: string | null
  logFile: string
  outputs?: string[]        // data files the job writes (validated, previous copy kept)
  maxAgeHours?: number | null // how old the data may get before it counts as stale
  timeoutMin?: number
  retries?: number
  allowShrink?: boolean     // output may legitimately get much smaller (e.g. UN recess)
}

export interface CronConfig {
  jobs: CronJob[]
  removedDefaults?: string[]
  alertEmails?: string[]
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const DATA_PATH = join(DATA_DIR, 'cron-config.json')
const PROJECT_ROOT = join(process.env.HOME || '/home/exedev', 'worldcountrygroups')
export const JOB_LOG_DIR = join(`/home/${SCRIPT_USER}`, '.local/state/wcg/logs')
const RUNNER = `${PROJECT_ROOT}/scripts/run_job.py`

type Def = Omit<CronJob, 'lastRun' | 'lastError' | 'logFile'>
const d = (id: string, label: string, script: string, schedule: string, enabled: boolean, outputs: string[], maxAgeHours: number | null, timeoutMin = 30): Def =>
  ({ id, label, script, schedule, enabled, outputs, maxAgeHours, timeoutMin, retries: 1 })

/** Every job the site knows about, with its outputs and how fresh its data should be. */
const DEFAULT_JOBS: Def[] = [
  d('fetch-news', 'Diplomatic News', 'scripts/fetch_news.py', '0 */6 * * *', true, ['news-feed.json'], 9),
  d('fetch-statements', 'Diplomatic Statements', 'scripts/fetch_statements.py', '0 */4 * * *', true, ['statements-feed.json'], 7),
  d('fetch-unsc', 'Security Council and General Assembly record', 'scripts/fetch_unsc.py', '15 */6 * * *', true,
    ['unsc-votes.json', 'unsc-vetoes.json', 'unsc-history.json', 'unsc-activity.json', 'ga-resolutions.json'], 13),
  d('build-people', 'People directory', 'scripts/build_people.py', '40 */6 * * *', true, ['people-index.json'], 13),
  d('fetch-gdelt', 'Media Coverage (GDELT)', 'scripts/fetch_gdelt.py', '30 2 * * *', true, ['gdelt-data.json'], 30),
  d('send-digests', 'Watchlist Email Digests', 'scripts/send_digests.py', '0 7 * * *', true, [], null),
  d('update-general-debate', 'UN General Debate (Sep-Oct daily)', 'scripts/update_general_debate.py', '0 5 * 9,10 *', true, ['un-speeches-index.json', 'quotes-index.json'], null, 90),
  d('refresh-country-stats', 'Country statistics (World Bank)', 'scripts/refresh_site_data.py country', '20 3 * * 1', true, ['country-stats.json'], 24 * 8, 30),
  d('fetch-oda', 'Aid (OECD ODA)', 'scripts/fetch_oecd_oda.py', '0 4 * * 0', true, ['oecd-oda.json'], 24 * 8),
  d('fetch-visa', 'Visa Restrictions', 'scripts/fetch_visa_data.py', '0 8 * * 0', true, ['visa-restrictions.json'], 24 * 8),
  d('fetch-sdg', 'SDG Progress (UN Stats)', 'scripts/fetch_sdg_progress.py', '0 9 * * 0', true, ['sdg-progress.json'], 24 * 8, 45),
  d('fetch-honour-roll', 'UN Budget Payments (Honour Roll)', 'scripts/fetch_honour_roll.py', '0 7 * * 1', true, ['honour-roll.json'], 24 * 8),
  d('fetch-vdem', 'Democracy (V-Dem)', 'scripts/fetch_vdem.py', '0 5 1 * *', true, ['vdem-data.json'], 24 * 33),
  d('fetch-sipri', 'Arms Trade (SIPRI)', 'scripts/fetch_sipri.py', '0 3 2 * *', true, ['sipri-arms.json'], 24 * 33, 60),
  d('fetch-cables', 'Submarine Cables', 'scripts/fetch_submarine_cables.py', '0 7 3 * *', true, ['submarine-cables.json'], 24 * 33),
  d('fetch-sanctions', 'UN Sanctions (Consolidated List)', 'scripts/fetch_sanctions.py', '30 5 * * *', true, ['sanctions.json'], 36, 10),
  d('fetch-conflicts', 'Conflict Events (UCDP)', 'scripts/fetch_conflicts.py', '15 4 * * 1', true, ['conflict-events.json'], 24 * 8, 30),
  d('build-search-index', 'Full-text search index (speeches, statements, news)', 'scripts/build_search_index.py --embed', '50 */4 * * *', true, ['search.db'], 9, 60),
  d('fetch-elections', 'Elections calendar (Wikipedia)', 'scripts/fetch_elections.py', '10 */6 * * *', true, ['elections.json'], 8, 5),
  { ...d('fetch-un-journal', 'UN Journal (meetings programme)', 'scripts/fetch_un_journal.py', '25 */3 * * *', true, ['un-journal.json'], 7, 10), allowShrink: true },
  d('fetch-trade-partners', 'Trade partners (IMF IMTS)', 'scripts/fetch_trade_partners.py', '30 5 * * 1', true, ['trade-partners.json'], 24 * 8, 15),
  d('fetch-donor-tracker', 'Aid donors (OECD DAC tracker)', 'scripts/fetch_donor_tracker.py', '30 4 * * 0', true, ['donor-tracker.json'], 24 * 8, 20),
  d('fetch-donor-news', 'Donor news', 'scripts/fetch_donor_news.py', '20 */6 * * *', true, ['donor-news.json'], 13, 10),
  d('archive-feeds', 'News and statements archive', 'scripts/archive_feeds.py', '10 * * * *', true, ['archive.db'], 3, 10),
  d('fetch-un-elections', 'UN elections (Security Council, PGA)', 'scripts/fetch_un_elections.py', '40 5 * * *', true, ['un-elections.json'], 72, 10),
  d('fetch-sg-selection', 'UN Secretary-General selection', 'scripts/fetch_sg_selection.py', '40 * * * *', true, ['sg-selection.json'], 8, 10),
  d('fetch-fifth-committee', 'UN budget, reform and Fifth Committee', 'scripts/fetch_fifth_committee.py', '20 */4 * * *', true, ['fifth-committee.json'], 10, 20),
  d('fetch-un-leadership', 'UN leadership: office holders and statements', 'scripts/fetch_un_leadership.py', '15 */6 * * *', true, ['un-leadership.json'], 14, 20),
  d('build-said', 'What was said (quotes of the day and week)', 'scripts/refresh_site_data.py said', '35 */3 * * *', true, ['said.json'], 8, 15),
  d('fetch-undl-sc-votes', 'Security Council member votes (UN Digital Library API)', 'scripts/undl_sc.py', '45 6 * * *', true, ['undl-sc-votes.json'], 26, 40),
  d('fetch-undl-votes', 'General Assembly votes (UN Digital Library API)', 'scripts/fetch_undl_votes.py', '15 6 * * *', true, ['undl-votes-status.json'], 26, 40),
  d('fetch-sg-office', 'Secretary-General appointments and statements', 'scripts/fetch_sg_office.py', '50 */3 * * *', true, ['sg-office.json'], 8, 15),
  d('fetch-election-news', 'Elections news (Security Council, PGA, national)', 'scripts/fetch_election_news.py', '35 */6 * * *', true, ['election-news.json'], 8, 10),
  d('run-briefings', 'Scheduled briefings', 'scripts/refresh_site_data.py briefings', '5 * * * *', true, [], null, 55),
  d('run-alerts', 'Alerts on followed countries and topics', 'scripts/refresh_site_data.py alerts', '25 * * * *', true, [], null, 15),
  d('ai-costs', 'AI spending (OpenAI billing) and budget alerts', 'scripts/refresh_site_data.py ai-costs', '45 */3 * * *', true, [], null, 10),
  d('fetch-alliances', 'Alliances (CoW)', 'scripts/fetch_cow_alliances.py', '0 6 * * 0', false, ['cow-alliances.json'], null),
  d('health-check', 'Data health check and alerts', 'scripts/check_data_health.py --email', '50 * * * *', true, [], null, 5),
]

let cache: CronConfig | null = null
let cacheMtime = 0

function logPath(id: string) { return join(JOB_LOG_DIR, `${id}.log`) }

/** Bring a stored config up to date: add new default jobs, fill in their metadata, move logs off /tmp. */
function migrate(cfg: CronConfig): boolean {
  let changed = false
  const removed = new Set(cfg.removedDefaults || [])
  for (const def of DEFAULT_JOBS) {
    const job = cfg.jobs.find(j => j.id === def.id)
    if (!job) {
      if (removed.has(def.id)) continue
      cfg.jobs.push({ ...def, lastRun: null, lastError: null, logFile: logPath(def.id) })
      changed = true
      continue
    }
    for (const k of ['outputs', 'maxAgeHours', 'timeoutMin', 'retries', 'allowShrink'] as const) {
      if (job[k] === undefined) { (job as any)[k] = def[k]; changed = true }
    }
    // jobs that used to be off with no schedule worth keeping: adopt the new defaults once
    if ((job as any).migrated !== 2) {
      if (['fetch-sipri', 'fetch-cables'].includes(job.id)) { job.enabled = def.enabled; job.schedule = def.schedule }
      if (job.id === 'fetch-unsc') job.label = def.label
      ;(job as any).migrated = 2
      changed = true
    }
  }
  for (const job of cfg.jobs) {
    if (!job.logFile || job.logFile.startsWith('/tmp/')) { job.logFile = logPath(job.id); changed = true }
  }
  return changed
}

function loadData(): CronConfig {
  try {
    if (existsSync(DATA_PATH)) {
      const m = statSync(DATA_PATH).mtimeMs
      if (cache && m === cacheMtime) return cache
      const cfg: CronConfig = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
      cache = cfg
      cacheMtime = m
      if (migrate(cfg)) { saveData(cfg); syncCrontab() }
      return cfg
    }
  } catch {}
  const data: CronConfig = { jobs: [] }
  migrate(data)
  saveData(data)
  return data
}

function saveData(data: CronConfig) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const tmp = DATA_PATH + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, DATA_PATH)
  cache = data
  cacheMtime = statSync(DATA_PATH).mtimeMs
}

export function getCronConfig(): CronConfig { return loadData() }
export function getCronJobs(): CronJob[] { return loadData().jobs }

export function addCronJob(job: CronJob) {
  const config = loadData()
  if (config.jobs.find(j => j.id === job.id)) throw new Error(`Job '${job.id}' already exists`)
  if (!/^[a-z0-9-]+$/.test(job.id)) throw new Error('Job id: lowercase letters, digits and dashes only')
  config.jobs.push({ maxAgeHours: null, outputs: [], timeoutMin: 30, retries: 1, ...job, logFile: logPath(job.id) })
  saveData(config)
  syncCrontab()
}

export function updateCronJob(id: string, partial: Partial<CronJob>) {
  const config = loadData()
  const idx = config.jobs.findIndex(j => j.id === id)
  if (idx === -1) throw new Error(`Job '${id}' not found`)
  const { script: _s, logFile: _l, ...safe } = partial // script and log location are fixed after creation
  config.jobs[idx] = { ...config.jobs[idx], ...safe, id }
  saveData(config)
  syncCrontab()
}

export function removeCronJob(id: string) {
  const config = loadData()
  config.jobs = config.jobs.filter(j => j.id !== id)
  if (DEFAULT_JOBS.some(j => j.id === id)) config.removedDefaults = [...new Set([...(config.removedDefaults || []), id])]
  saveData(config)
  syncCrontab()
}

export function setCronJobEnabled(id: string, enabled: boolean) {
  const config = loadData()
  const job = config.jobs.find(j => j.id === id)
  if (!job) throw new Error(`Job '${id}' not found`)
  job.enabled = enabled
  saveData(config)
  syncCrontab()
}

export function setAlertEmails(emails: string[]) {
  const config = loadData()
  config.alertEmails = emails.map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 10)
  saveData(config)
  return config.alertEmails
}

/** Start a job in the background through the runner; the admin polls job status. */
export function startJobNow(id: string) {
  const job = getCronJobs().find(j => j.id === id)
  if (!job) throw new Error(`Job '${id}' not found`)
  const [cmd, argv] = pythonCommand(RUNNER, [id, '--trigger', 'manual'])
  const child = spawn(cmd, argv, { cwd: PROJECT_ROOT, detached: true, stdio: 'ignore', env: { ...process.env, HOME: `/home/${SCRIPT_USER}` } })
  child.unref()
}

export function syncCrontab() {
  const config = loadData()
  const marker = '# WCG-MANAGED'
  const cronLog = join(JOB_LOG_DIR, 'cron.log')
  // Run as the project owner so scripts find its Python packages and data files keep one owner
  const lines = config.jobs.filter(j => j.enabled && /^[a-z0-9-]+$/.test(j.id)).map(j => {
    const [cmd, argv] = pythonCommand(RUNNER, [j.id])
    return `${j.schedule} ${[cmd, ...argv].join(' ')} >> ${cronLog} 2>&1 ${marker}`
  })
  let existing = ''
  try { existing = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' }) } catch {}
  const kept = existing.split('\n').filter(l => !l.includes(marker))
  const final = [...kept.filter(l => l.trim()), ...lines].join('\n') + '\n'
  execSync('crontab -', { input: final, encoding: 'utf-8' })
}
