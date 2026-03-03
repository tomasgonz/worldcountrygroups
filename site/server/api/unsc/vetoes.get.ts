import { getAllVetoes, getVetoStats } from '~/server/utils/vetoes'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const data = getAllVetoes()
  const stats = getVetoStats()

  let vetoes = data.vetoes

  // Filter by country
  if (query.country) {
    const country = (query.country as string).toUpperCase()
    vetoes = vetoes.filter(v => v.vetoed_by.includes(country))
  }

  // Filter by search text
  if (query.search) {
    const q = (query.search as string).toLowerCase()
    vetoes = vetoes.filter(v => v.subject.toLowerCase().includes(q))
  }

  // Sort by date descending
  vetoes = [...vetoes].sort((a, b) => b.date.localeCompare(a.date))

  return {
    _meta: data._meta,
    stats,
    total: vetoes.length,
    vetoes,
  }
})
