import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { pythonCommand } from '~/server/utils/run-python'

export interface CronJob {
  id: string
  label: string
  script: string
  schedule: string
  enabled: boolean
  lastRun: string | null
  lastError: string | null
  logFile: string
}

export interface CronConfig {
  jobs: CronJob[]
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const DATA_PATH = join(DATA_DIR, 'cron-config.json')
const PROJECT_ROOT = join(process.env.HOME || '/home/exedev', 'worldcountrygroups')

const DEFAULT_JOBS: CronJob[] = [
  { id: 'fetch-news', label: 'Diplomatic News', script: 'scripts/fetch_news.py', schedule: '0 */6 * * *', enabled: true, lastRun: null, lastError: null, logFile: '/tmp/fetch-news.log' },
  { id: 'fetch-sipri', label: 'Arms Trade (SIPRI)', script: 'scripts/fetch_sipri.py', schedule: '0 3 * * 0', enabled: false, lastRun: null, lastError: null, logFile: '/tmp/fetch-sipri.log' },
  { id: 'fetch-oda', label: 'Aid (OECD ODA)', script: 'scripts/fetch_oecd_oda.py', schedule: '0 4 * * 0', enabled: false, lastRun: null, lastError: null, logFile: '/tmp/fetch-oda.log' },
  { id: 'fetch-vdem', label: 'Democracy (V-Dem)', script: 'scripts/fetch_vdem.py', schedule: '0 5 * * 0', enabled: false, lastRun: null, lastError: null, logFile: '/tmp/fetch-vdem.log' },
  { id: 'update-general-debate', label: 'UN General Debate (Sep-Oct daily)', script: 'scripts/update_general_debate.py', schedule: '0 5 * 9,10 *', enabled: true, lastRun: null, lastError: null, logFile: '/tmp/update-general-debate.log' },
  { id: 'send-digests', label: 'Watchlist Email Digests', script: 'scripts/send_digests.py', schedule: '0 7 * * *', enabled: true, lastRun: null, lastError: null, logFile: '/tmp/send-digests.log' },
  { id: 'fetch-gdelt', label: 'Media Coverage (GDELT)', script: 'scripts/fetch_gdelt.py', schedule: '30 2 * * *', enabled: true, lastRun: null, lastError: null, logFile: '/tmp/fetch-gdelt.log' },
  { id: 'fetch-unsc', label: 'Security Council Record', script: 'scripts/fetch_unsc.py', schedule: '15 */6 * * *', enabled: true, lastRun: null, lastError: null, logFile: '/tmp/fetch-unsc.log' },
  { id: 'fetch-alliances', label: 'Alliances (CoW)', script: 'scripts/fetch_cow_alliances.py', schedule: '0 6 * * 0', enabled: false, lastRun: null, lastError: null, logFile: '/tmp/fetch-alliances.log' },
  { id: 'fetch-cables', label: 'Submarine Cables', script: 'scripts/fetch_submarine_cables.py', schedule: '0 7 * * 0', enabled: false, lastRun: null, lastError: null, logFile: '/tmp/fetch-cables.log' },
  { id: 'fetch-visa', label: 'Visa Restrictions', script: 'scripts/fetch_visa_data.py', schedule: '0 8 * * 0', enabled: false, lastRun: null, lastError: null, logFile: '/tmp/fetch-visa.log' },
  { id: 'fetch-statements', label: 'Diplomatic Statements', script: 'scripts/fetch_statements.py', schedule: '0 */4 * * *', enabled: true, lastRun: null, lastError: null, logFile: '/tmp/fetch-statements.log' },
]

let cache: CronConfig | null = null

function loadData(): CronConfig {
  if (cache) return cache
  try {
    if (existsSync(DATA_PATH)) {
      cache = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
      return cache!
    }
  } catch {}
  const data: CronConfig = { jobs: [...DEFAULT_JOBS] }
  saveData(data)
  return data
}

function saveData(data: CronConfig) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
  cache = data
}

export function getCronConfig(): CronConfig {
  return loadData()
}

export function getCronJobs(): CronJob[] {
  return loadData().jobs
}

export function addCronJob(job: CronJob) {
  const config = loadData()
  if (config.jobs.find(j => j.id === job.id)) {
    throw new Error(`Job '${job.id}' already exists`)
  }
  config.jobs.push(job)
  saveData(config)
  syncCrontab()
}

export function updateCronJob(id: string, partial: Partial<CronJob>) {
  const config = loadData()
  const idx = config.jobs.findIndex(j => j.id === id)
  if (idx === -1) throw new Error(`Job '${id}' not found`)
  config.jobs[idx] = { ...config.jobs[idx], ...partial, id }
  saveData(config)
  syncCrontab()
}

export function removeCronJob(id: string) {
  const config = loadData()
  config.jobs = config.jobs.filter(j => j.id !== id)
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

export function recordJobRun(id: string, error?: string) {
  const config = loadData()
  const job = config.jobs.find(j => j.id === id)
  if (!job) return
  job.lastRun = new Date().toISOString()
  job.lastError = error || null
  saveData(config)
}

export function syncCrontab() {
  const config = loadData()
  const enabledJobs = config.jobs.filter(j => j.enabled)

  const marker = '# WCG-MANAGED'
  // Run as the project owner so scripts find its Python packages and data files keep one owner
  const lines = enabledJobs.map(j => {
    const [cmd, argv] = pythonCommand(`${PROJECT_ROOT}/${j.script}`)
    return `${j.schedule} ${[cmd, ...argv].join(' ')} >> ${j.logFile} 2>&1 ${marker}`
  })

  // Read existing crontab, strip old managed lines, append new ones
  let existing = ''
  try {
    existing = execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' })
  } catch {}

  const kept = existing.split('\n').filter(l => !l.includes(marker))
  const final = [...kept.filter(l => l.trim()), ...lines].join('\n') + '\n'

  execSync(`echo ${JSON.stringify(final)} | crontab -`, { encoding: 'utf-8' })
}
