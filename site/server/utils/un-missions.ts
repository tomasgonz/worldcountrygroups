import { readDataFile } from './data-file'
import { getRegistry } from './wcg'

/** Permanent Missions in New York and their heads, from the UN Protocol Blue Book (un-missions.json). */
const REGIONS: [string, string][] = [['ag', 'African States'], ['eeg', 'Eastern European States'], ['grulac', 'Latin American and Caribbean States'], ['weog', 'Western European and other States']]

function regionOf(): Record<string, string> {
  const reg = getRegistry()
  const out: Record<string, string> = {}
  for (const [gid, label] of REGIONS) for (const c of ((reg.getGroup(gid) as any)?.countries || [])) if (c.iso3) out[c.iso3] = label
  return out
}

const isWoman = (title: string | null | undefined) => /\b(Ms|Mrs|Madam|Mme|Dame)\b/.test(title || '')
const years = (d: string | null) => (d ? (Date.now() - new Date(d).getTime()) / (365.25 * 86400_000) : null)

export function missions() {
  const f = readDataFile<any>('un-missions.json')
  if (!f) return null
  const reg = getRegistry()
  const region = regionOf()
  const list = (f.missions || []).map((m: any) => {
    const c: any = m.iso3 ? reg.getCountryMembership(m.iso3) : null
    const since = m.head?.credentials || m.head?.appointed || null
    return { ...m, iso2: c?.iso2 || null, region: m.member ? (region[m.iso3] || 'Asia-Pacific States') : null, since, years: years(since) }
  })
  const members = list.filter((m: any) => m.member)
  const heads = members.filter((m: any) => m.head)
  const today = Date.now()
  return {
    updatedAt: f._meta?.updated_at, source: f._meta?.source, sourceUrl: f._meta?.source_url,
    stats: {
      members: members.length, withPr: heads.length, vacant: members.length - heads.length,
      women: heads.filter((m: any) => isWoman(m.head.title)).length,
      newLast90: heads.filter((m: any) => m.head.credentials && today - new Date(m.head.credentials).getTime() < 90 * 86400_000).length,
      medianYears: (() => { const y = heads.map((m: any) => m.years).filter((x: any) => x != null).sort((a: number, b: number) => a - b); return y.length ? Math.round(y[Math.floor(y.length / 2)] * 10) / 10 : null })(),
    },
    recent: heads.filter((m: any) => m.head.credentials).sort((a: any, b: any) => b.head.credentials.localeCompare(a.head.credentials)).slice(0, 12),
    longest: heads.filter((m: any) => m.since).sort((a: any, b: any) => a.since.localeCompare(b.since)).slice(0, 10),
    missions: list,
  }
}

export function missionFor(iso3: string) {
  const f = readDataFile<any>('un-missions.json')
  const m = (f?.missions || []).find((x: any) => x.iso3 === iso3.toUpperCase())
  return m ? { ...m, updatedAt: f._meta?.updated_at } : null
}
