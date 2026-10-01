import { getCountryConflict } from './conflict'
import { getCountryVDem } from './vdem'
import { getCountrySanctions } from './sanctions'
import { getCountryGDELT } from './gdelt'
import { getCountryAlliances } from './alliances'
import { getRegistry } from './wcg'
import { getCountryData } from './countrydata'

export interface TrendAlert {
  id: string
  type: 'conflict_escalation' | 'democracy_decline' | 'new_sanctions' | 'sentiment_shift' | 'alliance_change'
  severity: 'high' | 'medium' | 'low'
  iso3: string
  countryName: string
  title: string
  detail: string
}

const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function detectTrendAlerts(): TrendAlert[] {
  const registry = getRegistry()
  const allCountries = registry.getAllCountries()
  const alerts: TrendAlert[] = []

  for (const country of allCountries) {
    const iso3 = country.iso3
    const name = country.name

    // Conflict escalation
    try {
      const conflict = getCountryConflict(iso3)
      if (conflict?.trend?.length >= 2) {
        const sorted = [...conflict.trend].sort((a, b) => b.year - a.year)
        const latest = sorted[0]
        const prev = sorted[1]
        if (prev.events > 0) {
          const eventChange = (latest.events - prev.events) / prev.events
          if (eventChange > 0.5) {
            alerts.push({
              id: `conflict-${iso3}`,
              type: 'conflict_escalation',
              severity: 'high',
              iso3, countryName: name,
              title: `Conflict escalation in ${name}`,
              detail: `Events increased ${Math.round(eventChange * 100)}% (${prev.events} → ${latest.events}) between ${prev.year} and ${latest.year}.`
            })
          } else if (eventChange > 0.2) {
            alerts.push({
              id: `conflict-${iso3}`,
              type: 'conflict_escalation',
              severity: 'medium',
              iso3, countryName: name,
              title: `Rising conflict in ${name}`,
              detail: `Events increased ${Math.round(eventChange * 100)}% (${prev.events} → ${latest.events}) between ${prev.year} and ${latest.year}.`
            })
          }
        }
      }
    } catch {}

    // Democracy decline
    try {
      const vdem = getCountryVDem(iso3)
      if (vdem?.trend?.length >= 2) {
        const sorted = [...vdem.trend].sort((a, b) => b.year - a.year)
        const latest = sorted[0]
        const prev = sorted[1]
        if (latest.v2x_polyarchy != null && prev.v2x_polyarchy != null) {
          const drop = prev.v2x_polyarchy - latest.v2x_polyarchy
          if (drop > 0.1) {
            alerts.push({
              id: `democracy-${iso3}`,
              type: 'democracy_decline',
              severity: 'high',
              iso3, countryName: name,
              title: `Major democratic decline in ${name}`,
              detail: `Polyarchy dropped ${drop.toFixed(3)} (${prev.v2x_polyarchy.toFixed(3)} → ${latest.v2x_polyarchy.toFixed(3)}).`
            })
          } else if (drop > 0.05) {
            alerts.push({
              id: `democracy-${iso3}`,
              type: 'democracy_decline',
              severity: 'medium',
              iso3, countryName: name,
              title: `Democratic backsliding in ${name}`,
              detail: `Polyarchy dropped ${drop.toFixed(3)} (${prev.v2x_polyarchy.toFixed(3)} → ${latest.v2x_polyarchy.toFixed(3)}).`
            })
          }
        }
      }
    } catch {}

    // Active sanctions
    try {
      const sanctions = getCountrySanctions(iso3)
      if (sanctions?.length) {
        alerts.push({
          id: `sanctions-${iso3}`,
          type: 'new_sanctions',
          severity: sanctions.length >= 3 ? 'high' : 'medium',
          iso3, countryName: name,
          title: `${name} under ${sanctions.length} sanctions regime(s)`,
          detail: sanctions.slice(0, 3).map(s => s.name).join('; ')
        })
      }
    } catch {}

    // GDELT negativity
    try {
      const gdelt = getCountryGDELT(iso3)
      if (gdelt?.events?.cooperation_ratio != null && gdelt.events.cooperation_ratio < 0.3 && gdelt.events.total > 50) {
        alerts.push({
          id: `sentiment-${iso3}`,
          type: 'sentiment_shift',
          severity: 'medium',
          iso3, countryName: name,
          title: `High negativity for ${name}`,
          detail: `GDELT cooperation ratio at ${(gdelt.events.cooperation_ratio * 100).toFixed(0)}% across ${gdelt.events.total} events.`
        })
      }
    } catch {}

    // Alliance dissolution
    try {
      const allianceData = getCountryAlliances(iso3)
      if (allianceData?.alliances?.length) {
        const currentYear = new Date().getFullYear()
        const recentDissolutions = allianceData.alliances.filter(
          a => a.end_year && a.end_year >= currentYear - 5
        )
        if (recentDissolutions.length > 0) {
          alerts.push({
            id: `alliance-${iso3}`,
            type: 'alliance_change',
            severity: 'low',
            iso3, countryName: name,
            title: `Alliance changes for ${name}`,
            detail: `${recentDissolutions.length} alliance(s) ended recently: ${recentDissolutions.slice(0, 2).map(a => a.name || a.id).join(', ')}`
          })
        }
      }
    } catch {}
  }

  // Sort by severity, then by type
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))

  return alerts
}
