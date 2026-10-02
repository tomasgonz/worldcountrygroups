import { getRegistry } from './wcg'
import { getRecentResolutions, getResolutionThemes } from './unvotes'
import { detectVotingBlocs } from './voting-blocs'

/**
 * General Assembly voting dynamics, all computed on contested votes
 * (>=10% of voters departed from the majority), with graded agreement
 * (same vote = 1, abstain vs yes/no = 0.5, yes vs no = 0):
 *  - map: classical multidimensional scaling of the agreement matrix (2-D)
 *  - drift: change in each country's West–South position versus an earlier period
 *  - divides: West–South agreement by subject
 *  - loyalty: how often members vote with their group's majority
 *  - bridges: countries agreeing substantially with both reference groups
 */

// Reference groups for the West–South axis (large, consistently participating members)
export const WEST = ['DEU', 'FRA', 'GBR', 'ITA', 'ESP', 'NLD', 'POL', 'SWE', 'BEL', 'CZE', 'DNK', 'NOR']
export const SOUTH = ['BRA', 'IND', 'IDN', 'ZAF', 'NGA', 'EGY', 'MEX', 'KEN', 'PAK', 'BGD', 'ETH', 'VNM']

const VALUE: Record<string, number> = { Y: 1, A: 0.5, N: 0 }
type Res = { id: string; s: number; d: string; t: string; v: Record<string, string> }

function contestedOnly(rs: Res[]): Res[] {
  return rs.filter((r) => {
    const votes = Object.values(r.v).filter(v => v in VALUE)
    if (votes.length < 100) return false
    const c: Record<string, number> = {}
    for (const v of votes) c[v] = (c[v] || 0) + 1
    return (votes.length - Math.max(...Object.values(c))) / votes.length >= 0.10
  })
}

function agreement(rs: Res[], a: string, b: string, minShared = 15): number | null {
  let s = 0, t = 0
  for (const r of rs) {
    const x = r.v[a], y = r.v[b]
    if (x in VALUE && y in VALUE) { s += 1 - Math.abs(VALUE[x] - VALUE[y]); t++ }
  }
  return t >= minShared ? s / t : null
}

const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null }
const groupAgreement = (rs: Res[], c: string, G: string[]) => mean(G.filter(g => g !== c).map(g => agreement(rs, c, g)))
const participation = (rs: Res[], c: string) => rs.length ? rs.filter(r => r.v[c] in VALUE).length / rs.length : 0

/** Top-2 principal coordinates of a distance matrix (classical MDS, power iteration). */
function mds2(D: number[][]): [number[], number[]] {
  const n = D.length
  const D2 = D.map(r => r.map(x => x * x))
  const rowMean = D2.map(r => r.reduce((a, b) => a + b, 0) / n)
  const all = rowMean.reduce((a, b) => a + b, 0) / n
  const B = D2.map((r, i) => r.map((x, j) => -0.5 * (x - rowMean[i] - rowMean[j] + all)))
  const eig = (deflate: { v: number[]; l: number } | null) => {
    let v = Array.from({ length: n }, (_, i) => Math.sin(i + 1))
    let l = 0
    for (let it = 0; it < 200; it++) {
      const w = B.map(r => r.reduce((a, x, j) => a + x * v[j], 0))
      if (deflate) { const d = deflate.v.reduce((a, x, j) => a + x * v[j], 0); for (let i = 0; i < n; i++) w[i] -= deflate.l * deflate.v[i] * d }
      const norm = Math.sqrt(w.reduce((a, x) => a + x * x, 0)) || 1
      l = norm
      v = w.map(x => x / norm)
    }
    return { v, l }
  }
  const e1 = eig(null)
  const e2 = eig(e1)
  return [e1.v.map(x => x * Math.sqrt(e1.l)), e2.v.map(x => x * Math.sqrt(e2.l))]
}

const _cache = new Map<string, { at: number; value: any }>()

