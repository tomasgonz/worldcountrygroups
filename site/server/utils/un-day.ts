const NY_TZ = 'America/New_York'

function nyParts(date: Date): { year: number; month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]))
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    year: parseInt(parts.year),
    month: parseInt(parts.month),
    day: parseInt(parts.day),
    weekday: weekdays.indexOf(parts.weekday),
  }
}

function ymd({ year, month, day }: { year: number; month: number; day: number }): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getNYTodayKey(now: Date = new Date()): string {
  return ymd(nyParts(now))
}

export function getNYWeekRange(now: Date = new Date()): { startKey: string; endKey: string } {
  const today = nyParts(now)
  const endKey = ymd(today)
  const startDate = new Date(Date.UTC(today.year, today.month - 1, today.day))
  startDate.setUTCDate(startDate.getUTCDate() - 6)
  const startKey = ymd({
    year: startDate.getUTCFullYear(),
    month: startDate.getUTCMonth() + 1,
    day: startDate.getUTCDate(),
  })
  return { startKey, endKey }
}

export function isInNYToday(isoTimestamp: string, now: Date = new Date()): boolean {
  if (!isoTimestamp) return false
  const dt = new Date(isoTimestamp)
  if (isNaN(dt.getTime())) return false
  return ymd(nyParts(dt)) === getNYTodayKey(now)
}

export function isInNYWindow(isoTimestamp: string, hoursBack: number, now: Date = new Date()): boolean {
  if (!isoTimestamp) return false
  const dt = new Date(isoTimestamp)
  if (isNaN(dt.getTime())) return false
  return now.getTime() - dt.getTime() <= hoursBack * 3600 * 1000
}

export function nyHourNow(now: Date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    hour: '2-digit',
    hour12: false,
  })
  return parseInt(fmt.format(now).replace(/[^\d]/g, ''))
}

export function formatNYDateLong(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now)
}
