import { isAIConfigured, callLLM } from '~/server/utils/llm-client'
import { getActiveProvider } from '~/server/utils/ai-config'
import { buildBilateralMeetingDocPrompt } from '~/server/utils/ai-prompts'
import { getCachedAnalysis, setCachedAnalysis } from '~/server/utils/ai-cache'
import { createBriefingDoc, generateDocxBuffer, type BriefingSection } from '~/server/utils/docx-builder'

export default defineEventHandler(async (event) => {
  if (!isAIConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'No AI provider configured' })
  }

  const query = getQuery(event)
  const a = (query.a as string || '').toUpperCase()
  const b = (query.b as string || '').toUpperCase()
  if (!a || !b) throw createError({ statusCode: 400, statusMessage: 'Missing a or b parameter' })

  const cookie = getRequestHeader(event, 'cookie') || ''
  const sorted = [a, b].sort()
  const cacheKey = `bilateral-meeting:${sorted.join('-')}`

  // Fetch bilateral prep and both country briefings
  const [bilateralPrep, briefingA, briefingB] = await Promise.all([
    $fetch<any>('/api/intelligence/bilateral-prep', { query: { a, b }, headers: { cookie } }),
    $fetch<any>('/api/intelligence/country-briefing', { query: { iso: a }, headers: { cookie } }),
    $fetch<any>('/api/intelligence/country-briefing', { query: { iso: b }, headers: { cookie } }),
  ])

  // Get existing AI analyses if available
  const existingBilateral = getCachedAnalysis(`bilateral:${sorted.join('-')}`)
  const existingA = getCachedAnalysis(`country:${a}`)
  const existingB = getCachedAnalysis(`country:${b}`)

  // Generate meeting-specific AI content
  let meetingContent: string
  const force = query.force === 'true'
  const cachedMeeting = !force ? getCachedAnalysis(cacheKey) : null

  if (cachedMeeting) {
    meetingContent = cachedMeeting.content
  } else {
    const messages = buildBilateralMeetingDocPrompt({
      countryA: bilateralPrep.countryA,
      countryB: bilateralPrep.countryB,
      bilateralPrep,
      briefingA,
      briefingB,
      existingAnalysis: existingBilateral?.content || '',
    })
    meetingContent = await callLLM(messages, { maxTokens: 4096 })
    const provider = getActiveProvider()!
    setCachedAnalysis(cacheKey, meetingContent, provider.name, provider.model)
  }

  // Build Word document
  const sections: BriefingSection[] = []

  // Meeting-specific AI content
  sections.push({ title: 'Meeting Background & Recommendations', content: meetingContent })

  // Country A profile
  let profileA = ''
  profileA += `**Region:** ${briefingA.country?.region || 'N/A'}\n`
  profileA += `**Capital:** ${briefingA.country?.capital || 'N/A'}\n`
  profileA += `**Population:** ${briefingA.country?.population?.toLocaleString() || 'N/A'}\n`
  profileA += `**GDP:** $${briefingA.country?.gdp ? (briefingA.country.gdp / 1e9).toFixed(1) + 'B' : 'N/A'}\n`
  if (briefingA.democracy?.latest) profileA += `**Regime:** ${briefingA.democracy.latest.regime}\n`
  if (briefingA.riskProfile?.military) profileA += `**Military Rank:** #${briefingA.riskProfile.military.rank}\n`
  if (existingA) profileA += `\n### AI Analysis\n${existingA.content}\n`
  sections.push({ title: `Country Profile: ${briefingA.country?.name}`, content: profileA })

  // Country B profile
  let profileB = ''
  profileB += `**Region:** ${briefingB.country?.region || 'N/A'}\n`
  profileB += `**Capital:** ${briefingB.country?.capital || 'N/A'}\n`
  profileB += `**Population:** ${briefingB.country?.population?.toLocaleString() || 'N/A'}\n`
  profileB += `**GDP:** $${briefingB.country?.gdp ? (briefingB.country.gdp / 1e9).toFixed(1) + 'B' : 'N/A'}\n`
  if (briefingB.democracy?.latest) profileB += `**Regime:** ${briefingB.democracy.latest.regime}\n`
  if (briefingB.riskProfile?.military) profileB += `**Military Rank:** #${briefingB.riskProfile.military.rank}\n`
  if (existingB) profileB += `\n### AI Analysis\n${existingB.content}\n`
  sections.push({ title: `Country Profile: ${briefingB.country?.name}`, content: profileB })

  // Voting alignment
  let voting = `**Overall Alignment:** ${bilateralPrep.votingAlignment?.overall ? (bilateralPrep.votingAlignment.overall * 100).toFixed(1) + '%' : 'N/A'}\n`
  voting += `**Resolutions Compared:** ${bilateralPrep.votingAlignment?.resolutionsCompared || 'N/A'}\n`
  if (bilateralPrep.divergencePoints?.length) {
    voting += `\n**Key Divergence Points:**\n`
    for (const d of bilateralPrep.divergencePoints.slice(0, 8)) {
      voting += `- ${d.theme}: ${(d.alignment * 100).toFixed(0)}% agreement\n`
    }
  }
  sections.push({ title: 'Voting Alignment', content: voting })

  // Trade & Aid
  let tradeAid = ''
  if (bilateralPrep.armsRelationship) {
    if (bilateralPrep.armsRelationship.aSuppliesB) tradeAid += `**${a} supplies ${b}:** ${bilateralPrep.armsRelationship.aSuppliesB.value} TIV\n`
    if (bilateralPrep.armsRelationship.bSuppliesA) tradeAid += `**${b} supplies ${a}:** ${bilateralPrep.armsRelationship.bSuppliesA.value} TIV\n`
  }
  if (bilateralPrep.aidRelationship) {
    if (bilateralPrep.aidRelationship.aGivesB) tradeAid += `**Aid ${a} → ${b}:** $${bilateralPrep.aidRelationship.aGivesB.value?.toLocaleString()}\n`
    if (bilateralPrep.aidRelationship.bGivesA) tradeAid += `**Aid ${b} → ${a}:** $${bilateralPrep.aidRelationship.bGivesA.value?.toLocaleString()}\n`
  }
  if (tradeAid) sections.push({ title: 'Trade & Aid', content: tradeAid })

  // Shared groups & alliances
  let shared = ''
  if (bilateralPrep.sharedGroups?.length) {
    shared += `**Shared Groups:** ${bilateralPrep.sharedGroups.map((g: any) => g.name).join(', ')}\n`
  }
  if (bilateralPrep.allianceRelationship?.sharedAlliances?.length) {
    shared += `**Shared Alliances:** ${bilateralPrep.allianceRelationship.sharedAlliances.join(', ')}\n`
  }
  if (shared) sections.push({ title: 'Shared Organizations & Alliances', content: shared })

  const doc = createBriefingDoc({
    title: `Bilateral Meeting Brief`,
    subtitle: `${bilateralPrep.countryA?.name} — ${bilateralPrep.countryB?.name}`,
    generatedAt: new Date().toISOString(),
    sections,
  })

  const buffer = await generateDocxBuffer(doc)
  const filename = `meeting-brief-${a.toLowerCase()}-${b.toLowerCase()}.docx`

  setResponseHeaders(event, {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(buffer.length),
  })

  return buffer
})
