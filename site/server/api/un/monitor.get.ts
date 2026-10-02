import { readDataFile, dataFileMtime } from '~/server/utils/data-file'
import { getRecentStatements, getStatementsFeedMeta } from '~/server/utils/statements-feed'
import { getRecentNews } from '~/server/utils/news-feed'
import { getRegistry } from '~/server/utils/wcg'

/**
 * UN Monitor: a standing, data-first view of the UN system organised by organ
 * (Security Council, General Assembly, Secretariat, human rights & justice,
 * humanitarian), as opposed to the time-bound daily brief on /today.
 */
const P5 = ['CHN', 'FRA', 'RUS', 'GBR', 'USA']
const NY = 'America/New_York'
const nyKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: NY })
const decode = (s: string) => (s || '').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"')

export default defineEventHandler(() => {
  const registry = getRegistry()
  // prefer common names over the dataset's World Bank style ones ("Congo, Dem. Rep.")
  const EXTRA: Record<string, [string, string]> = { PSE: ['State of Palestine', 'PS'], VAT: ['Holy See', 'VA'], COD: ['DR Congo', 'CD'], IRN: ['Iran', 'IR'], VEN: ['Venezuela', 'VE'], EGY: ['Egypt', 'EG'], KOR: ['Republic of Korea', 'KR'], PRK: ['DPR Korea', 'KP'], SYR: ['Syria', 'SY'], YEM: ['Yemen', 'YE'], LAO: ['Lao PDR', 'LA'], RUS: ['Russian Federation', 'RU'], GMB: ['Gambia', 'GM'], BHS: ['Bahamas', 'BS'], KGZ: ['Kyrgyzstan', 'KG'], SVK: ['Slovakia', 'SK'], COG: ['Congo', 'CG'] }
  const country = (iso3: string) => {
    const m = registry.getCountryMembership(iso3)
    return { iso3, name: EXTRA[iso3]?.[0] || m?.name || iso3, iso2: m?.iso2 || EXTRA[iso3]?.[1] || '' }
  }
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.toISOString().slice(0, 7)

  // ---------------- Security Council ----------------
  const votes = readDataFile<any>('unsc-votes.json')
  const vetoes = readDataFile<any>('unsc-vetoes.json')
  const activity = readDataFile<any>('unsc-activity.json')
  const history = readDataFile<any>('unsc-history.json')
  const presidency: any[] = activity?.presidency || []
  const cur = presidency.find(p => p.month === month)
  const next = presidency.find(p => p.month > month)
  const elected = Object.entries(history?.terms || {})
    .flatMap(([iso3, terms]: [string, any]) => (terms as number[][]).filter(([s, e]) => s <= year && e >= year).map(([, e]) => ({ ...country(iso3), termEnd: e })))
    .sort((a, b) => a.name.localeCompare(b.name))
  const incoming = presidency
    .filter(p => !p.permanent && Number(p.term_end) === year + 2 && p.iso3 && !elected.some(e => e.iso3 === p.iso3))
    .map(p => ({ ...country(p.iso3), termStart: year + 1 }))
    .filter((v, i, a) => a.findIndex(x => x.iso3 === v.iso3) === i)

  const decisions = (votes?.resolutions || []).filter((r: any) => r.date?.startsWith(String(year)))
  const adopted = decisions.filter((r: any) => r.adopted)
  const meetings30 = (activity?.meetings || []).filter((m: any) => (now.getTime() - new Date(m.date + 'T12:00:00Z').getTime()) / 86400000 <= 31)
  // group agenda-item variants ("The situation in the Middle East, including the Palestinian question")
  const shortTopic = (t: string) => {
    if (/middle east|palestin/i.test(t)) return 'Middle East'
    if (/ukrain/i.test(t)) return 'Ukraine'
    if (/^maintenance of international peace and security/i.test(t)) return 'Peace and security (thematic)'
    if (/^briefing by/i.test(t)) return t.replace(/^Briefing by (the )?/i, 'Briefing: ')
    return t.replace(/^The situation (concerning|in) (the )?/i, '').replace(/^The question concerning /i, '').replace(/^Reports of the Secretary-General on /i, '')
  }
  const topicCounts = new Map<string, number>()
  for (const m of meetings30) {
    const t = shortTopic(m.topic)
    topicCounts.set(t, (topicCounts.get(t) || 0) + 1)
  }
  const council = {
    president: cur ? { ...country(cur.iso3), month: cur.month } : null,
    nextPresident: next ? { ...country(next.iso3), month: next.month } : null,
    permanent: P5.map(country),
    elected,
    incoming,
    stats: {
      meetingsLast30: meetings30.length,
      resolutionsThisYear: adopted.length,
      unanimousShare: adopted.length ? Math.round((adopted.filter((r: any) => r.tally?.yes === 15).length / adopted.length) * 100) : null,
      vetoedThisYear: decisions.filter((r: any) => r.vetoed).length,
      failedThisYear: decisions.filter((r: any) => !r.adopted && !r.vetoed).length,
    },
    focus: [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, meetings]) => ({ topic, meetings })),
    decisions: (votes?.resolutions || []).slice(0, 10),
    meetings: (activity?.meetings || []).slice(0, 12),
    vetoes: (vetoes?.vetoes || []).filter((v: any) => v.date >= `${year - 2}-01-01`).slice(0, 8)
      .map((v: any) => ({ ...v, by: (v.vetoed_by || []).map(country) })),
    updated: activity?._meta?.last_updated || null,
  }

  // ---------------- General Assembly ----------------
  const ga = readDataFile<any>('ga-resolutions.json')
  const gaAll: any[] = ga?.resolutions || []
  const sessions = [...new Set(gaAll.map(r => r.session))].sort((a, b) => b - a)
  // early in a session there are few resolutions, so show the previous one alongside
  const focusSession = sessions.find(s => gaAll.filter(r => r.session === s).length >= 20) ?? sessions[0]
  const inSession = gaAll.filter(r => r.session === focusSession)
  const recorded = inSession.filter(r => r.tally)
  const contested = [...recorded]
    .map(r => ({ ...r, yesShare: r.tally.yes / Math.max(1, r.tally.yes + r.tally.no + r.tally.abstain) }))
    .sort((a, b) => a.yesShare - b.yesShare)
    .slice(0, 8)
  const generalAssembly = {
    currentSession: sessions[0] ?? null,
    statsSession: focusSession ?? null,
    stats: {
      resolutions: inSession.length,
      withoutVote: inSession.filter(r => r.without_vote).length,
      recorded: recorded.length,
      avgYes: recorded.length ? Math.round(recorded.reduce((a, r) => a + r.tally.yes, 0) / recorded.length) : null,
    },
    latest: gaAll.slice(0, 10),
    contested,
    updated: ga?._meta?.last_updated || null,
  }

  // ---------------- Secretariat, rights & justice, humanitarian ----------------
  const statements = getRecentStatements(5000)
  const news = getRecentNews(2000)
  // Google-News-based sources end titles with " - Publisher"; drop it
  const VIA_GOOGLE = /^(gnews-|ohchr$|icj$|icc$|ocha-reliefweb$|dppa$|un-spokesperson$)/
  const clean = (x: any) => {
    const t = decode(x.title)
    return VIA_GOOGLE.test(x.source) ? t.replace(/\s+-\s+[^-]{2,60}$/, '') : t
  }
  const pick = (items: any[], sources: string[], n: number) => items
    .filter(x => sources.includes(x.source))
    .slice(0, n)
    .map(x => ({ title: clean(x), url: x.url, source: x.source, publishedAt: x.publishedAt, countries: (x.countries || []).slice(0, 3).map(country) }))
  const dedupe = (list: any[]) => {
    const seen = new Set<string>()
    return list.filter((x) => {
      const k = x.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const secretariat = dedupe([...pick(statements, ['un-spokesperson', 'un-press-releases', 'un-pga', 'dppa'], 10), ...pick(news, ['gnews-un-sg'], 4)]
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))).slice(0, 10)
  const rights = dedupe(pick(statements, ['ohchr', 'icj', 'icc', 'ungeneva-press', 'ungeneva-meetings'], 12)).slice(0, 10)
  const humanitarian = dedupe([...pick(statements, ['ocha-reliefweb'], 6), ...pick(news, ['reliefweb', 'un-news-humanitarian', 'gnews-unhcr', 'gnews-wfp'], 8)]
    .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))).slice(0, 8)

  // ---------------- Coming up (UN Web TV, next two days) ----------------
  const todayKey = nyKey(now.toISOString())
  const tomorrowKey = nyKey(new Date(now.getTime() + 86400000).toISOString())
  const seen = new Set<string>()
  const comingUp = statements
    .filter(s => s.source === 'un-webtv-schedule' && [todayKey, tomorrowKey].includes(nyKey(s.publishedAt)) && new Date(s.publishedAt).getTime() > now.getTime() - 3600000)
    .filter(s => { const k = s.publishedAt + s.title; if (seen.has(k)) return false; seen.add(k); return true })
    .filter(s => !/press|stakeout/i.test(s.type || ''))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(0, 12)
    .map(s => ({ title: decode(s.title), body: s.type, start: s.publishedAt, day: nyKey(s.publishedAt) === todayKey ? 'today' : 'tomorrow', url: s.url }))

  return {
    council,
    generalAssembly,
    secretariat,
    rights,
    humanitarian,
    comingUp,
    freshness: {
      council: dataFileMtime('unsc-activity.json'),
      generalAssembly: dataFileMtime('ga-resolutions.json'),
      statements: (getStatementsFeedMeta() as any)?.last_updated || null,
    },
  }
})
