import { getRegistry } from './wcg'
import { getRecentResolutions } from './unvotes'

/**
 * Voting bloc detection for the General Assembly.
 *
 * Most Assembly resolutions pass almost unanimously, so agreement over *all* votes
 * puts nearly every country in one bloc. Instead we:
 *   1. keep only contested votes (at least 10% of voters departed from the majority);
 *   2. score each pair of countries: same vote = 1, yes vs abstain or no vs abstain = 0.5,
 *      yes vs no = 0, averaged over the contested votes both took part in;
 *   3. cluster with average linkage: two groups merge only while the average agreement
 *      between all their members stays at or above the threshold.
 * Countries left in groups smaller than three are reported as unaligned, with their
 * closest bloc.
 */

export interface VotingBloc {
  id: number
  label: string
  members: string[]
  memberNames: { iso3: string; name: string; iso2: string }[]
  size: number
  cohesion: number
  yesRate: number
  matchingGroups: { gid: string; acronym: string; name: string; jaccard: number }[]
}

export interface UnalignedCountry {
  iso3: string
  name: string
  iso2: string
  closestBloc: number | null
  closestLabel: string
  agreement: number
}

const VALUE: Record<string, number> = { Y: 1, A: 0.5, N: 0 }
const CONTESTED_SHARE = 0.10
const MIN_SHARED = 20

const _cache = new Map<string, { at: number; value: any }>()
const CACHE_TTL = 30 * 60 * 1000

