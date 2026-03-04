import { getRegistry } from '~/server/utils/wcg'
import { getCountrySpeeches } from '~/server/utils/speeches'
import { getCountryAlignmentScores, getCountryThemeStats, getCountryThemeTrends } from '~/server/utils/unvotes'
import { getCountryGDELT } from '~/server/utils/gdelt'
import { getCountryConflict } from '~/server/utils/conflict'
import { getMilitaryCapabilities } from '~/server/utils/military'
import { getCountrySanctions } from '~/server/utils/sanctions'
import { getCountryTreatyStatus } from '~/server/utils/treaties'
import { getCountryData } from '~/server/utils/countrydata'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const iso = (query.iso as string || '').toUpperCase()
  if (!iso) {
    throw createError({ statusCode: 400, statusMessage: 'Missing iso parameter' })
  }

  const registry = getRegistry()
  const membership = registry.getCountryMembership(iso)
  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: `Country '${iso}' not found` })
  }

  const iso3 = membership.iso3
  const iso2 = membership.iso2

  // ISO3 → name lookup helper
  const countryName = (code: string) => registry.getCountryMembership(code)?.name || code

  // Gather all data in parallel-style (all sync in-memory)
  const speeches = getCountrySpeeches(iso3)
  const p5Codes = ['USA', 'GBR', 'FRA', 'RUS', 'CHN']
  const alignment = getCountryAlignmentScores(iso3, { sessions: 10, limit: 10 })
  const p5Alignment = alignment.mostAligned
    .filter(a => p5Codes.includes(a.iso3))
    .concat(alignment.leastAligned.filter(a => p5Codes.includes(a.iso3)))
    // Deduplicate
    .filter((a, i, arr) => arr.findIndex(x => x.iso3 === a.iso3) === i)
  const themeStats = getCountryThemeStats(iso3)
  const themeTrends = getCountryThemeTrends(iso3)
  const gdelt = getCountryGDELT(iso3)
  const conflict = getCountryConflict(iso3)
  const military = getMilitaryCapabilities(iso3)
  const sanctions = getCountrySanctions(iso3)
  const treaties = getCountryTreatyStatus(iso3)
  const countryData = getCountryData(iso2)
  const groups = membership.groups

  // Latest speech
  const latestSpeech = speeches.length > 0 ? speeches[0] : null

  // Speech mentions — who this country talks about and who talks about them
  const mentionedByUs: { iso3: string; context: string; count: number }[] = []
  const mentionsMap = new Map<string, { context: string; count: number }>()
  for (const s of speeches.slice(0, 10)) {
    if (!s.analysis?.mentioned_countries) continue
    for (const mc of s.analysis.mentioned_countries) {
      const key = mc.iso3.toUpperCase()
      const existing = mentionsMap.get(key)
      if (existing) {
        existing.count++
      } else {
        mentionsMap.set(key, { context: mc.context, count: 1 })
      }
    }
  }
  for (const [code, data] of mentionsMap) {
    mentionedByUs.push({ iso3: code, ...data })
  }
  mentionedByUs.sort((a, b) => b.count - a.count)

  return {
    country: {
      name: membership.name,
      iso2,
      iso3,
      region: countryData?.region || null,
      subregion: countryData?.subregion || null,
      capital: countryData?.capital || null,
      income_group: countryData?.income_group || null,
      population: countryData?.population || null,
      gdp: countryData?.gdp || null,
    },
    latestSpeech: latestSpeech ? {
      session: latestSpeech.session,
      year: latestSpeech.year,
      speaker: latestSpeech.speaker,
      speaker_title: latestSpeech.speaker_title,
      date: latestSpeech.date,
      summary: latestSpeech.analysis?.summary || null,
      sentiment: latestSpeech.analysis?.sentiment || null,
      key_quotes: latestSpeech.analysis?.key_quotes || [],
      policy_positions: latestSpeech.analysis?.policy_positions || [],
      mentioned_conflicts: latestSpeech.analysis?.mentioned_conflicts || [],
    } : null,
    totalSpeeches: speeches.length,
    themeStats: themeStats.slice(0, 15),
    themeTrends: themeTrends.slice(0, 10),
    votingAlignment: {
      p5: p5Alignment.map(a => ({ ...a, name: countryName(a.iso3) })),
      mostAligned: alignment.mostAligned.slice(0, 5).map(a => ({ ...a, name: countryName(a.iso3) })),
      leastAligned: alignment.leastAligned.slice(0, 5).map(a => ({ ...a, name: countryName(a.iso3) })),
      sessionsUsed: alignment.sessionsUsed,
    },
    speechMentions: mentionedByUs.slice(0, 15).map(m => ({ ...m, name: countryName(m.iso3) })),
    gdelt: gdelt ? {
      media: gdelt.media,
      events: gdelt.events,
      topPartners: gdelt.bilateral.slice(0, 10),
    } : null,
    riskProfile: {
      conflict: conflict ? {
        total_events: conflict.total_events,
        total_fatalities: conflict.total_fatalities,
        conflict_intensity: conflict.conflict_intensity,
        trend: conflict.trend,
      } : null,
      sanctions: sanctions.length > 0 ? sanctions : null,
      military: military ? {
        rank: military.rank,
        power_index: military.power_index,
        active_military: military.active_military,
        defense_budget: military.defense_budget,
        aircraft_total: military.aircraft_total,
        naval_total: military.naval_total,
        tank_strength: military.tank_strength,
      } : null,
    },
    treaties: treaties.slice(0, 20),
    groups: groups.map(g => ({ gid: g.gid, acronym: g.acronym, name: g.name })),
  }
})
