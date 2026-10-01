import { isoToFlag, useCountries } from '~/composables/useGroups'

/**
 * Makes AI briefings easier to scan: country names become linked chips with a flag,
 * UN bodies get their own style, and key terms get a coloured underline by theme.
 * Works on the markdown before it is rendered, in one regex pass so markup is never nested.
 */

export const HIGHLIGHT_THEMES = [
  { key: 'sec', label: 'Peace & security', color: '#e34948',
    terms: ['ceasefire', 'cease-fire', 'veto', 'vetoed', 'vetoes', 'war', 'wars', 'conflict', 'conflicts', 'escalation', 'attack', 'attacks', 'airstrike', 'airstrikes', 'troops', 'sanctions', 'nuclear', 'terrorism', 'terrorist', 'invasion', 'peacekeeping', 'peacekeepers', 'non-proliferation', 'weapons', 'missile', 'missiles', 'hostilities'] },
  { key: 'hum', label: 'Humanitarian', color: '#eda100',
    terms: ['humanitarian', 'famine', 'hunger', 'refugees', 'displaced', 'displacement', 'civilians', 'casualties', 'relief', 'evacuation', 'cholera', 'outbreak', 'malnutrition'] },
  { key: 'dev', label: 'Development & climate', color: '#1baf7a',
    terms: ['climate', 'SDGs', 'SDG', 'financing', 'debt', 'tariffs', 'energy', 'emissions', 'COP31', 'COP30', 'biodiversity', 'food security', 'poverty'] },
  { key: 'rights', label: 'Rights & justice', color: '#4a3aa7',
    terms: ['human rights', 'accountability', 'justice', 'impunity', 'genocide', 'war crimes', 'crimes against humanity', 'detention', 'torture', 'democracy', 'elections'] },
] as const

const UN_BODIES = ['Security Council', 'General Assembly', 'Secretary-General', 'Deputy Secretary-General', 'Human Rights Council', 'ECOSOC',
  'Economic and Social Council', 'International Court of Justice', 'ICJ', 'International Criminal Court', 'ICC', 'OCHA', 'UNHCR', 'UNICEF',
  'WFP', 'WHO', 'OHCHR', 'UNRWA', 'IAEA', 'UNDP', 'UNEP', 'DPPA', 'Peacebuilding Commission', 'First Committee', 'Second Committee',
  'Third Committee', 'Fourth Committee', 'Fifth Committee', 'Sixth Committee', 'ACABQ', 'UNIFIL', 'MONUSCO', 'UNMISS', 'BINUH', 'UN80']

// Common names the briefings use that differ from the dataset's official names
const ALIASES: Record<string, string> = {
  'United States': 'USA', 'U.S.': 'USA', 'US': 'USA', 'Washington': 'USA', 'Russia': 'RUS', 'Moscow': 'RUS', 'China': 'CHN', 'Beijing': 'CHN',
  'United Kingdom': 'GBR', 'UK': 'GBR', 'Britain': 'GBR', 'Iran': 'IRN', 'Tehran': 'IRN', 'Syria': 'SYR', 'Venezuela': 'VEN', 'Bolivia': 'BOL',
  'Palestine': 'PSE', 'Gaza': 'PSE', 'West Bank': 'PSE', 'State of Palestine': 'PSE', 'DRC': 'COD', 'DR Congo': 'COD',
  'Democratic Republic of the Congo': 'COD', 'South Korea': 'KOR', 'Republic of Korea': 'KOR', 'North Korea': 'PRK', 'DPRK': 'PRK',
  'Türkiye': 'TUR', 'Turkey': 'TUR', 'Egypt': 'EGY', 'Yemen': 'YEM', 'Laos': 'LAO', 'Vietnam': 'VNM', 'Viet Nam': 'VNM', 'Moldova': 'MDA',
  'Tanzania': 'TZA', 'Czech Republic': 'CZE', 'Czechia': 'CZE', 'Slovakia': 'SVK', 'Kyrgyzstan': 'KGZ', 'Micronesia': 'FSM',
  'Ivory Coast': 'CIV', "Côte d'Ivoire": 'CIV', 'Gambia': 'GMB', 'Bahamas': 'BHS', 'Brunei': 'BRN', 'Holy See': 'VAT', 'Kyiv': 'UKR',
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function useBriefHighlight() {
  const { countries } = useCountries()

  const index = computed(() => {
    const byName = new Map<string, { iso3: string; iso2: string }>()
    const iso2Of = new Map<string, string>()
    for (const c of ((countries.value as any[]) || [])) {
      if (!c.iso3) continue
      iso2Of.set(c.iso3, c.iso2)
      // skip awkward dataset names like "Congo, Dem. Rep."
      if (!/[,(]/.test(c.name)) byName.set(c.name, { iso3: c.iso3, iso2: c.iso2 })
    }
    for (const [name, iso3] of Object.entries(ALIASES)) byName.set(name, { iso3, iso2: iso2Of.get(iso3) || '' })
    const themeOf = new Map<string, string>()
    for (const t of HIGHLIGHT_THEMES) {
      for (const term of t.terms) {
        themeOf.set(term.toLowerCase(), t.key)
      }
    }
    const names = [...byName.keys()].sort((a, b) => b.length - a.length).map(esc)
    const bodies = [...UN_BODIES].sort((a, b) => b.length - a.length).map(esc)
    const terms = [...themeOf.keys()].sort((a, b) => b.length - a.length)
      .flatMap(t => [t, t[0].toUpperCase() + t.slice(1)]).map(esc)
    // Case-sensitive so "US" never matches "us"; terms are listed in lower and capitalised forms
    const re = new RegExp(`(?<![\\w-])(?:(${names.join('|')})|(${bodies.join('|')})|(${terms.join('|')}))(?![\\w-])`, 'g')
    return { byName, themeOf, re }
  })

  /** Returns markdown with inline HTML spans; pass the result to marked. */
  function highlight(md: string): string {
    if (!md) return ''
    const { byName, themeOf, re } = index.value
    const flagged = new Set<string>()
    const underlined = new Set<string>() // underline each key term once, so the text stays calm
    // leave markdown link targets / existing HTML / citation markers untouched
    return md.split(/(<[^>]+>|\]\([^)]*\)|\[[ns]\d+(?:\s*,\s*[ns]\d+)*\])/).map((chunk, i) => {
      if (i % 2 === 1) return chunk
      return chunk.replace(re, (m, country, body, term) => {
        if (country) {
          const c = byName.get(country)
          if (!c) return m
          const flag = !flagged.has(c.iso3) && c.iso2 ? `<span class="hl-flag" aria-hidden="true">${isoToFlag(c.iso2)}</span>` : ''
          flagged.add(c.iso3)
          return `<a href="/countries/${c.iso3.toLowerCase()}" class="hl-country">${flag}${m}</a>`
        }
        if (body) return `<span class="hl-un">${m}</span>`
        const key = themeOf.get(term.toLowerCase())
        if (!key || underlined.has(term.toLowerCase())) return m
        underlined.add(term.toLowerCase())
        return `<span class="hl-term hl-${key}">${m}</span>`
      })
    }).join('')
  }

  return { highlight }
}
