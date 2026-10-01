import { getRegistry } from '~/server/utils/wcg'
import { getBilateralVotingAlignment } from '~/server/utils/unvotes'
import { getCountryCrossReferences, getCountrySpeeches } from '~/server/utils/speeches'
import { getCountryGDELT } from '~/server/utils/gdelt'
import { getCountryVDem } from '~/server/utils/vdem'
import { getVisaPair } from '~/server/utils/visa'
import { getCountrySIPRI } from '~/server/utils/sipri'
import { getCountryODA } from '~/server/utils/oda'
import { getCountryAlliances } from '~/server/utils/alliances'
import { getCountryConflict } from '~/server/utils/conflict'

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

    // New enriched data
    regimeComparison: (() => {
      const vdemA = getCountryVDem(iso3A)
      const vdemB = getCountryVDem(iso3B)
      if (!vdemA && !vdemB) return null
      return { a: vdemA, b: vdemB }
    })(),

    visaRelationship: (() => {
      const aToB = getVisaPair(iso3A, iso3B)
      const bToA = getVisaPair(iso3B, iso3A)
      if (!aToB && !bToA) return null
      return { aToB, bToA }
    })(),

    armsRelationship: (() => {
      const sipriA = getCountrySIPRI(iso3A)
      const sipriB = getCountrySIPRI(iso3B)
      if (!sipriA && !sipriB) return null
      const aSuppliesB = sipriA?.top_recipients?.find((r: any) => r.iso3 === iso3B)
      const bSuppliesA = sipriB?.top_recipients?.find((r: any) => r.iso3 === iso3A)
      return {
        a: sipriA ? { total_exports: sipriA.total_exports, total_imports: sipriA.total_imports, export_rank: sipriA.export_rank, import_rank: sipriA.import_rank } : null,
        b: sipriB ? { total_exports: sipriB.total_exports, total_imports: sipriB.total_imports, export_rank: sipriB.export_rank, import_rank: sipriB.import_rank } : null,
        aSuppliesB: aSuppliesB ? { iso3: aSuppliesB.iso3, value: aSuppliesB.tiv } : null,
        bSuppliesA: bSuppliesA ? { iso3: bSuppliesA.iso3, value: bSuppliesA.tiv } : null,
      }
    })(),

    aidRelationship: (() => {
      const odaA = getCountryODA(iso3A)
      const odaB = getCountryODA(iso3B)
      if (!odaA && !odaB) return null
      const aGivesB = odaA?.top_recipients?.find((r: any) => r.iso3 === iso3B)
      const bGivesA = odaB?.top_recipients?.find((r: any) => r.iso3 === iso3A)
      return {
        a: odaA ? { is_donor: odaA.is_donor, total_given: odaA.total_given, total_received: odaA.total_received, oda_gni_ratio: odaA.oda_gni_ratio } : null,
        b: odaB ? { is_donor: odaB.is_donor, total_given: odaB.total_given, total_received: odaB.total_received, oda_gni_ratio: odaB.oda_gni_ratio } : null,
        aGivesB: aGivesB ? { iso3: aGivesB.iso3, value: aGivesB.total } : null,
        bGivesA: bGivesA ? { iso3: bGivesA.iso3, value: bGivesA.total } : null,
      }
    })(),

    allianceRelationship: (() => {
      const alliA = getCountryAlliances(iso3A)
      const alliB = getCountryAlliances(iso3B)
      if (!alliA?.has_data && !alliB?.has_data) return null
      const alliancesA = new Set(alliA?.alliances?.map((a: any) => a.name) || [])
      const shared = alliB?.alliances?.filter((a: any) => alliancesA.has(a.name)).map((a: any) => a.name) || []
      return {
        a: alliA?.profile || null,
        b: alliB?.profile || null,
        sharedAlliances: [...new Set(shared)],
      }
    })(),

    conflictProfile: (() => {
      const conflictA = getCountryConflict(iso3A)
      const conflictB = getCountryConflict(iso3B)
      if (!conflictA && !conflictB) return null
      return {
        a: conflictA ? { total_events: conflictA.total_events, total_fatalities: conflictA.total_fatalities, conflict_intensity: conflictA.conflict_intensity, trend: conflictA.trend } : null,
        b: conflictB ? { total_events: conflictB.total_events, total_fatalities: conflictB.total_fatalities, conflict_intensity: conflictB.conflict_intensity, trend: conflictB.trend } : null,
      }
    })(),
  }
})
