import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface AIProviderConfig {
  id: string
  name: string
  type: 'openai' | 'anthropic' | 'openai-compatible'
  apiKey: string
  baseUrl?: string
  model: string
  maxTokens?: number
  temperature?: number
  enabled: boolean
}

export interface AIPromptConfig {
  systemBase?: string
  countryInstructions?: string
  bilateralInstructions?: string
  groupInstructions?: string
  newsBriefingInstructions?: string
  speechSummaryInstructions?: string
  anomalyDetectionInstructions?: string
  compareAnalysisInstructions?: string
  groupSuggestionsInstructions?: string
  riskScoreInstructions?: string
  meetingDocInstructions?: string
  cableInstructions?: string
  chatInstructions?: string
  smartSearchInstructions?: string
  pulseInstructions?: string
}

export type PulseTone = 'formal-diplomatic' | 'analytical' | 'journalistic'

export interface PulseStyleConfig {
  tone: PulseTone
  temperature: number
  speakerStyleAdherence: number
}

export const DEFAULT_PULSE_STYLE: PulseStyleConfig = {
  tone: 'analytical',
  temperature: 0.7,
  speakerStyleAdherence: 30,
}

/** Kinds of AI work in the app; each can be routed to its own provider/model. */
export const AI_TASKS = [
  { id: 'today-brief', label: 'Today at the UN brief', group: 'Briefings', hint: 'Long daily synthesis, refreshed every 4 hours' },
  { id: 'un-monitor', label: 'UN Monitor narrative', group: 'Briefings', hint: 'Security Council and UN activity summary' },
  { id: 'pulse', label: 'Diplomatic pulse', group: 'Briefings', hint: 'Home and /pulse page commentary' },
  { id: 'news-briefing', label: 'Country news briefing', group: 'Briefings', hint: 'Per-country news digest' },
  { id: 'country-analysis', label: 'Country analysis', group: 'Analysis', hint: 'Country briefing deep dive' },
  { id: 'group-analysis', label: 'Group analysis', group: 'Analysis', hint: 'Group trends and dynamics' },
  { id: 'bilateral-analysis', label: 'Bilateral analysis', group: 'Analysis', hint: 'Relationship between two countries' },
  { id: 'compare-analysis', label: 'Country comparison', group: 'Analysis', hint: 'Side-by-side comparison' },
  { id: 'speech-summary', label: 'Speech analysis', group: 'Analysis', hint: 'Summaries of a country\'s speeches' },
  { id: 'cable', label: 'Diplomatic cable', group: 'Documents', hint: 'Formal cable drafts' },
  { id: 'meeting-doc', label: 'Bilateral meeting brief', group: 'Documents', hint: 'Talking points document' },
  { id: 'risk-score', label: 'Risk scores', group: 'Quick tasks', hint: 'Short structured scoring' },
  { id: 'anomalies', label: 'Anomaly detection', group: 'Quick tasks', hint: 'Short structured output' },
  { id: 'group-suggestions', label: 'Group suggestions', group: 'Quick tasks', hint: 'Short structured output' },
  { id: 'smart-search', label: 'Smart search', group: 'Quick tasks', hint: 'Interprets search queries; speed matters' },
  { id: 'chat', label: 'Intelligence chat', group: 'Chat', hint: 'Interactive answers; speed matters' },
  { id: 'ask', label: 'Ask the database', group: 'Chat', hint: 'Research desk: looks up the data, then answers or writes a briefing (needs tool support)' },
] as const
export type AITaskId = typeof AI_TASKS[number]['id']

export interface AIConfig {
  activeProvider: string | null
  providers: AIProviderConfig[]
  /** task id -> provider id; tasks not listed use the active provider */
  taskModels?: Record<string, string>
  prompts?: AIPromptConfig
  pulseStyle?: PulseStyleConfig
}

const DATA_DIR = process.env.WCG_SITE_DATA
  || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
const DATA_PATH = join(DATA_DIR, 'ai-config.json')

let cache: AIConfig | null = null

function loadData(): AIConfig {
  if (cache) return cache
  try {
    if (existsSync(DATA_PATH)) {
      cache = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
      return cache!
    }
  } catch {}
  const data: AIConfig = { activeProvider: null, providers: [] }
  saveData(data)
  return data
}

function saveData(data: AIConfig) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2))
  cache = data
}

export function getAIConfig(): AIConfig {
  return loadData()
}

export function getActiveProvider(): AIProviderConfig | null {
  const config = loadData()
  if (!config.activeProvider) return null
  return config.providers.find(p => p.id === config.activeProvider && p.enabled) || null
}

/** Provider for a task: its assigned provider if set and enabled, otherwise the active one. */
export function getProviderForTask(task?: string): AIProviderConfig | null {
  const config = loadData()
  const assigned = task ? config.taskModels?.[task] : undefined
  if (assigned) {
    const p = config.providers.find(x => x.id === assigned && x.enabled)
    if (p) return p
  }
  return getActiveProvider()
}

export function getTaskModels(): Record<string, string> {
  return { ...(loadData().taskModels || {}) }
}

export function setTaskModels(map: Record<string, string>) {
  const config = loadData()
  const ids = new Set(config.providers.map(p => p.id))
  const valid = new Set(AI_TASKS.map(t => t.id as string))
  config.taskModels = Object.fromEntries(Object.entries(map || {}).filter(([t, id]) => valid.has(t) && id && ids.has(id)))
  saveData(config)
}

export function setActiveProvider(id: string | null) {
  const config = loadData()
  if (id && !config.providers.find(p => p.id === id)) {
    throw new Error(`Provider '${id}' not found`)
  }
  config.activeProvider = id
  saveData(config)
}

export function addProvider(provider: AIProviderConfig) {
  const config = loadData()
  if (config.providers.find(p => p.id === provider.id)) {
    throw new Error(`Provider '${provider.id}' already exists`)
  }
  config.providers.push(provider)
  if (!config.activeProvider) config.activeProvider = provider.id
  saveData(config)
}

export function updateProvider(id: string, partial: Partial<AIProviderConfig>) {
  const config = loadData()
  const idx = config.providers.findIndex(p => p.id === id)
  if (idx === -1) throw new Error(`Provider '${id}' not found`)
  config.providers[idx] = { ...config.providers[idx], ...partial, id }
  saveData(config)
}

export function removeProvider(id: string) {
  const config = loadData()
  config.providers = config.providers.filter(p => p.id !== id)
  if (config.taskModels) {
    for (const [t, pid] of Object.entries(config.taskModels)) if (pid === id) delete config.taskModels[t]
  }
  if (config.activeProvider === id) {
    config.activeProvider = config.providers.find(p => p.enabled)?.id || null
  }
  saveData(config)
}

export function getPromptConfig(): AIPromptConfig {
  return loadData().prompts || {}
}

export function setPromptConfig(prompts: AIPromptConfig) {
  const config = loadData()
  config.prompts = prompts
  saveData(config)
}

export function getPulseStyleConfig(): PulseStyleConfig {
  return { ...DEFAULT_PULSE_STYLE, ...loadData().pulseStyle }
}

export function setPulseStyleConfig(style: Partial<PulseStyleConfig>) {
  const config = loadData()
  config.pulseStyle = { ...DEFAULT_PULSE_STYLE, ...config.pulseStyle, ...style }
  // Clamp values
  config.pulseStyle.temperature = Math.max(0, Math.min(1.5, config.pulseStyle.temperature))
  config.pulseStyle.speakerStyleAdherence = Math.max(0, Math.min(100, config.pulseStyle.speakerStyleAdherence))
  saveData(config)
}
