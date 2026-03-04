import { getRegistry } from '~/server/utils/wcg'
import { getGroupThemeTrends, getGroupVotingData, getGroupMemberDivergence } from '~/server/utils/unvotes'
import { getGroupSentimentBySession, getGroupEmergingTopics, getConflictMentions } from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const gid = (query.gid as string || '').toLowerCase()

  if (!gid) {
    throw createError({ statusCode: 400, statusMessage: 'Missing gid parameter' })
  }

  const registry = getRegistry()
  const group = registry.getGroup(gid)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group '${gid}' not found` })
  }

  const iso3Codes = group.countries.map((c: any) => c.iso3)

  // Theme evolution (voting)
  const themeTrends = getGroupThemeTrends(iso3Codes)

  // Cohesion
  const votingData = getGroupVotingData(iso3Codes)

  // Sentiment by session
  const sentimentBySession = getGroupSentimentBySession(iso3Codes)

  // Emerging topics
  const emergingTopics = getGroupEmergingTopics(iso3Codes, 3)

  // ISO3 → country name lookup
  const nameMap = new Map(group.countries.map((c: any) => [c.iso3, c.name]))

  // Conflict mentions filtered to group members' speeches
  const allConflicts = getConflictMentions()
  const memberSet = new Set(iso3Codes.map((c: string) => c.toUpperCase()))
  const filteredConflicts = allConflicts.map(c => {
    const memberStances = c.stances.filter(s => memberSet.has(s.iso3))
      .map(s => ({ ...s, name: nameMap.get(s.iso3) || s.iso3 }))
    return { ...c, stances: memberStances, memberMentions: memberStances.length }
  }).filter(c => c.memberMentions > 0).sort((a, b) => b.memberMentions - a.memberMentions).slice(0, 10)

  // Member divergence — enrich with country names
  const memberDivergence = getGroupMemberDivergence(iso3Codes)
    .map(m => ({ ...m, name: nameMap.get(m.iso3) || m.iso3 }))

  // Cohesion trend (extract session-level cohesion)
  const cohesionEntries = Object.entries(votingData.cohesion)
    .filter(([k]) => k.startsWith('session_'))
    .map(([k, v]) => ({ session: parseInt(k.replace('session_', '')), cohesion: v }))
    .sort((a, b) => a.session - b.session)

  return {
    group: {
      gid: group.gid,
      acronym: group.acronym,
      name: group.name,
      memberCount: group.countries.length,
    },
    themeTrends: themeTrends.slice(0, 12),
    cohesion: {
      overall: votingData.cohesion.overall || null,
      trend: cohesionEntries,
    },
    emergingTopics,
    sentimentBySession,
    conflicts: filteredConflicts,
    memberDivergence: memberDivergence.slice(0, 15),
  }
})