export function votingDynamics(opts: { sessions?: number; gap?: number; threshold?: number } = {}) {
  const sessions = opts.sessions ?? 5
  const gap = opts.gap ?? 10
  const threshold = opts.threshold ?? 0.85
  const key = `${sessions}:${gap}:${threshold}`
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.value

  const all = getRecentResolutions(sessions + gap) as Res[]
  const sessionList = [...new Set(all.map(r => r.s))].sort((a, b) => b - a)
  const recentSessions = new Set(sessionList.slice(0, sessions))
  const earlierSessions = new Set(sessionList.slice(gap, gap + sessions))
  const recent = contestedOnly(all.filter(r => recentSessions.has(r.s)))
  const earlier = contestedOnly(all.filter(r => earlierSessions.has(r.s)))

  const registry = getRegistry()
  const EXTRA: Record<string, [string, string]> = { PSE: ['State of Palestine', 'PS'], VAT: ['Holy See', 'VA'], COD: ['DR Congo', 'CD'], KOR: ['Republic of Korea', 'KR'], PRK: ['DPR Korea', 'KP'], IRN: ['Iran', 'IR'], SYR: ['Syria', 'SY'], RUS: ['Russian Federation', 'RU'], VEN: ['Venezuela', 'VE'], EGY: ['Egypt', 'EG'] }
  const info = (iso3: string) => {
    const m = registry.getCountryMembership(iso3)
    return { iso3, name: EXTRA[iso3]?.[0] || m?.name || iso3, iso2: m?.iso2 || EXTRA[iso3]?.[1] || '' }
  }

  // countries active enough in the recent period
  const voters = [...new Set(recent.flatMap(r => Object.keys(r.v)))].filter(c => participation(recent, c) >= 0.6).sort()
  const westOf = (rs: Res[], c: string) => groupAgreement(rs, c, WEST)
  const southOf = (rs: Res[], c: string) => groupAgreement(rs, c, SOUTH)

  // ---- map ----
  const n = voters.length
  const S = voters.map((a, i) => voters.map((b, j) => (i === j ? 1 : agreement(recent, a, b) ?? 0.5)))
  const [xs, ys] = mds2(S.map(r => r.map(s => 1 - s)))
  // orient: Western reference group to the right, keep the second axis's sign stable (USA up)
  const idx = (c: string) => voters.indexOf(c)
  const westX = mean(WEST.map(c => (idx(c) >= 0 ? xs[idx(c)] : null))) || 0
  const sx = westX < 0 ? -1 : 1
  const sy = idx('USA') >= 0 && ys[idx('USA')] < 0 ? -1 : 1
  const blocs = detectVotingBlocs({ sessions, threshold })
  const blocOf = new Map<string, number>()
  for (const b of blocs.blocs) for (const m of b.members) blocOf.set(m, b.id)
  const map = voters.map((c, i) => ({ ...info(c), x: Math.round(xs[i] * sx * 1000) / 1000, y: Math.round(ys[i] * sy * 1000) / 1000, bloc: blocOf.get(c) ?? null }))

  // ---- West–South position now and then ----
  const position = (rs: Res[], c: string) => {
    const w = westOf(rs, c), s = southOf(rs, c)
    return w == null || s == null ? null : w - s
  }
  const drift = voters
    .filter(c => participation(earlier, c) >= 0.6 && !WEST.includes(c) && !SOUTH.includes(c))
    .map((c) => {
      const before = position(earlier, c), now = position(recent, c)
      return before == null || now == null ? null : { ...info(c), before: Math.round(before * 1000) / 1000, now: Math.round(now * 1000) / 1000, change: Math.round((now - before) * 1000) / 1000 }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.change - a.change)

  // ---- divides by subject ----
  const byTheme = new Map<string, Res[]>()
  for (const r of recent) for (const t of getResolutionThemes(r.id).length ? getResolutionThemes(r.id) : ['Other']) {
    if (!byTheme.has(t)) byTheme.set(t, [])
    byTheme.get(t)!.push(r)
  }
  const divides = [...byTheme.entries()]
    .filter(([t, rs]) => rs.length >= 8 && t !== 'Other')
    .map(([theme, rs]) => {
      const pairs = WEST.flatMap(w => SOUTH.map(s => agreement(rs, w, s, 5)))
      return { theme, votes: rs.length, westSouth: Math.round((mean(pairs) || 0) * 1000) / 1000,
        withinWest: Math.round((mean(WEST.flatMap((a, i) => WEST.slice(i + 1).map(b => agreement(rs, a, b, 5)))) || 0) * 1000) / 1000,
        withinSouth: Math.round((mean(SOUTH.flatMap((a, i) => SOUTH.slice(i + 1).map(b => agreement(rs, a, b, 5)))) || 0) * 1000) / 1000 }
    })
    .sort((a, b) => a.westSouth - b.westSouth)

  // ---- bridges ----
  const bridges = voters
    .filter(c => !WEST.includes(c) && !SOUTH.includes(c))
    .map(c => ({ ...info(c), west: westOf(recent, c) || 0, south: southOf(recent, c) || 0 }))
    .map(c => ({ ...c, west: Math.round(c.west * 1000) / 1000, south: Math.round(c.south * 1000) / 1000, score: Math.min(c.west, c.south) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  const value = {
    meta: {
      recent: { sessions: [...recentSessions].sort((a, b) => a - b), contested: recent.length },
      earlier: { sessions: [...earlierSessions].sort((a, b) => a - b), contested: earlier.length },
      countries: n,
      west: WEST.map(info),
      south: SOUTH.map(info),
    },
    map,
    blocs: blocs.blocs.map((b: any) => ({ id: b.id, label: b.label, size: b.size })),
    drift: { toWest: drift.slice(0, 12), awayFromWest: drift.slice(-12).reverse() },
    divides,
    bridges,
  }
  _cache.set(key, { at: Date.now(), value })
  return value
}

/** How often each member of a group votes with the group's majority (contested votes). */
export function groupLoyalty(gid: string, sessions = 5) {
  const registry = getRegistry()
  const g = registry.getGroup(gid)
  if (!g) return null
  const members = g.countries.map(c => c.iso3).filter(Boolean)
  const rs = contestedOnly(getRecentResolutions(sessions) as Res[])
  const majority = (r: Res) => {
    const c: Record<string, number> = {}
    for (const m of members) { const v = r.v[m]; if (v in VALUE) c[v] = (c[v] || 0) + 1 }
    const e = Object.entries(c).sort((a, b) => b[1] - a[1])[0]
    return e ? e[0] : null
  }
  const maj = rs.map(majority)
  const rows = members.map((m) => {
    let agree = 0, total = 0
    rs.forEach((r, i) => { const v = r.v[m]; if (maj[i] && v in VALUE) { total++; if (v === maj[i]) agree++ } })
    const mm = registry.getCountryMembership(m)
    return { iso3: m, name: mm?.name || m, iso2: mm?.iso2 || '', loyalty: total >= 15 ? Math.round((agree / total) * 1000) / 1000 : null, votes: total }
  }).filter(r => r.loyalty != null).sort((a, b) => (a.loyalty as number) - (b.loyalty as number))
  const vals = rows.map(r => r.loyalty as number).sort((a, b) => a - b)
  return {
    gid, name: g.name, acronym: g.acronym,
    median: vals.length ? vals[Math.floor(vals.length / 2)] : null,
    contested: rs.length,
    members: rows,
  }
}
