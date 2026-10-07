import { readDataFile } from '~/server/utils/data-file'

/**
 * Quote repository search.
 * Query: q (text, matches quote, speaker or country), country (iso3, comma list), speaker,
 * theme, level, from, to (years), status (exact|close|all; default verified = exact+close),
 * sort (newest|oldest|relevance), page, size.
 */
interface Quote {
  id: string; q: string; iso3: string; iso2: string; country: string; session: number; year: number
  date: string; speaker: string; title: string; level: string; themes: string[]; tone: string
  status: 'exact' | 'close' | 'unverified'; url: string
  source?: 'debate' | 'statements'; sourceLabel?: string; context?: string | null
}

let _lower: { file: any; lc: string[] } | null = null
let _merged: { debate: any; said: any; file: { _meta: any; quotes: Quote[] } } | null = null

function fold(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default defineEventHandler((event) => {
  const debate = readDataFile<{ _meta: any; quotes: Quote[] }>('quotes-index.json')
  const said = readDataFile<{ _meta: any; quotes: Quote[] }>('quotes-said.json')
  if (!debate && !said) return { total: 0, quotes: [], facets: {}, meta: null }
  // one list: General Debate quotes and quotes from statements ("What was said"), rebuilt when either file changes
  if (!_merged || _merged.debate !== debate || _merged.said !== said) {
    _merged = { debate, said, file: { _meta: { ...(debate?._meta || {}), total: (debate?.quotes.length || 0) + (said?.quotes.length || 0), statements: said?.quotes.length || 0 }, quotes: [...(debate?.quotes || []).map(x => ({ ...x, source: 'debate' })), ...(said?.quotes || [])] as Quote[] } }
  }
  const file = _merged.file
  // lowercase haystacks, rebuilt only when the file changes
  if (!_lower || _lower.file !== file) {
    _lower = { file, lc: file.quotes.map(x => fold(`${x.q} ${x.speaker} ${x.country}`)) }
  }

  const qp = getQuery(event)
  const terms = fold(String(qp.q || '')).split(/\s+/).filter(t => t.length > 1)
  const phrase = /^".+"$/.test(String(qp.q || '').trim()) ? fold(String(qp.q).trim().slice(1, -1)) : ''
  const countries = new Set(String(qp.country || '').toUpperCase().split(',').filter(Boolean))
  const speaker = fold(String(qp.speaker || ''))
  const theme = String(qp.theme || '')
  const level = String(qp.level || '')
  const from = Number(qp.from) || 0
  const to = Number(qp.to) || 9999
  const status = String(qp.status || 'verified')
  const source = String(qp.source || '')
  const sort = String(qp.sort || (terms.length ? 'relevance' : 'newest'))
  const size = Math.min(100, Math.max(1, Number(qp.size) || 30))
  const page = Math.max(1, Number(qp.page) || 1)

  const hits: { x: Quote; score: number }[] = []
  file.quotes.forEach((x, i) => {
    if (status === 'verified' ? x.status === 'unverified' : status !== 'all' && x.status !== status) return
    if (source && (x.source || 'debate') !== source) return
    if (countries.size && !countries.has(x.iso3)) return
    if (x.year < from || x.year > to) return
    if (theme && !x.themes.includes(theme)) return
    if (level && x.level !== level) return
    if (speaker && !fold(x.speaker).includes(speaker)) return
    const hay = _lower!.lc[i]
    if (phrase && !hay.includes(phrase)) return
    let score = 0
    for (const t of terms) {
      if (!phrase && !hay.includes(t)) return
      score += fold(x.q).includes(t) ? 2 : 1
    }
    hits.push({ x, score })
  })

  if (sort === 'oldest') hits.sort((a, b) => a.x.year - b.x.year)
  else if (sort === 'relevance') hits.sort((a, b) => b.score - a.score || b.x.year - a.x.year)
  else hits.sort((a, b) => (b.x.date || String(b.x.year)).localeCompare(a.x.date || String(a.x.year)) || a.x.country.localeCompare(b.x.country))

  // facets over the matching set
  const byCountry = new Map<string, { iso3: string; iso2: string; name: string; count: number }>()
  const bySpeaker = new Map<string, { speaker: string; iso3: string; iso2: string; country: string; years: Set<number>; count: number }>()
  const byDecade = new Map<number, number>()
  for (const { x } of hits) {
    if (x.iso3) {
      const c = byCountry.get(x.iso3) || { iso3: x.iso3, iso2: x.iso2, name: x.country, count: 0 }
      c.count++; byCountry.set(x.iso3, c)
    }
    if (x.speaker) {
      const k = `${fold(x.speaker)}|${x.iso3}`
      const sp = bySpeaker.get(k) || { speaker: x.speaker, iso3: x.iso3, iso2: x.iso2, country: x.country, years: new Set<number>(), count: 0 }
      sp.count++; sp.years.add(x.year); bySpeaker.set(k, sp)
    }
    const d = Math.floor(x.year / 10) * 10
    byDecade.set(d, (byDecade.get(d) || 0) + 1)
  }

  return {
    total: hits.length,
    page,
    size,
    quotes: hits.slice((page - 1) * size, page * size).map(h => h.x),
    facets: {
      countries: [...byCountry.values()].sort((a, b) => b.count - a.count).slice(0, 12),
      speakers: [...bySpeaker.values()].sort((a, b) => b.count - a.count).slice(0, 10)
        .map(s => ({ ...s, years: [...s.years].sort() })),
      decades: [...byDecade.entries()].sort((a, b) => a[0] - b[0]).map(([decade, count]) => ({ decade, count })),
    },
    meta: file._meta,
  }
})
