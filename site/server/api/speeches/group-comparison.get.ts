import { getRegistry } from '~/server/utils/wcg'
import { getGroupSentimentBySession, getThemesByDecade } from '~/server/utils/speeches'

const DEFAULT_SELECTIONS = ['lldcs', 'g77', 'developing-ex-lldcs', 'eu', 'USA', 'canz']

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const selections = query.groups
    ? (query.groups as string).split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_SELECTIONS

  const registry = getRegistry()
  const groups: {
    gid: string
    name: string
    type: 'group' | 'country'
    sentimentTimeline: ReturnType<typeof getGroupSentimentBySession>
  }[] = []

  for (const id of selections) {
    // Try as a group first
    const group = registry.getGroup(id)
    if (group) {
      const iso3Codes = group.countries.map((c: any) => c.iso3)
      const timeline = getGroupSentimentBySession(iso3Codes)
      if (timeline.length) {
        groups.push({
          gid: id,
          name: group.acronym || group.name,
          type: 'group',
          sentimentTimeline: timeline,
        })
      }
      continue
    }

    // Try as a country ISO3 code
    const membership = registry.getCountryMembership(id)
    if (membership) {
      const timeline = getGroupSentimentBySession([membership.iso3])
      if (timeline.length) {
        groups.push({
          gid: id,
          name: membership.name,
          type: 'country',
          sentimentTimeline: timeline,
        })
      }
    }
  }

  const themeHeatmap = getThemesByDecade()

  return { groups, themeHeatmap }
})