export function detectVotingBlocs(opts: { sessions?: number; threshold?: number; minBlocSize?: number } = {}) {
  const sessionsCount = opts.sessions ?? 5
  const threshold = opts.threshold ?? 0.85
  const minBlocSize = opts.minBlocSize ?? 3
  const key = `${sessionsCount}:${threshold}`
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.value

  const resolutions = getRecentResolutions(sessionsCount)
  const contested = resolutions.filter((r) => {
    const votes = Object.values(r.v).filter(v => v === 'Y' || v === 'N' || v === 'A')
    if (votes.length < 100) return false
    const counts: Record<string, number> = {}
    for (const v of votes) counts[v] = (counts[v] || 0) + 1
    const majority = Math.max(...Object.values(counts))
    return (votes.length - majority) / votes.length >= CONTESTED_SHARE
  })

  // countries that took part in at least 60% of the contested votes
  const participation = new Map<string, number>()
  for (const r of contested) for (const [c, v] of Object.entries(r.v)) if (v in VALUE) participation.set(c, (participation.get(c) || 0) + 1)
  const countries = [...participation.entries()].filter(([, n]) => n >= 0.6 * contested.length).map(([c]) => c).sort()
  const n = countries.length

  const registry = getRegistry()
  const EXTRA: Record<string, [string, string]> = { PSE: ['State of Palestine', 'PS'], VAT: ['Holy See', 'VA'], COD: ['DR Congo', 'CD'], KOR: ['Republic of Korea', 'KR'], PRK: ['DPR Korea', 'KP'], IRN: ['Iran', 'IR'], SYR: ['Syria', 'SY'], RUS: ['Russian Federation', 'RU'] }
  const info = (iso3: string) => {
    const m = registry.getCountryMembership(iso3)
    return { iso3, name: EXTRA[iso3]?.[0] || m?.name || iso3, iso2: m?.iso2 || EXTRA[iso3]?.[1] || '' }
  }
  const empty = { blocs: [], unaligned: [], blocAgreement: [], computedAt: new Date().toISOString(), meta: { resolutions: resolutions.length, contested: contested.length, countries: n } }
  if (n < minBlocSize) return empty

  // pairwise agreement on contested votes
  const vec = countries.map(c => contested.map(r => (r.v[c] in VALUE ? VALUE[r.v[c]] : null)))
  const sim: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    sim[i][i] = 1
    for (let j = i + 1; j < n; j++) {
      let s = 0, t = 0
      const a = vec[i], b = vec[j]
      for (let k = 0; k < a.length; k++) {
        if (a[k] === null || b[k] === null) continue
        s += 1 - Math.abs((a[k] as number) - (b[k] as number)); t++
      }
      sim[i][j] = sim[j][i] = t >= MIN_SHARED ? s / t : 0
    }
  }

  // average-linkage agglomerative clustering (Lance-Williams update)
  let clusters: number[][] = countries.map((_, i) => [i])
  const link: number[][] = sim.map(row => [...row])
  const alive = new Array(n).fill(true)
  while (true) {
    let best = -1, bi = -1, bj = -1
    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue
      for (let j = i + 1; j < n; j++) {
        if (alive[j] && link[i][j] > best) { best = link[i][j]; bi = i; bj = j }
      }
    }
    if (bi < 0 || best < threshold) break
    const si = clusters[bi].length, sj = clusters[bj].length
    for (let k = 0; k < n; k++) {
      if (!alive[k] || k === bi || k === bj) continue
      link[bi][k] = link[k][bi] = (si * link[bi][k] + sj * link[bj][k]) / (si + sj)
    }
    clusters[bi] = clusters[bi].concat(clusters[bj])
    alive[bj] = false
  }
  clusters = clusters.filter((_, i) => alive[i])

  const avgSim = (A: number[], B: number[]) => {
    let s = 0, t = 0
    for (const a of A) for (const b of B) if (a !== b) { s += sim[a][b]; t++ }
    return t ? s / t : 1
  }
  const blocIdx = clusters.filter(c => c.length >= minBlocSize).sort((a, b) => b.length - a.length)
  const loners = clusters.filter(c => c.length < minBlocSize).flat()

  // the members that vote most like the rest of their bloc, for naming unmatched blocs
  const centralNames = (idx: number[]) => idx
    .map(i => ({ i, c: avgSim([i], idx) }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 3)
    .map(x => info(countries[x.i]).name)
    .join(', ')

  const allGroups = registry.listSummaries()
  const blocs: VotingBloc[] = blocIdx.map((idx, b) => {
    const members = idx.map(i => countries[i])
    const memberSet = new Set(members)
    const matchingGroups = allGroups.map((g) => {
      const gc = new Set((registry.getCountries(g.gid) || []).map(c => c.iso3))
      const inter = members.filter(m => gc.has(m)).length
      return { gid: g.gid, acronym: g.acronym, name: g.name, jaccard: inter ? inter / new Set([...members, ...gc]).size : 0 }
    }).filter(g => g.jaccard > 0.1).sort((a, b2) => b2.jaccard - a.jaccard).slice(0, 4)
    let yes = 0, tot = 0
    for (const r of contested) for (const m of memberSet) { const v = r.v[m]; if (v in VALUE) { tot++; if (v === 'Y') yes++ } }
    const top = matchingGroups[0]
    return {
      id: b + 1,
      // small blocs are named by their members; larger ones by the group they most resemble
      label: members.length <= 4
        ? members.map(m => info(m).name).sort().join(', ')
        : top && top.jaccard >= 0.3 ? `Close to ${top.name}` : `${centralNames(idx)} and others`,
      members,
      memberNames: members.map(info).sort((x, y) => x.name.localeCompare(y.name)),
      size: members.length,
      cohesion: Math.round(avgSim(idx, idx) * 1000) / 1000,
      yesRate: tot ? Math.round((yes / tot) * 1000) / 1000 : 0,
      matchingGroups,
    }
  })

  const unaligned: UnalignedCountry[] = loners.map((i) => {
    let best: { id: number; s: number } | null = null
    blocIdx.forEach((idx, b) => { const s = avgSim([i], idx); if (!best || s > best.s) best = { id: b + 1, s } })
    const bb = best as { id: number; s: number } | null
    return { ...info(countries[i]), closestBloc: bb?.id ?? null, closestLabel: bb ? blocs[bb.id - 1].label : '', agreement: bb ? Math.round(bb.s * 1000) / 1000 : 0 }
  }).sort((a, b) => a.name.localeCompare(b.name))

  const blocAgreement = blocIdx.map((A, a) => blocIdx.map((B, b) => (a === b ? null : Math.round(avgSim(A, B) * 1000) / 1000)))

  const value = {
    blocs,
    unaligned,
    blocAgreement,
    computedAt: new Date().toISOString(),
    meta: {
      resolutions: resolutions.length,
      contested: contested.length,
      countries: n,
      sessions: [...new Set(resolutions.map(r => r.s))].sort((a, b) => a - b),
    },
  }
  _cache.set(key, { at: Date.now(), value })
  return value
}
