import { getRegistry } from '~/server/utils/wcg'
import { getBilateralVotingAlignment } from '~/server/utils/unvotes'
import { getCountryCrossReferences, getCountrySpeeches } from '~/server/utils/speeches'
import { getCountryGDELT } from '~/server/utils/gdelt'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const isoA = (query.a as string || '').toUpperCase()
  const isoB = (query.b as string || '').toUpperCase()

  if (!isoA || !isoB) {
    throw createError({ statusCode: 400, statusMessage: 'Missing a and b parameters' })
  }

  const registry = getRegistry()
  const memberA = registry.getCountryMembership(isoA)
  const memberB = registry.getCountryMembership(isoB)

  if (!memberA) throw createError({ statusCode: 404, statusMessage: `Country '${isoA}' not found` })
  if (!memberB) throw createError({ statusCode: 404, statusMessage: `Country '${isoB}' not found` })

  const iso3A = memberA.iso3
  const iso3B = memberB.iso3

  // Voting alignment
  const votingAlignment = getBilateralVotingAlignment(iso3A, iso3B)

  // Speech cross-references
  const crossRefs = getCountryCrossReferences(iso3A, iso3B)

  // Shared group memberships
  const groupsA = new Set(memberA.groups.map(g => g.gid))
  const sharedGroups = memberB.groups
    .filter(g => groupsA.has(g.gid))
    .map(g => ({ gid: g.gid, acronym: g.acronym, name: g.name }))

  // Latest speeches for position comparison
  const speechesA = getCountrySpeeches(iso3A)
  const speechesB = getCountrySpeeches(iso3B)
  const latestA = speechesA.length > 0 ? speechesA[0] : null
  const latestB = speechesB.length > 0 ? speechesB[0] : null

  // GDELT bilateral data
  const gdeltA = getCountryGDELT(iso3A)
  const gdeltB = getCountryGDELT(iso3B)

  // Find bilateral relationship from GDELT
  const bilateralFromA = gdeltA?.bilateral.find(b => b.partner === iso3B)
  const bilateralFromB = gdeltB?.bilateral.find(b => b.partner === iso3A)

  // Find key disagreements (themes where alignment is low)
  const divergencePoints = votingAlignment.perTheme
    .filter(t => t.alignment < 0.5 && t.resolutions >= 10)
    .sort((a, b) => a.alignment - b.alignment)
    .slice(0, 10)

  return {
    countryA: { name: memberA.name, iso2: memberA.iso2, iso3: iso3A },
    countryB: { name: memberB.name, iso2: memberB.iso2, iso3: iso3B },
    votingAlignment: {
      overall: votingAlignment.overall,
      resolutionsCompared: votingAlignment.resolutionsCompared,
      perTheme: votingAlignment.perTheme.slice(0, 15),
    },
    speechCrossRefs: {
      aMentionsB: crossRefs.aMentionsB.slice(0, 10),
      bMentionsA: crossRefs.bMentionsA.slice(0, 10),
      sharedThemes: crossRefs.sharedThemes.slice(0, 15),
    },
    sharedGroups,
    positionComparison: {
      a: latestA ? {
        session: latestA.session,
        year: latestA.year,
        speaker: latestA.speaker,
        speaker_title: latestA.speaker_title,
        summary: latestA.analysis?.summary || null,
        policy_positions: latestA.analysis?.policy_positions || [],
        sentiment: latestA.analysis?.sentiment || null,
        mentioned_conflicts: latestA.analysis?.mentioned_conflicts || [],
      } : null,
      b: latestB ? {
        session: latestB.session,
        year: latestB.year,
        speaker: latestB.speaker,
        speaker_title: latestB.speaker_title,
        summary: latestB.analysis?.summary || null,
        policy_positions: latestB.analysis?.policy_positions || [],
        sentiment: latestB.analysis?.sentiment || null,
        mentioned_conflicts: latestB.analysis?.mentioned_conflicts || [],
      } : null,
    },
    gdeltBilateral: bilateralFromA || bilateralFromB ? {
      events: bilateralFromA?.events || bilateralFromB?.events || 0,
      cooperative: bilateralFromA?.cooperative || bilateralFromB?.cooperative || 0,
      conflictual: bilateralFromA?.conflictual || bilateralFromB?.conflictual || 0,
      avg_tone: bilateralFromA?.avg_tone || bilateralFromB?.avg_tone || 0,
      cooperation_ratio: bilateralFromA?.cooperation_ratio || bilateralFromB?.cooperation_ratio || 0,
    } : null,
    divergencePoints,
  }
})
