import { isAIConfigured } from '~/server/utils/llm-client'
import { getCachedAnalysis } from '~/server/utils/ai-cache'
import { createBriefingDoc, generateDocxBuffer, type BriefingSection } from '~/server/utils/docx-builder'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const type = query.type as string || 'country'
  const cookie = getRequestHeader(event, 'cookie') || ''

  let title = 'Briefing Document'
  let subtitle = ''
  const sections: BriefingSection[] = []
  let filename = 'briefing.docx'

  if (type === 'country') {
    const iso = (query.iso as string || '').toUpperCase()
    if (!iso) throw createError({ statusCode: 400, statusMessage: 'Missing iso parameter' })

    const briefing = await $fetch<any>('/api/intelligence/country-briefing', { query: { iso }, headers: { cookie } })
    title = `Country Briefing: ${briefing.country?.name}`
    subtitle = `${briefing.country?.iso3} — ${briefing.country?.region || 'Unknown Region'}`
    filename = `briefing-${iso.toLowerCase()}.docx`

    // AI Analysis section
    const aiCache = getCachedAnalysis(`country:${iso}`)
    if (aiCache) {
      sections.push({ title: 'Strategic Overview (AI)', content: aiCache.content })
    }

    // Country profile
    let profile = ''
    profile += `**Capital:** ${briefing.country?.capital || 'N/A'}\n`
    profile += `**Population:** ${briefing.country?.population?.toLocaleString() || 'N/A'}\n`
    profile += `**GDP:** $${briefing.country?.gdp ? (briefing.country.gdp / 1e9).toFixed(1) + 'B' : 'N/A'}\n`
    profile += `**Income Group:** ${briefing.country?.income_group || 'N/A'}\n`
    sections.push({ title: 'Country Profile', content: profile })

    // Voting alignment
    if (briefing.votingAlignment) {
      let voting = ''
      if (briefing.votingAlignment.p5?.length) {
        voting += `**P5 Alignment:**\n`
        for (const p of briefing.votingAlignment.p5) {
          voting += `- ${p.name || p.iso3}: ${(p.agreement * 100).toFixed(0)}%\n`
        }
      }
      if (briefing.votingAlignment.mostAligned?.length) {
        voting += `\n**Most Aligned:**\n`
        for (const a of briefing.votingAlignment.mostAligned) {
          voting += `- ${a.name || a.iso3}: ${(a.agreement * 100).toFixed(0)}%\n`
        }
      }
      sections.push({ title: 'Voting Alignment', content: voting })
    }

    // Risk profile
    let risk = ''
    if (briefing.riskProfile?.conflict) {
      risk += `**Conflict:** ${briefing.riskProfile.conflict.conflict_intensity} intensity, ${briefing.riskProfile.conflict.total_events} events, ${briefing.riskProfile.conflict.total_fatalities} fatalities\n`
    }
    if (briefing.riskProfile?.sanctions?.length) {
      risk += `**Sanctions:** ${briefing.riskProfile.sanctions.length} active\n`
    }
    if (briefing.riskProfile?.military) {
      risk += `**Military:** Rank #${briefing.riskProfile.military.rank}, Power Index ${briefing.riskProfile.military.power_index}\n`
    }
    if (risk) sections.push({ title: 'Risk Profile', content: risk })

    // Groups
    if (briefing.groups?.length) {
      sections.push({ title: 'Group Memberships', content: briefing.groups.map((g: any) => `- ${g.name} (${g.acronym})`).join('\n') })
    }

  } else if (type === 'bilateral') {
    const a = (query.a as string || '').toUpperCase()
    const b = (query.b as string || '').toUpperCase()
    if (!a || !b) throw createError({ statusCode: 400, statusMessage: 'Missing a or b parameter' })

    const bilateral = await $fetch<any>('/api/intelligence/bilateral-prep', { query: { a, b }, headers: { cookie } })
    title = `Bilateral Briefing: ${bilateral.countryA?.name} — ${bilateral.countryB?.name}`
    subtitle = `${a} ↔ ${b}`
    filename = `bilateral-${a.toLowerCase()}-${b.toLowerCase()}.docx`

    const aiCache = getCachedAnalysis(`bilateral:${[a, b].sort().join('-')}`)
    if (aiCache) {
      sections.push({ title: 'Relationship Overview (AI)', content: aiCache.content })
    }

    let overview = `**Voting Alignment:** ${bilateral.votingAlignment?.overall ? (bilateral.votingAlignment.overall * 100).toFixed(1) + '%' : 'N/A'}\n`
    overview += `**Shared Groups:** ${bilateral.sharedGroups?.map((g: any) => g.name).join(', ') || 'None'}\n`
    sections.push({ title: 'Relationship Overview', content: overview })

  } else if (type === 'group') {
    const gid = (query.gid as string || '').toLowerCase()
    if (!gid) throw createError({ statusCode: 400, statusMessage: 'Missing gid parameter' })

    const trends = await $fetch<any>('/api/intelligence/group-trends', { query: { gid }, headers: { cookie } })
    title = `Group Briefing: ${trends.group?.name}`
    subtitle = `${trends.group?.acronym} — ${trends.group?.memberCount} members`
    filename = `group-${gid}.docx`

    const aiCache = getCachedAnalysis(`group:${gid}`)
    if (aiCache) {
      sections.push({ title: 'Group Overview (AI)', content: aiCache.content })
    }

    let overview = `**Members:** ${trends.group?.memberCount}\n`
    if (trends.cohesion?.overall !== null && trends.cohesion?.overall !== undefined) {
      overview += `**Voting Cohesion:** ${(trends.cohesion.overall * 100).toFixed(1)}%\n`
    }
    sections.push({ title: 'Group Overview', content: overview })
  }

  const doc = createBriefingDoc({
    title,
    subtitle,
    generatedAt: new Date().toISOString(),
    sections,
  })

  const buffer = await generateDocxBuffer(doc)

  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(buffer.length),
  })

  return buffer
})
