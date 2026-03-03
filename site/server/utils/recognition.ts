import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.cwd(), 'server', 'data', 'recognition.json')
const ALT_DIR = join(process.env.HOME || '/home', 'worldcountrygroups', 'site', 'server', 'data')
const DATA_FILE_ALT = join(ALT_DIR, 'recognition.json')

interface Entity {
  id: string
  name: string
  declared: string
  un_status: string
  recognizers: string[]
  withdrawn: string[]
  total_recognizers: number
}

interface RecognitionData {
  _meta: { last_updated: string; entity_count: number }
  entities: Entity[]
}

let _data: RecognitionData | null = null

function resolve(primary: string, alt: string): string | null {
  if (existsSync(primary)) return primary
  if (existsSync(alt)) return alt
  return null
}

function ensureLoaded(): void {
  if (_data !== null) return
  const filePath = resolve(DATA_FILE, DATA_FILE_ALT)
  if (!filePath) {
    _data = { _meta: { last_updated: '', entity_count: 0 }, entities: [] }
    return
  }
  try {
    _data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    _data = { _meta: { last_updated: '', entity_count: 0 }, entities: [] }
  }
}

export function getAllEntities(): RecognitionData {
  ensureLoaded()
  return _data!
}

export function getCountryRecognitionStance(iso3: string): {
  entity: { id: string; name: string; declared: string; un_status: string; total_recognizers: number }
  stance: 'recognizes' | 'withdrawn' | 'does_not_recognize'
}[] {
  ensureLoaded()
  const code = iso3.toUpperCase()
  return _data!.entities.map(e => {
    let stance: 'recognizes' | 'withdrawn' | 'does_not_recognize' = 'does_not_recognize'
    if (e.recognizers.includes(code)) stance = 'recognizes'
    else if (e.withdrawn.includes(code)) stance = 'withdrawn'
    return {
      entity: { id: e.id, name: e.name, declared: e.declared, un_status: e.un_status, total_recognizers: e.total_recognizers },
      stance,
    }
  })
}

export function getGroupRecognitionProfile(iso3Codes: string[]): {
  entity: { id: string; name: string; total_recognizers: number }
  recognizers: number
  withdrawn: number
  non_recognizers: number
  total: number
}[] {
  ensureLoaded()
  const codes = new Set(iso3Codes.map(c => c.toUpperCase()))
  const total = codes.size

  return _data!.entities.map(e => {
    let recognizers = 0, withdrawn = 0, non_recognizers = 0
    for (const code of codes) {
      if (e.recognizers.includes(code)) recognizers++
      else if (e.withdrawn.includes(code)) withdrawn++
      else non_recognizers++
    }
    return {
      entity: { id: e.id, name: e.name, total_recognizers: e.total_recognizers },
      recognizers,
      withdrawn,
      non_recognizers,
      total,
    }
  })
}
