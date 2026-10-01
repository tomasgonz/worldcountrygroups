import { getRegistry } from './wcg'

// Access internal resolution data via the unvotes module
// We use a dynamic require to access the module's loaded state
let _getResolutions: (() => any[]) | null = null

function getResolutions(): any[] {
  if (!_getResolutions) {
    // Lazy import to avoid circular deps
    const unvotes = require('./unvotes')
    // Ensure data is loaded by calling a function
    unvotes.getAvailableSessions()
    _getResolutions = () => {
      // Access resolutions via searchResolutions with broad params
      const meta = unvotes.getUNVotesMeta()
      if (!meta) return []
      const sessions = unvotes.getAvailableSessions() as number[]
      return { sessions, search: unvotes.searchResolutions.bind(unvotes) }
    }
  }
  return (_getResolutions as any)()
}

export interface VotingBloc {
  id: number
  members: string[]
  memberNames: { iso3: string; name: string }[]
  size: number
  cohesion: number
  matchingGroups: { gid: string; acronym: string; name: string; jaccard: number }[]
}

interface BlocCache {
  blocs: VotingBloc[]
  computedAt: string
  threshold: number
  sessions: number
}

let _cache: BlocCache | null = null
let _cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export function detectVotingBlocs(opts: {
  sessions?: number
  threshold?: number
  minBlocSize?: number
} = {}): { blocs: VotingBloc[]; computedAt: string } {
  const sessionsCount = opts.sessions ?? 5
  const threshold = opts.threshold ?? 0.80
  const minBlocSize = opts.minBlocSize ?? 3

  // Check cache
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL && _cache.threshold === threshold && _cache.sessions === sessionsCount) {
    return { blocs: _cache.blocs, computedAt: _cache.computedAt }
  }

  // We need to work with raw resolution data
  // Use the searchResolutions function to get recent resolutions
  const unvotes = require('./unvotes')
  unvotes.getAvailableSessions() // ensure loaded

  const availSessions = unvotes.getAvailableSessions() as number[]
  const targetSessions = availSessions.sort((a: number, b: number) => b - a).slice(0, sessionsCount)

  // Get resolutions for these sessions
  const allResolutions: any[] = []
  for (const session of targetSessions) {
    const result = unvotes.searchResolutions({ session, limit: 5000 })
    if (result?.resolutions) {
      allResolutions.push(...result.resolutions)
    }
  }

  if (!allResolutions.length) {
    return { blocs: [], computedAt: new Date().toISOString() }
  }

  // Build vote matrix: count per country how many valid votes
  const countryVotes = new Map<string, number>()
  for (const res of allResolutions) {
    if (!res.v) continue
    for (const [iso3, vote] of Object.entries(res.v)) {
      if (vote === 'X') continue
      countryVotes.set(iso3, (countryVotes.get(iso3) || 0) + 1)
    }
  }

  // Filter countries with >= 50 votes
  const eligibleCountries = [...countryVotes.entries()]
    .filter(([_, count]) => count >= 50)
    .map(([iso3]) => iso3)

  if (eligibleCountries.length < minBlocSize) {
    return { blocs: [], computedAt: new Date().toISOString() }
  }

  // Compute pairwise agreement matrix
  const agreement = new Map<string, number>()
  const compared = new Map<string, number>()

  for (const res of allResolutions) {
    if (!res.v) continue
    const voters = eligibleCountries.filter(c => res.v[c] && res.v[c] !== 'X')
    for (let i = 0; i < voters.length; i++) {
      for (let j = i + 1; j < voters.length; j++) {
        const key = voters[i] < voters[j] ? `${voters[i]}-${voters[j]}` : `${voters[j]}-${voters[i]}`
        compared.set(key, (compared.get(key) || 0) + 1)
        if (res.v[voters[i]] === res.v[voters[j]]) {
          agreement.set(key, (agreement.get(key) || 0) + 1)
        }
      }
    }
  }

  // Build adjacency graph (edge if agreement >= threshold)
  const adjacency = new Map<string, Set<string>>()
  for (const c of eligibleCountries) {
    adjacency.set(c, new Set())
  }

  for (const [key, agreeCount] of agreement.entries()) {
    const comparedCount = compared.get(key) || 1
    const ratio = agreeCount / comparedCount
    if (ratio >= threshold && comparedCount >= 20) {
      const [a, b] = key.split('-')
      adjacency.get(a)?.add(b)
      adjacency.get(b)?.add(a)
    }
  }

  // Find connected components via BFS
  const visited = new Set<string>()
  const components: string[][] = []

  for (const country of eligibleCountries) {
    if (visited.has(country)) continue
    const component: string[] = []
    const queue = [country]
    visited.add(country)

    while (queue.length) {
      const node = queue.shift()!
      component.push(node)
      for (const neighbor of adjacency.get(node) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    if (component.length >= minBlocSize) {
      components.push(component)
    }
  }

  // Compute internal cohesion per component
  const registry = getRegistry()
  const allGroups = registry.listSummaries()

  const blocs: VotingBloc[] = components.map((members, idx) => {
    // Cohesion = average pairwise agreement within the bloc
    let totalAgreement = 0
    let totalPairs = 0
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const key = members[i] < members[j] ? `${members[i]}-${members[j]}` : `${members[j]}-${members[i]}`
        const agreeCount = agreement.get(key) || 0
        const comparedCount = compared.get(key) || 1
        totalAgreement += agreeCount / comparedCount
        totalPairs++
      }
    }
    const cohesion = totalPairs > 0 ? totalAgreement / totalPairs : 0

    // Find best-matching official groups (Jaccard similarity)
    const memberSet = new Set(members)
    const matchingGroups: { gid: string; acronym: string; name: string; jaccard: number }[] = []

    for (const group of allGroups) {
      const groupCountries = registry.getCountries(group.gid)
      if (!groupCountries) continue
      const groupIso3s = new Set(groupCountries.map(c => c.iso3))
      const intersection = members.filter(m => groupIso3s.has(m)).length
      if (intersection === 0) continue
      const union = new Set([...members, ...groupIso3s]).size
      const jaccard = intersection / union
      if (jaccard > 0.1) {
        matchingGroups.push({ gid: group.gid, acronym: group.acronym, name: group.name, jaccard })
      }
    }
    matchingGroups.sort((a, b) => b.jaccard - a.jaccard)

    const memberNames = members.map(iso3 => {
      const m = registry.getCountryMembership(iso3)
      return { iso3, name: m?.name || iso3 }
    })

    return {
      id: idx + 1,
      members,
      memberNames,
      size: members.length,
      cohesion: Math.round(cohesion * 1000) / 1000,
      matchingGroups: matchingGroups.slice(0, 5),
    }
  })

  // Sort by size desc
  blocs.sort((a, b) => b.size - a.size)

  const result = { blocs, computedAt: new Date().toISOString() }
  _cache = { ...result, threshold, sessions: sessionsCount }
  _cacheTime = now
  return result
}
