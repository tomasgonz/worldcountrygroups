import type { H3Event } from 'h3'
import { getUserPreferences } from './users'
import { buildIcs, countFeedEvents, feedUrls, type CalendarFeed, type CalendarFeedInclude } from './calendar-feeds'

/** Public origin of the site as seen by the browser (nginx sits behind the HTTPS proxy). */
export function siteOrigin(event: H3Event): string {
  const url = getRequestURL(event, { xForwardedHost: true })
  const local = /^(localhost|127\.|\[::1\])/.test(url.host)
  return `${local ? url.protocol : 'https:'}//${url.host}`
}

/** Shape returned by GET/POST /api/account/calendar. */
export function calendarResponse(event: H3Event, userId: string, feed: CalendarFeed | null, defaults: CalendarFeedInclude) {
  const origin = siteOrigin(event)
  const followed = getUserPreferences(userId).bookmarkedCountries?.length || 0
  if (!feed) return { enabled: false, include: defaults, feedUrl: null, webcalUrl: null, createdAt: null, followedCountries: followed, eventCount: 0 }
  let eventCount = 0
  try { eventCount = countFeedEvents(buildIcs(userId, { baseUrl: origin, include: feed.include })) } catch { /* data missing */ }
  return {
    enabled: true,
    include: feed.include,
    ...feedUrls(feed.token, origin),
    createdAt: feed.createdAt,
    followedCountries: followed,
    eventCount,
  }
}
