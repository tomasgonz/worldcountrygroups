import { getRegistry } from '~/server/utils/wcg'
import {
  getGroupSentimentBySession,
  getThemesByDecade,
} from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const gid = getRouterParam(event, 'gid') || ''
  const registry = getRegistry()
  const group = registry.getGroup(gid)

  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  const iso3Codes = group.countries.map((c: any) => c.iso3)

  return {
    sentimentTimeline: getGroupSentimentBySession(iso3Codes),
    themeHeatmap: getThemesByDecade(),
  }
})
