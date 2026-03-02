import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// Resolve data dir: works both in dev (site/) and production (.output/)
const DATA_DIR = process.env.WCG_DATA_DIR || join(process.env.HOME || '/home/exedev', 'worldcountrygroups', 'worldcountrygroups', 'data', 'groups')

export interface Country {
  name: string
  iso2: string
  iso3: string
}

export interface Group {
  gid: string
  acronym: string
  name: string
  description: string
  classifier: string
  domains: string[]
  countries: Country[]
}

export interface GroupSummary {
  gid: string
  acronym: string
  name: string
  description: string
  classifier: string
  domains: string[]
  country_count: number
}

export interface CountryMembership {
  name: string
  iso2: string
  iso3: string
  groups: GroupSummary[]
}

// Normalize hidden unicode characters in country names
function normalize(s: string): string {
  return s.replace(/[\u200B-\u200D\uFEFF]/g, '')
}

class GroupRegistry {
  private groups: Map<string, Group> = new Map()
  private iso2ToGids: Map<string, Set<string>> = new Map()
  private iso3ToGids: Map<string, Set<string>> = new Map()
  private iso2ToCountry: Map<string, Country> = new Map()
  private iso3ToCountry: Map<string, Country> = new Map()
  private loaded = false

  private ensureLoaded(): void {
    if (!this.loaded) this.load()
  }

  private load(): void {
    const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort()
    for (const file of files) {
      const raw = readFileSync(join(DATA_DIR, file), 'utf-8')
      const data = JSON.parse(raw) as Group
      // Normalize country names
      data.countries = data.countries.map(c => ({
        ...c,
        name: normalize(c.name),
      }))
      this.groups.set(data.gid, data)
      for (const country of data.countries) {
        const iso2 = country.iso2.toUpperCase()
        const iso3 = country.iso3.toUpperCase()
        if (iso2) {
          if (!this.iso2ToGids.has(iso2)) this.iso2ToGids.set(iso2, new Set())
          this.iso2ToGids.get(iso2)!.add(data.gid)
          this.iso2ToCountry.set(iso2, country)
        }
        if (iso3) {
          if (!this.iso3ToGids.has(iso3)) this.iso3ToGids.set(iso3, new Set())
          this.iso3ToGids.get(iso3)!.add(data.gid)
          this.iso3ToCountry.set(iso3, country)
        }
      }
    }
    this.loaded = true
  }

  listGroups(): string[] {
    this.ensureLoaded()
    return [...this.groups.keys()].sort()
  }

  getGroup(gid: string): Group | null {
    this.ensureLoaded()
    return this.groups.get(gid.toLowerCase()) ?? null
  }

  getCountries(gid: string): Country[] | null {
    const group = this.getGroup(gid)
    return group ? [...group.countries] : null
  }

  getSummary(group: Group): GroupSummary {
    return {
      gid: group.gid,
      acronym: group.acronym,
      name: group.name,
      description: group.description,
      classifier: group.classifier,
      domains: group.domains,
      country_count: group.countries.length,
    }
  }

  listSummaries(): GroupSummary[] {
    this.ensureLoaded()
    return [...this.groups.values()]
      .sort((a, b) => a.gid.localeCompare(b.gid))
      .map(g => this.getSummary(g))
  }

  getCountryMembership(iso: string): CountryMembership | null {
    this.ensureLoaded()
    const isoUpper = iso.toUpperCase()
    let country: Country | undefined
    let gids: Set<string> | undefined

    if (this.iso2ToCountry.has(isoUpper)) {
      country = this.iso2ToCountry.get(isoUpper)
      gids = this.iso2ToGids.get(isoUpper)
    } else if (this.iso3ToCountry.has(isoUpper)) {
      country = this.iso3ToCountry.get(isoUpper)
      gids = this.iso3ToGids.get(isoUpper)
    }

    if (!country || !gids) return null

    const groups = [...gids].sort().map(gid => this.getSummary(this.groups.get(gid)!))
    return {
      name: country.name,
      iso2: country.iso2,
      iso3: country.iso3,
      groups,
    }
  }

  searchGroups(opts: { q?: string; country?: string; domain?: string }): Group[] {
    this.ensureLoaded()
    let results: Group[] | null = null

    if (opts.country) {
      const countryUpper = opts.country.toUpperCase()
      const gids = new Set<string>()

      if (this.iso2ToGids.has(countryUpper)) {
        for (const gid of this.iso2ToGids.get(countryUpper)!) gids.add(gid)
      } else if (this.iso3ToGids.has(countryUpper)) {
        for (const gid of this.iso3ToGids.get(countryUpper)!) gids.add(gid)
      } else {
        const countryLower = opts.country.toLowerCase()
        for (const group of this.groups.values()) {
          for (const c of group.countries) {
            if (c.name.toLowerCase().includes(countryLower)) {
              gids.add(group.gid)
            }
          }
        }
      }

      const matched = [...gids].map(gid => this.groups.get(gid)!)
      results = results === null ? matched : results.filter(g => matched.includes(g))
    }

    if (opts.domain) {
      const domainLower = opts.domain.toLowerCase()
      const matched = [...this.groups.values()].filter(g =>
        g.domains.some(d => d.toLowerCase().includes(domainLower))
      )
      results = results === null ? matched : results.filter(g => matched.includes(g))
    }

    if (opts.q) {
      const qLower = opts.q.toLowerCase()
      const matched = [...this.groups.values()].filter(g =>
        g.name.toLowerCase().includes(qLower) ||
        g.description.toLowerCase().includes(qLower) ||
        g.acronym.toLowerCase().includes(qLower)
      )
      results = results === null ? matched : results.filter(g => matched.includes(g))
    }

    if (results === null) results = [...this.groups.values()]
    return results.sort((a, b) => a.gid.localeCompare(b.gid))
  }

  getAllDomains(): string[] {
    this.ensureLoaded()
    const domains = new Set<string>()
    for (const group of this.groups.values()) {
      for (const d of group.domains) domains.add(d)
    }
    return [...domains].sort()
  }
}

// Module-level singleton
let _registry: GroupRegistry | null = null

export function getRegistry(): GroupRegistry {
  if (!_registry) _registry = new GroupRegistry()
  return _registry
}
