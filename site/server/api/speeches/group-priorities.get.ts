import { getAllSpeeches, getSpeechesMeta, type SpeechMeta } from '~/server/utils/speeches'
import { getRegistry } from '~/server/utils/wcg'

const GROUPS = ['ag', 'grulac', 'ldcs', 'lldcs', 'sids', 'weog', 'eeg', 'ap', 'eu', 'g77', 'brics', 'nam', 'aosis'] as const
const THEMES = ['peace_security', 'climate_change', 'multilateralism', 'human_rights', 'sustainable_development'] as const
const THEME_LABELS: Record<string, string> = {
  'peace_security': 'Peace',
  'climate_change': 'Climate',
  'multilateralism': 'Multilateralism',
  'human_rights': 'Human Rights',
  'sustainable_development': 'Sust. Dev.',
}

function extractTopTopics(speeches: SpeechMeta[], limit = 5): string[] {
  const counts = new Map<string, number>()
  for (const s of speeches) {
    if (!s.analysis?.policy_positions) continue
    for (const p of s.analysis.policy_positions) {
      const topic = p.topic.toLowerCase().trim().replace(/_/g, ' ')
      if (topic.length > 2 && topic.length < 50) {
        counts.set(topic, (counts.get(topic) || 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t)
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const sessionParam = query.session as string | undefined
  const session = sessionParam ? parseInt(sessionParam, 10) : undefined

  const meta = getSpeechesMeta()
  const latestSession = meta.sessions.length > 0 ? Math.max(...meta.sessions) : undefined
  const effectiveSession = session ?? latestSession

  const allSpeeches = getAllSpeeches()
  const speeches = effectiveSession != null
    ? allSpeeches.filter(s => s.session === effectiveSession)
    : allSpeeches
  const registry = getRegistry()

  // Build iso3 → speech data lookups
  const iso3HighThemes = new Map<string, Set<string>>()
  const iso3HasAnalysis = new Set<string>()
  const iso3Speeches = new Map<string, SpeechMeta[]>()
  for (const s of speeches) {
    if (!s.analysis?.themes) continue
    iso3HasAnalysis.add(s.iso3)
    const existing = iso3HighThemes.get(s.iso3) || new Set<string>()
    for (const t of s.analysis.themes) {
      if (t.relevance === 'high') existing.add(t.name)
    }
    iso3HighThemes.set(s.iso3, existing)
    const arr = iso3Speeches.get(s.iso3) || []
    arr.push(s)
    iso3Speeches.set(s.iso3, arr)
  }

  const groups = GROUPS.map(gid => {
    const group = registry.getGroup(gid)
    if (!group) return null

    const memberIso3s = group.countries.map(c => c.iso3).filter(Boolean)
    const membersWithSpeeches = memberIso3s.filter(iso => iso3HasAnalysis.has(iso))
    const total = membersWithSpeeches.length

    if (total === 0) return null

    const priorities: Record<string, number> = {}
    for (const theme of THEMES) {
      let count = 0
      for (const iso of membersWithSpeeches) {
        const high = iso3HighThemes.get(iso)
        if (high && high.has(theme)) count++
      }
      priorities[theme] = Math.round((count / total) * 100)
    }

    // Collect all speeches for this group's members
    const groupSpeeches: SpeechMeta[] = []
    for (const iso of membersWithSpeeches) {
      const arr = iso3Speeches.get(iso)
      if (arr) groupSpeeches.push(...arr)
    }

    const emergingTopics = extractTopTopics(groupSpeeches)

    return {
      gid,
      name: group.acronym || group.name,
      fullName: group.name,
      memberCount: memberIso3s.length,
      speechCount: total,
      priorities,
      emergingTopics,
    }
  }).filter(Boolean)

  return {
    groups,
    themes: [...THEMES],
    themeLabels: THEME_LABELS,
    meta: {
      totalSpeeches: speeches.length,
      year: speeches[0]?.year || 2025,
      session: effectiveSession ?? null,
    },
  }
})
