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

export interface AIConfig {
  activeProvider: string | null
  providers: AIProviderConfig[]
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
