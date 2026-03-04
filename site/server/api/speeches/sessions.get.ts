import { getSpeechesMeta, getAllSpeeches } from '~/server/utils/speeches'

export default defineEventHandler(() => {
  const meta = getSpeechesMeta()
  const speeches = getAllSpeeches()

  // Determine which sessions have AI analysis
  const analysisSessions = new Set<number>()
  for (const s of speeches) {
    if (s.analysis) analysisSessions.add(s.session)
  }

  return {
    sessions: meta.sessions,
    latest: meta.sessions.length > 0 ? Math.max(...meta.sessions) : null,
    analysisSessions: [...analysisSessions].sort((a, b) => a - b),
    totalSpeeches: meta.total_speeches,
  }
})
