import { detectTrendAlerts } from '~/server/utils/trend-detection'

let cache: { alerts: any[]; computedAt: string } | null = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export default defineEventHandler(() => {
  const now = Date.now()
  if (cache && now - cacheTime < CACHE_TTL) {
    return cache
  }

  const alerts = detectTrendAlerts()
  cache = { alerts, computedAt: new Date().toISOString() }
  cacheTime = now
  return cache
})
