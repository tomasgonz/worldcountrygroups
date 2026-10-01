import type { LLMMessage } from './llm-client'
import { getPromptConfig, type PulseStyleConfig } from './ai-config'

export const DEFAULT_SYSTEM_BASE = `You are a senior diplomatic intelligence analyst. Provide concise, structured analysis in markdown format. Use bullet points and short paragraphs. Be specific with data points. Avoid generic statements. Focus on implications and actionable insights.`

export const DEFAULT_COUNTRY_INSTRUCTIONS = `Analyze this country briefing data. Provide:
1. **Executive Assessment** (2-3 sentences on overall posture)
2. **Key Strengths & Vulnerabilities** (bullet points)
3. **Strategic Positioning** (alliances, voting patterns, regional role)
4. **Risk Factors** (conflict, sanctions, governance)
5. **Diplomatic Implications** (what to watch, engagement recommendations)`

export const DEFAULT_BILATERAL_INSTRUCTIONS = `Analyze this bilateral relationship. Provide:
1. **Relationship Summary** (2-3 sentences)
2. **Areas of Alignment** (shared positions, alliances, cooperation)
3. **Points of Tension** (disagreements, competing interests)
4. **Power Dynamics** (economic, military, diplomatic leverage)
5. **Engagement Strategy** (recommendations for diplomats meeting counterparts)`

export const DEFAULT_GROUP_INSTRUCTIONS = `Analyze this group. Provide:
1. **Group Cohesion Assessment** (2-3 sentences)
2. **Internal Dynamics** (fault lines, blocs within the group)
3. **Collective Strengths** (what unites them, shared capabilities)
4. **Strategic Trends** (emerging issues, shifting alignments)
5. **Outlook** (predictions and what to watch)`

export const DEFAULT_CHAT_INSTRUCTIONS = `You are in an interactive chat. Answer questions about the diplomatic context provided. Be conversational but precise. Reference specific data points when possible.`

export const DEFAULT_PULSE_INSTRUCTIONS = `Produce a "This Week in Diplomacy" briefing in TWO parts separated by exactly "---" on its own line.

CRITICAL RULES:
- Part 1 must be based EXCLUSIVELY on the "Current News Headlines" and "Conflict Hotspots" sections. These are what actually happened this week.
- The "Reference" section contains standing background data (group memberships, GA positions from last September, voting patterns). These are NOT current events. NEVER give them their own paragraph or present them as news.
- You MAY weave in reference data to enrich a current story — e.g. "The move puts Washington at odds with fellow G7 members" or "In September, President X had called for cooperation on this issue at the General Assembly." Always make the temporal framing explicit.
- If a country in the news has GA speech data, you can use it to note continuity or contradiction with their current actions — but only as a subordinate clause within a paragraph about actual news.

FORMATTING: Write entirely in flowing prose paragraphs. NEVER use bullet points, numbered lists, or markdown list syntax anywhere in the output. Use section headings (##) to separate topics, then write paragraphs under each heading.

PART 1 — NARRATIVE HEADLINES (above the ---):
Write 3-4 short narrative paragraphs. Each paragraph covers one major current story from the news headlines. Open with a vivid journalistic lead about what happened, add 1-2 sentences of context and stakes, and optionally weave in a reference fact (group membership, past GA stance) to deepen the story.

Style: compelling foreign-affairs prose. Be specific with names, places, and facts from the news.

PART 2 — ANALYSIS (below the ---):
Deeper analytical context in prose paragraphs. Here you may freely draw on all data including reference material. Cover these themes under ## headings:

## Conflict Watch
Discuss active hotspots with casualty and intensity data in paragraph form.

## Diplomatic Signals
Analyze how current events relate to known positions, group dynamics, and voting patterns.

## Emerging Trends
Identify patterns worth monitoring and explain their significance.

## Outlook
Discuss what to watch in the coming week and why it matters.

Keep Part 1 concise (3-4 paragraphs). Part 2 can be thorough but always in prose, never bullets.`

export const DEFAULT_NEWS_BRIEFING_INSTRUCTIONS = `You are writing a current-situation intelligence briefing based exclusively on the news articles provided.

RULES:
- Write entirely in flowing prose paragraphs. NEVER use bullet points, numbered lists, dashes, or markdown list syntax.
- Do not use headings or section markers. Write as continuous narrative paragraphs.
- Be specific — reference events, actors, and developments from the articles.
- Synthesize related stories into coherent themes rather than summarizing each article individually.
- Write in the present tense where appropriate. Adopt an authoritative, analytical intelligence briefing tone.
- Keep it concise: 2-4 paragraphs maximum.
- If there are few articles, write a shorter briefing. If there is nothing substantive, write a single sentence noting the situation is quiet.`

export const DEFAULT_SMART_SEARCH_INSTRUCTIONS = `Answer the user's question using ONLY the data provided. Be direct and specific. If the data doesn't contain enough information to fully answer, say so clearly. Format your answer in markdown with bullet points where appropriate.`

export const DEFAULT_SPEECH_SUMMARY_INSTRUCTIONS = `Provide a detailed analysis of this UN General Assembly speech:
1. **Executive Summary** (3-4 sentences)
2. **Key Themes & Positions** (detailed bullet points on each major topic)
3. **Rhetorical Strategy** (tone, framing, audience targeting)
4. **Notable Quotes** (with context on why each is significant)
5. **Diplomatic Signals** (what this speech signals to allies, rivals, and the international community)
6. **Policy Implications** (concrete policy positions and their significance)
7. **Historical Context** (how positions compare to previous sessions if relevant)`

export const DEFAULT_ANOMALY_DETECTION_INSTRUCTIONS = `Identify the most notable anomalies, patterns, and insights from this global data. Structure:
1. **Top 3 Alerts** (most significant findings, each with a brief explanation)
2. **Emerging Patterns** (trends that aren't obvious from individual data points)
3. **Surprising Findings** (data that contradicts conventional wisdom)
4. **Watch List** (situations that could escalate or change significantly)

Be specific and cite actual data points. Focus on insights that would be valuable to a diplomatic analyst.`

export const DEFAULT_COMPARE_ANALYSIS_INSTRUCTIONS = `Provide a comparative narrative analysis:
1. **Overall Comparison** (2-3 sentences on how these entities relate to each other)
2. **Key Similarities** (shared characteristics, positions, or patterns)
3. **Key Differences** (where they diverge most significantly)
4. **Power & Influence** (relative positioning)
5. **Strategic Implications** (what the comparison reveals about broader dynamics)`

export const DEFAULT_GROUP_SUGGESTIONS_INSTRUCTIONS = `Suggest potential new members for this group. For each suggestion:
1. **Country name** and rationale (why they fit)
2. **Alignment score** (high/medium/low) based on group criteria
3. **Potential obstacles** to membership

Also provide:
- **Overall assessment** of the group's membership gaps
- **Regional balance** considerations
- **Strategic value** of expansion

Limit to 5-8 strongest candidates.`

export const DEFAULT_RISK_SCORE_INSTRUCTIONS = `Produce a structured risk assessment. You MUST return valid JSON (no markdown code blocks, just raw JSON) with this exact structure:
{
  "overall_score": <number 1-10>,
  "categories": {
    "security": <number 1-10>,
    "governance": <number 1-10>,
    "diplomatic_isolation": <number 1-10>,
    "economic_vulnerability": <number 1-10>,
    "regional_instability": <number 1-10>
  },
  "key_risks": ["risk1", "risk2", "risk3"],
  "mitigating_factors": ["factor1", "factor2"],
  "outlook": "stable|improving|deteriorating|volatile"
}

Where 1 = lowest risk, 10 = highest risk. Be objective and base scores on the data provided.`

export const DEFAULT_MEETING_DOC_INSTRUCTIONS = `Produce a comprehensive bilateral meeting background document:
1. **Executive Summary** (3-4 sentences on the relationship)
2. **Talking Points** (5-7 key points for discussion, each with background context)
3. **Suggested Agenda** (structured meeting agenda with time allocations)
4. **Areas of Cooperation** (existing and potential)
5. **Points of Divergence** (issues requiring careful handling)
6. **Risk Factors** (things that could derail the meeting)
7. **Recommended Outcomes** (realistic goals for the meeting)
8. **Background Notes** (historical context, recent developments, sensitivities)

Write in a professional diplomatic briefing style. Be specific and actionable.`

export const DEFAULT_CABLE_INSTRUCTIONS = `Generate a diplomatic cable in SITREP (Situation Report) format. Use authoritative, concise diplomatic language. No hedging or qualifiers. Structure as follows:

CLASSIFICATION: UNCLASSIFIED // FOR OFFICIAL USE ONLY
DTG: [Current date-time group in format DDHHMMZ MMM YYYY]
FROM: ANALYTICAL DIVISION
TO: SENIOR LEADERSHIP
SUBJECT: [Concise subject line]
REF: WCG Intelligence Database

1. (U) SITUATION: Current state of affairs. Lead with the most critical developments. Use numbered sub-paragraphs for distinct issues.

2. (U) BACKGROUND: Essential historical and contextual information. Previous significant events, agreements, or shifts.

3. (U) ASSESSMENT: Analytical judgments on current trajectory. Include confidence levels (HIGH/MODERATE/LOW). Address strategic implications.

4. (U) RISKS: Identified risk factors ranked by likelihood and impact. Include potential triggers and escalation scenarios.

5. (U) RECOMMENDED ACTIONS: Specific, actionable recommendations for policy consideration. Prioritized by urgency.

6. (U) OUTLOOK: Forward-looking assessment. 30/60/90-day projections where applicable.

BT
#####

Write in the style of real diplomatic cables: direct, factual, and authoritative. Use specific data points from the intelligence provided. Each section should be substantive (3-5 paragraphs minimum).`

function serializeData(obj: any, depth = 0): string {
  if (obj === null || obj === undefined) return 'N/A'
  if (typeof obj !== 'object') return String(obj)
  if (Array.isArray(obj)) {
    if (obj.length === 0) return 'None'
    if (depth > 2) return `[${obj.length} items]`
    return obj.slice(0, 15).map(item => {
      if (typeof item !== 'object') return `- ${item}`
      const parts = Object.entries(item).slice(0, 6).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      return `- ${parts.join(', ')}`
    }).join('\n')
  }
  if (depth > 3) return '[nested object]'
  return Object.entries(obj).map(([k, v]) => {
    if (v === null || v === undefined) return ''
    const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    if (typeof v === 'object') return `### ${label}\n${serializeData(v, depth + 1)}`
    return `**${label}:** ${v}`
  }).filter(Boolean).join('\n')
}

export function buildCountryBriefingPrompt(data: any): LLMMessage[] {
  const country = data.country
  let context = `# Intelligence Briefing: ${country.name} (${country.iso3})\n`
  context += `Region: ${country.region || 'Unknown'}, Capital: ${country.capital || 'Unknown'}\n`
  context += `Population: ${country.population?.toLocaleString() || 'N/A'}, GDP: $${country.gdp ? (country.gdp / 1e9).toFixed(1) + 'B' : 'N/A'}\n\n`

  if (data.latestSpeech) {
    context += `## Latest UN Speech (Session ${data.latestSpeech.session}, ${data.latestSpeech.year})\n`
    context += `Speaker: ${data.latestSpeech.speaker} (${data.latestSpeech.speaker_title})\n`
    context += `Sentiment: ${data.latestSpeech.sentiment}\n`
    context += `Summary: ${data.latestSpeech.summary}\n\n`
  }

  if (data.votingAlignment) {
    context += `## UN Voting Alignment\n`
    context += `P5 alignment:\n${serializeData(data.votingAlignment.p5)}\n`
    context += `Most aligned:\n${serializeData(data.votingAlignment.mostAligned)}\n\n`
  }

  if (data.riskProfile) {
    context += `## Risk Profile\n`
    if (data.riskProfile.conflict) context += `Conflict: Intensity ${data.riskProfile.conflict.conflict_intensity}, ${data.riskProfile.conflict.total_events} events, ${data.riskProfile.conflict.total_fatalities} fatalities, trend: ${data.riskProfile.conflict.trend}\n`
    if (data.riskProfile.military) context += `Military: Rank #${data.riskProfile.military.rank}, Power Index ${data.riskProfile.military.power_index}\n`
    if (data.riskProfile.sanctions) context += `Sanctions: ${data.riskProfile.sanctions.length} active\n\n`
  }

  if (data.democracy) {
    context += `## Democracy (V-Dem)\n`
    context += `Regime: ${data.democracy.latest?.regime || 'Unknown'}\n`
    context += `Polyarchy: ${data.democracy.latest?.v2x_polyarchy?.toFixed(3) || 'N/A'}, Liberal Democracy: ${data.democracy.latest?.v2x_libdem?.toFixed(3) || 'N/A'}\n\n`
  }

  if (data.armsTrade) {
    context += `## Arms Trade (SIPRI)\n`
    context += `Exports: ${data.armsTrade.total_exports} TIV (rank #${data.armsTrade.export_rank}), Imports: ${data.armsTrade.total_imports} TIV (rank #${data.armsTrade.import_rank})\n\n`
  }

  if (data.aid) {
    context += `## Aid (ODA)\n`
    context += `Role: ${data.aid.is_donor ? 'Donor' : 'Recipient'}, Given: $${data.aid.total_given?.toLocaleString() || 0}, Received: $${data.aid.total_received?.toLocaleString() || 0}\n\n`
  }

  if (data.passport) {
    context += `## Passport Mobility\n`
    context += `Rank: #${data.passport.mobility_rank}, Visa-free: ${data.passport.visa_free}, On arrival: ${data.passport.visa_on_arrival}\n\n`
  }

  if (data.alliances?.has_data) {
    context += `## Alliances\n`
    context += `Active: ${data.alliances.profile?.active_alliances}, Defense pacts: ${data.alliances.profile?.defense_pacts}\n\n`
  }

  if (data.recentNews?.length) {
    context += `## Recent News\n`
    for (const n of data.recentNews.slice(0, 10)) {
      const topics = n.topics?.length ? ` (${n.topics.join(', ')})` : ''
      context += `- [${n.source}] ${n.title}${topics}\n`
    }
    context += '\n'
  }

  context += `## Group Memberships\n${data.groups?.map((g: any) => g.name).join(', ') || 'None'}\n`

  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE
  const instructions = prompts.countryInstructions || DEFAULT_COUNTRY_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildBilateralPrepPrompt(data: any): LLMMessage[] {
  let context = `# Bilateral Relationship: ${data.countryA.name} (${data.countryA.iso3}) ↔ ${data.countryB.name} (${data.countryB.iso3})\n\n`

  context += `## UN Voting Alignment: ${(data.votingAlignment.overall * 100).toFixed(1)}% (${data.votingAlignment.resolutionsCompared} resolutions)\n`
  if (data.divergencePoints?.length) {
    context += `Key disagreements: ${data.divergencePoints.map((d: any) => `${d.theme} (${(d.alignment * 100).toFixed(0)}%)`).join(', ')}\n\n`
  }

  context += `## Shared Groups: ${data.sharedGroups?.map((g: any) => g.name).join(', ') || 'None'}\n\n`

  if (data.visaRelationship) {
    context += `## Visa: ${data.countryA.iso3}→${data.countryB.iso3}: ${data.visaRelationship.aToB || 'Unknown'}, ${data.countryB.iso3}→${data.countryA.iso3}: ${data.visaRelationship.bToA || 'Unknown'}\n\n`
  }

  if (data.armsRelationship) {
    context += `## Arms Trade\n`
    if (data.armsRelationship.aSuppliesB) context += `${data.countryA.iso3} supplies ${data.countryB.iso3}: ${data.armsRelationship.aSuppliesB.value} TIV\n`
    if (data.armsRelationship.bSuppliesA) context += `${data.countryB.iso3} supplies ${data.countryA.iso3}: ${data.armsRelationship.bSuppliesA.value} TIV\n`
    context += '\n'
  }

  if (data.aidRelationship) {
    context += `## Aid Relationship\n`
    if (data.aidRelationship.aGivesB) context += `${data.countryA.iso3} gives to ${data.countryB.iso3}: $${data.aidRelationship.aGivesB.value?.toLocaleString()}\n`
    if (data.aidRelationship.bGivesA) context += `${data.countryB.iso3} gives to ${data.countryA.iso3}: $${data.aidRelationship.bGivesA.value?.toLocaleString()}\n`
    context += '\n'
  }

  if (data.allianceRelationship?.sharedAlliances?.length) {
    context += `## Shared Alliances: ${data.allianceRelationship.sharedAlliances.join(', ')}\n\n`
  }

  if (data.regimeComparison) {
    context += `## Regime Comparison\n`
    if (data.regimeComparison.a) context += `${data.countryA.iso3}: ${data.regimeComparison.a.latest?.regime || 'Unknown'} (polyarchy: ${data.regimeComparison.a.latest?.v2x_polyarchy?.toFixed(2)})\n`
    if (data.regimeComparison.b) context += `${data.countryB.iso3}: ${data.regimeComparison.b.latest?.regime || 'Unknown'} (polyarchy: ${data.regimeComparison.b.latest?.v2x_polyarchy?.toFixed(2)})\n\n`
  }

  if (data.gdeltBilateral) {
    context += `## GDELT: ${data.gdeltBilateral.events} events, cooperation ratio: ${(data.gdeltBilateral.cooperation_ratio * 100).toFixed(0)}%, avg tone: ${data.gdeltBilateral.avg_tone?.toFixed(2)}\n\n`
  }

  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE
  const instructions = prompts.bilateralInstructions || DEFAULT_BILATERAL_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildGroupTrendsPrompt(data: any): LLMMessage[] {
  let context = `# Group Analysis: ${data.group.name} (${data.group.acronym})\n`
  context += `Members: ${data.group.memberCount}\n\n`

  if (data.cohesion) {
    context += `## Voting Cohesion: ${data.cohesion.overall !== null ? (data.cohesion.overall * 100).toFixed(1) + '%' : 'N/A'}\n\n`
  }

  if (data.democracy) {
    context += `## Democracy Distribution\n`
    if (data.democracy.regime_distribution) {
      context += Object.entries(data.democracy.regime_distribution).map(([k, v]) => `- ${k}: ${v}`).join('\n') + '\n'
    }
    if (data.democracy.most_democratic?.length) context += `Most democratic: ${data.democracy.most_democratic.slice(0, 3).map((m: any) => m.iso3).join(', ')}\n`
    if (data.democracy.least_democratic?.length) context += `Least democratic: ${data.democracy.least_democratic.slice(0, 3).map((m: any) => m.iso3).join(', ')}\n\n`
  }

  if (data.armsTrade?.has_data) {
    context += `## Arms Trade: Total exports ${data.armsTrade.total_exports} TIV, imports ${data.armsTrade.total_imports} TIV\n`
    if (data.armsTrade.intra_group_transfers?.length) context += `Intra-group transfers: ${data.armsTrade.intra_group_transfers.length}\n\n`
  }

  if (data.aid?.has_data) {
    context += `## Aid: ${data.aid.donor_count} donors, ${data.aid.recipient_count} recipients\n\n`
  }

  if (data.visaFreedom?.has_data) {
    context += `## Visa Freedom: Intra-group ${(data.visaFreedom.intra_group_visa_freedom_pct * 100).toFixed(0)}% visa-free\n\n`
  }

  if (data.alliances?.has_data) {
    context += `## Alliance Density: ${(data.alliances.intra_group.alliance_density * 100).toFixed(0)}%\n\n`
  }

  if (data.emergingTopics) {
    const newTopics = data.emergingTopics.newTopics?.slice(0, 5) || []
    if (newTopics.length) context += `## Emerging Topics: ${newTopics.map((t: any) => t.topic || t).join(', ')}\n\n`
  }

  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE
  const instructions = prompts.groupInstructions || DEFAULT_GROUP_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildChatContextPrompt(contextType: string, data: any, history: LLMMessage[]): LLMMessage[] {
  const prompts = getPromptConfig()
  const chatInstructions = prompts.chatInstructions || DEFAULT_CHAT_INSTRUCTIONS
  let systemPrompt = (prompts.systemBase || DEFAULT_SYSTEM_BASE) + '\n\n' + chatInstructions + '\n\n'

  if (contextType === 'country') {
    systemPrompt += `Context: Country briefing for ${data.country?.name} (${data.country?.iso3}).\n`
    systemPrompt += `Key facts: Region ${data.country?.region}, Population ${data.country?.population?.toLocaleString()}, GDP $${data.country?.gdp ? (data.country.gdp / 1e9).toFixed(1) + 'B' : 'N/A'}\n`
    if (data.democracy?.latest) systemPrompt += `Regime: ${data.democracy.latest.regime}, Polyarchy: ${data.democracy.latest.v2x_polyarchy?.toFixed(2)}\n`
    if (data.riskProfile?.conflict) systemPrompt += `Conflict: ${data.riskProfile.conflict.conflict_intensity} intensity\n`
    if (data.votingAlignment) systemPrompt += `Voting: ${data.votingAlignment.sessionsUsed} sessions analyzed\n`
  } else if (contextType === 'bilateral') {
    systemPrompt += `Context: Bilateral relationship between ${data.countryA?.name} and ${data.countryB?.name}.\n`
    systemPrompt += `Voting alignment: ${data.votingAlignment?.overall ? (data.votingAlignment.overall * 100).toFixed(1) + '%' : 'N/A'}\n`
    systemPrompt += `Shared groups: ${data.sharedGroups?.length || 0}\n`
  } else if (contextType === 'group') {
    systemPrompt += `Context: Group analysis for ${data.group?.name} (${data.group?.acronym}), ${data.group?.memberCount} members.\n`
    systemPrompt += `Cohesion: ${data.cohesion?.overall ? (data.cohesion.overall * 100).toFixed(1) + '%' : 'N/A'}\n`
  }

  return [
    { role: 'system', content: systemPrompt },
    ...history,
  ]
}

export function buildDiplomaticPulsePrompt(data: any, style?: Partial<PulseStyleConfig>): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# Weekly Diplomatic Pulse\n\n`

  if (data.hotspots?.length) {
    context += `## Conflict Hotspots\n`
    for (const h of data.hotspots.slice(0, 10)) {
      context += `- ${h.iso3}: ${h.total_events} events, ${h.total_fatalities} fatalities, intensity: ${h.conflict_intensity}, trend: ${h.trend}\n`
    }
    context += '\n'
  }

  // Current events — news articles are the PRIMARY and ONLY source for what happened this week
  if (data.recentNews?.length) {
    context += `## Current News Headlines (THIS WEEK)\n`
    for (const n of data.recentNews.slice(0, 20)) {
      const countries = n.countries?.length ? ` [${n.countries.join(', ')}]` : ''
      const topics = n.topics?.length ? ` (${n.topics.join(', ')})` : ''
      context += `- [${n.source}] ${n.title}${countries}${topics}\n`
    }
    context += '\n'
  }

  if (data.gdeltHighlights) {
    context += `## Current Media Activity (GDELT)\n${serializeData(data.gdeltHighlights)}\n\n`
  }

  // Reference data for countries mentioned in the news — NOT current events
  if (data.countryContext && Object.keys(data.countryContext).length) {
    context += `## Reference: Countries in the News\n`
    context += `> Use this data ONLY to add depth and context to current stories. Group memberships and GA positions are standing facts, not this week's news.\n\n`
    for (const [iso3, info] of Object.entries(data.countryContext) as [string, any][]) {
      context += `**${info.name} (${iso3}):** Groups: ${info.groups?.join(', ') || 'none'}`
      if (info.gaSession) {
        context += ` | GA ${info.gaSession.session} (${info.gaSession.year}): ${info.gaSession.speaker}${info.gaSession.title ? ` (${info.gaSession.title})` : ''}`
        if (info.gaSession.positions?.length) {
          context += ` — positions: ${info.gaSession.positions.join('; ')}`
        }
      }
      context += '\n'
    }
    context += '\n'
  }

  if (data.votingHighlights) {
    context += `## Reference: UN Voting Patterns\n${serializeData(data.votingHighlights)}\n\n`
  }

  // Build style-aware instructions
  let stylePrefix = ''
  const tone = style?.tone || 'analytical'

  if (tone === 'formal-diplomatic') {
    stylePrefix += 'Write in a diplomatic cable style. Reference speakers by their official title and country. Use measured, protocol-conscious language.\n\n'
  } else if (tone === 'journalistic') {
    stylePrefix += 'Write with vivid leads and narrative flair. Use direct quotes from speakers where available. Employ journalistic storytelling techniques.\n\n'
  } else {
    stylePrefix += 'Write in a structured, evidence-based, balanced analytical style. Support claims with data points.\n\n'
  }

  const pulseInstructions = prompts.pulseInstructions || DEFAULT_PULSE_INSTRUCTIONS
  const instructions = `${stylePrefix}${pulseInstructions}`

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildNewsBriefingPrompt(data: { country: { name: string; iso3: string; region?: string }; articles: any[] }): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# Current Situation: ${data.country.name} (${data.country.iso3})\n`
  if (data.country.region) context += `Region: ${data.country.region}\n`
  context += '\n## Recent News Articles\n'
  for (const a of data.articles) {
    const topics = a.topics?.length ? ` (${a.topics.join(', ')})` : ''
    context += `- [${a.source}] ${a.title}${topics}\n`
    if (a.description) context += `  ${a.description}\n`
  }

  const instructions = prompts.newsBriefingInstructions || DEFAULT_NEWS_BRIEFING_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildSmartSearchPrompt(query: string, context: any): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let dataContext = `# Available Data Context\n\n`

  if (context.countries?.length) {
    dataContext += `## Relevant Countries\n`
    for (const c of context.countries.slice(0, 5)) {
      dataContext += `- ${c.name} (${c.iso3}): Region ${c.region || 'N/A'}, Population ${c.population?.toLocaleString() || 'N/A'}, GDP $${c.gdp ? (c.gdp / 1e9).toFixed(1) + 'B' : 'N/A'}\n`
      if (c.groups?.length) dataContext += `  Groups: ${c.groups.map((g: any) => g.acronym || g.name).join(', ')}\n`
    }
    dataContext += '\n'
  }

  if (context.groups?.length) {
    dataContext += `## Relevant Groups\n`
    for (const g of context.groups.slice(0, 5)) {
      dataContext += `- ${g.acronym} (${g.name}): ${g.country_count} members, domains: ${g.domains?.join(', ') || 'N/A'}\n`
    }
    dataContext += '\n'
  }

  if (context.additionalData) {
    dataContext += `## Additional Data\n${serializeData(context.additionalData)}\n\n`
  }

  const instructions = prompts.smartSearchInstructions || DEFAULT_SMART_SEARCH_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: `Question: ${query}\n\n${dataContext}` },
  ]
}

export function buildSpeechSummaryPrompt(data: { text: string; meta: any; analysis: any }): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# UN General Assembly Speech Analysis\n\n`
  context += `**Country:** ${data.meta.iso3}\n`
  context += `**Session:** ${data.meta.session} (${data.meta.year})\n`
  context += `**Speaker:** ${data.meta.speaker} — ${data.meta.speaker_title}\n\n`

  if (data.analysis) {
    context += `## Pre-existing Analysis\n`
    context += `Sentiment: ${data.analysis.sentiment?.overall || 'N/A'}\n`
    context += `Summary: ${data.analysis.summary || 'N/A'}\n`
    if (data.analysis.key_quotes?.length) {
      context += `Key Quotes: ${data.analysis.key_quotes.join('; ')}\n`
    }
    context += '\n'
  }

  context += `## Full Speech Text\n${data.text.slice(0, 12000)}\n`

  const instructions = prompts.speechSummaryInstructions || DEFAULT_SPEECH_SUMMARY_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildAnomalyDetectionPrompt(data: any): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# Global Data Scan for Anomalies & Insights\n\n`

  if (data.conflictHotspots?.length) {
    context += `## Active Conflict Hotspots\n`
    for (const h of data.conflictHotspots.slice(0, 10)) {
      context += `- ${h.iso3}: intensity ${h.conflict_intensity}, ${h.total_fatalities} fatalities, trend: ${h.trend}\n`
    }
    context += '\n'
  }

  if (data.democracyExtremes) {
    context += `## Democracy Extremes\n${serializeData(data.democracyExtremes)}\n\n`
  }

  if (data.alliancePatterns) {
    context += `## Alliance Patterns\n${serializeData(data.alliancePatterns)}\n\n`
  }

  if (data.armsTradeOutliers) {
    context += `## Arms Trade Outliers\n${serializeData(data.armsTradeOutliers)}\n\n`
  }

  if (data.votingShifts) {
    context += `## Voting Pattern Shifts\n${serializeData(data.votingShifts)}\n\n`
  }

  const instructions = prompts.anomalyDetectionInstructions || DEFAULT_ANOMALY_DETECTION_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildCompareAnalysisPrompt(data: { mode: string; entities: any[]; comparison: any }): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# Comparative Analysis: ${data.mode === 'countries' ? 'Countries' : 'Groups'}\n\n`
  context += `Entities: ${data.entities.map((e: any) => e.label || e.name || e.acronym).join(', ')}\n\n`
  context += `## Comparison Data\n${serializeData(data.comparison)}\n`

  const instructions = prompts.compareAnalysisInstructions || DEFAULT_COMPARE_ANALYSIS_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildGroupSuggestionsPrompt(data: { group: any; members: any[]; candidates: any[] }): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# Group Membership Analysis: ${data.group.name} (${data.group.acronym})\n\n`
  context += `Description: ${data.group.description}\n`
  context += `Domains: ${data.group.domains?.join(', ') || 'N/A'}\n`
  context += `Current Members (${data.members.length}): ${data.members.map((m: any) => m.name || m.iso3).join(', ')}\n\n`

  if (data.candidates?.length) {
    context += `## Non-Member Candidates\n`
    for (const c of data.candidates) {
      context += `- ${c.name} (${c.iso3}): Region ${c.region || 'N/A'}, ${c.regime || 'N/A'}, groups: ${c.groupOverlaps?.join(', ') || 'none shared'}\n`
    }
  }

  const instructions = prompts.groupSuggestionsInstructions || DEFAULT_GROUP_SUGGESTIONS_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildRiskScorePrompt(data: any): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# Risk Assessment: ${data.country?.name} (${data.country?.iso3})\n\n`
  context += serializeData(data) + '\n'

  const instructions = prompts.riskScoreInstructions || DEFAULT_RISK_SCORE_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildBilateralMeetingDocPrompt(data: any): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# Bilateral Meeting Background: ${data.countryA?.name} ↔ ${data.countryB?.name}\n\n`

  if (data.bilateralPrep) {
    context += `## Bilateral Relationship Data\n${serializeData(data.bilateralPrep)}\n\n`
  }

  if (data.briefingA) {
    context += `## ${data.countryA?.name} Profile\n${serializeData(data.briefingA)}\n\n`
  }

  if (data.briefingB) {
    context += `## ${data.countryB?.name} Profile\n${serializeData(data.briefingB)}\n\n`
  }

  if (data.existingAnalysis) {
    context += `## Existing AI Analysis\n${data.existingAnalysis}\n\n`
  }

  const instructions = prompts.meetingDocInstructions || DEFAULT_MEETING_DOC_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

export function buildDiplomaticCablePrompt(data: { type: 'country' | 'bilateral'; briefingData: any }): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = ''
  if (data.type === 'country') {
    const country = data.briefingData.country
    context = `# Intelligence Data: ${country?.name} (${country?.iso3})\n\n`
    context += serializeData(data.briefingData) + '\n\n'
  } else {
    context = `# Bilateral Intelligence: ${data.briefingData.countryA?.name} ↔ ${data.briefingData.countryB?.name}\n\n`
    context += serializeData(data.briefingData) + '\n\n'
  }

  const instructions = prompts.cableInstructions || DEFAULT_CABLE_INSTRUCTIONS

  return [
    { role: 'system', content: systemBase + '\n\n' + instructions },
    { role: 'user', content: context },
  ]
}

// ===== UN Monitor Briefing =====

export const DEFAULT_UN_BRIEFING_INSTRUCTIONS = `You are writing an intelligence briefing about current activity at the United Nations. Your audience is diplomats and policy professionals who need to quickly understand what is happening at the UN right now.

Produce THREE sections separated by exactly "===NEWS===" and "===STATEMENTS===" on their own lines. Each section is continuous prose — NO bullet points, NO numbered lists, NO markdown headings.

SECTION 1 — SITUATION OVERVIEW (before ===NEWS===):
Write 3-5 paragraphs covering the overall UN situation:
- LEAD with the most significant Security Council development. Cite the resolution/draft number, date, vote tally, and who vetoed.
- WEAVE IN the broader pattern: is the Council deadlocked? Which crises are blocked?
- CLOSE with what to watch: upcoming votes, unresolved tensions, diplomatic signals.

SECTION 2 — NEWS DIGEST (between ===NEWS=== and ===STATEMENTS===):
Write 2-3 paragraphs synthesizing what news outlets and UN agencies are reporting about UN-related developments right now:
- Group related stories into themes rather than listing articles one by one.
- Name specific outlets, cite what they report, and connect it to the broader diplomatic picture.
- Cover humanitarian situations, peace operations, and institutional developments where the data supports it.

SECTION 3 — DIPLOMATIC SIGNALS (after ===STATEMENTS===):
Write 2-3 paragraphs analyzing what the P5 and other missions are saying in their official statements:
- What topics and crises dominate diplomatic messaging? Which P5 members are most active and on what?
- Are there signals of shifting positions, emerging coalitions, or rhetorical escalation?
- Connect statement patterns to Council dynamics and upcoming decisions.

RULES:
- Be specific: cite resolution numbers, vote tallies, dates, country names, sources, and speakers.
- Write in present tense where appropriate. Use past tense for completed votes.
- Every sentence should carry information. No filler phrases.
- NEVER fabricate votes, resolutions, statements, or events not present in the data.
- Use GA speech themes and conflict mentions ONLY as background context — not as current events.
- Keep each section focused and concise (150-300 words each).`

export function buildUNBriefingPrompt(data: {
  keyDevelopments: any[]
  recentVetoes: any[]
  stats: any
  p5Activity: any[]
  statements: any[]
  news: any[]
  activeTopics: any[]
  gaContext?: any
}): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let context = `# UN Monitor — Current Activity Data\n\n`
  context += `Date: ${new Date().toISOString().slice(0, 10)}\n\n`

  // Security Council actions
  if (data.keyDevelopments?.length) {
    context += `## Security Council: Recent Resolutions & Drafts\n`
    for (const d of data.keyDevelopments) {
      const status = d.adopted ? 'ADOPTED' : d.vetoed ? 'VETOED' : 'NOT ADOPTED (insufficient votes)'
      const vetoInfo = d.vetoedBy?.length ? ` (vetoed by: ${d.vetoedBy.map((v: any) => v.name).join(', ')})` : ''
      context += `- ${d.date} | ${d.id} | ${status} | ${d.title}${vetoInfo} | Vote: ${d.tally?.yes || 0}Y-${d.tally?.no || 0}N-${d.tally?.abstain || 0}A\n`
    }
    context += '\n'
  }

  // Stats summary
  if (data.stats) {
    context += `## Summary: ${data.stats.resolutionsConsidered} resolutions considered since Jan 2025: ${data.stats.adopted} adopted, ${data.stats.vetoed} vetoed\n\n`
  }

  // Recent vetoes
  if (data.recentVetoes?.length) {
    context += `## Recent Vetoes\n`
    for (const v of data.recentVetoes) {
      context += `- ${v.date}: ${v.subject} — vetoed by ${v.vetoedBy?.map((x: any) => x.name).join(', ')}\n`
    }
    context += '\n'
  }

  // P5 diplomatic activity from statements
  if (data.p5Activity?.length) {
    context += `## P5 Mission Activity (Diplomatic Statements)\n`
    for (const p of data.p5Activity) {
      context += `- ${p.name} (${p.iso3}): ${p.count} statements`
      if (p.latest) {
        context += ` | Latest: "${p.latest.title}" (${p.latest.date})`
      }
      context += '\n'
    }
    context += '\n'
  }

  // Active topics
  if (data.activeTopics?.length) {
    context += `## Active Topics: ${data.activeTopics.map((t: any) => `${t.topic} (${t.count})`).join(', ')}\n\n`
  }

  // Recent statements (with detail)
  if (data.statements?.length) {
    context += `## Recent Diplomatic Statements (last 20)\n`
    for (const s of data.statements.slice(0, 20)) {
      context += `- [${s.source}] ${s.title}`
      if (s.speaker) context += ` — ${s.speaker}`
      if (s.type) context += ` (${s.type})`
      if (s.countries?.length) context += ` [${s.countries.join(', ')}]`
      if (s.topics?.length) context += ` {${s.topics.join(', ')}}`
      context += '\n'
      if (s.excerpt) context += `  > ${s.excerpt.slice(0, 200)}\n`
    }
    context += '\n'
  }

  // News coverage (with descriptions)
  if (data.news?.length) {
    context += `## UN-Related News Coverage\n`
    for (const n of data.news.slice(0, 15)) {
      context += `- [${n.source}] ${n.title}`
      if (n.countries?.length) context += ` [${n.countries.join(', ')}]`
      if (n.topics?.length) context += ` (${n.topics.join(', ')})`
      context += '\n'
      if (n.description) context += `  > ${n.description.slice(0, 200)}\n`
    }
    context += '\n'
  }

  // GA context (background only)
  if (data.gaContext) {
    context += `## Background: GA Session ${data.gaContext.session}\n`
    if (data.gaContext.topThemes?.length) {
      context += `Top debate themes: ${data.gaContext.topThemes.join(', ')}\n`
    }
    if (data.gaContext.topConflicts?.length) {
      context += `Most-discussed conflicts: ${data.gaContext.topConflicts.map((c: any) => `${c.name} (${c.mentions} mentions)`).join(', ')}\n`
    }
    context += '(Use as background context only — these are from the last GA session, not current events)\n\n'
  }

  return [
    { role: 'system', content: systemBase + '\n\n' + DEFAULT_UN_BRIEFING_INSTRUCTIONS },
    { role: 'user', content: context },
  ]
}

export const DEFAULT_TODAY_BRIEFING_INSTRUCTIONS = `You are writing the morning intelligence brief for a UN Secretariat staff member. Your reader spends their day on institutional UN work — their lens is "what does this mean for the organization, its bodies, and the substantive files I work on" rather than raw geopolitics.

Tone: dry, analytical, no boosterism, no hedging filler ("it remains to be seen…"). Treat the reader as a peer who already knows the basics — don't explain what the Security Council is.

CITATIONS — strict format:
- Every news item and statement below is prefixed with a bracketed ID: [n1]–[n40] for news, [s1]–[s25] for statements. These are the ONLY valid citation tokens.
- When you make a factual claim from one of those items, append the ID(s) in brackets at the end of the sentence — e.g., "The Council will hold private meetings with SG candidates [n3]." Multiple cites per claim are fine: [n3,n7,s4].
- DO NOT cite by item title text. Do NOT write things like "[The situation concerning the DRC - 10185th]" or "[Press Conference: IMO SG on the Strait of Hormuz]". If you want to reference a Web TV meeting or any other item, find its [sN] ID in the data list and use that.
- DO NOT invent IDs. Only use IDs that appear in the data above.
- Background facts (your own knowledge, no source needed) do not require citation.

OUTPUT FORMAT — use these exact section markers, each on its own line, in this order:

===HEADLINE===
One sentence (max 30 words) capturing the most consequential development of the day from a UN-institutional standpoint. Concrete and specific.

===AT_THE_UN===
This section MUST cover four institutional tracks in order, each as a labelled bullet group. The reader works for the UN — peace & security is loud but they need balanced visibility into the other three tracks too. If a track has no signal today, write one sentence explicitly noting that ("Quiet on Fifth Committee; next budget session resumes…") rather than dropping the heading.

**Peace & security:** Which SC/regional mandates are in motion, which delegations are active, which files (Ukraine, Gaza, Sudan, Haiti, DRC, etc.) saw movement.

**Reform & governance:** UN80 reform initiative, Pact for the Future implementation, Summit of the Future follow-up, SG management reforms, Secretariat restructuring, any GA reform discussions. Look in the data for items tagged UN80_REFORM or mentioning "Pact for the Future", "UN reform", "Summit of the Future", "Guterres reform".

**Budget & administration:** Fifth Committee sessions, ACABQ reports, programme budget items, peacekeeping budgets, scale of assessments, US arrears, ICSC, OIOS findings. Look for items tagged FIFTH_COMMITTEE or mentioning "Fifth Committee", "ACABQ", "regular budget", "peacekeeping budget".

**Development & humanitarian:** ECOSOC outcomes, HLPF preparations, SDG progress / setbacks, Financing for Development track (FfD4), UNDP / UNCTAD / OCHA programmatic items. Look for items tagged ECOSOC, SDGS, FFD.

For each track, 2-4 sentences max, with citations. The point is institutional visibility across all four tracks, not exhaustive coverage of any one.

**Country groupings (conditional):** AFTER the four tracks above, scan the day's items for ones whose countryFlags include is_ldc, is_lldc, or is_sids. For each of those three groupings where at least one relevant item exists, add a one-line bullet labelled "LDC focus:" / "LLDC focus:" / "SIDS focus:" naming the development or process and citing the item. Skip the bullet entirely if no items for that grouping appear in today's data — DO NOT manufacture a "quiet" placeholder for these.

===IN_THE_WORLD===
2-3 short paragraphs. External developments worth knowing, framed for their institutional consequences: which crises are likely to land on UN agendas, which bilateral or regional shifts will reshape negotiating dynamics, which non-UN actors (G7, BRICS, regional bodies) are setting expectations the UN will have to respond to. Do not just summarize headlines.

===WATCH_LIST===
3-5 short bullets (use "- " prefix). Anomalies, emerging coalitions, novel pairings, escalating rhetoric, dogs-not-barking. Each bullet: what is happening + why it warrants attention. Be willing to flag uncertainty; do not invent.

===WEEK_ARC===
Pick TWO or THREE threads — not more — and trace each as a mini-arc. The goal is to show movement (or notable stasis), not to summarize the week. Format each thread as ONE compact paragraph of 2-3 sentences, separated by a blank line. Each paragraph must:
  - Name the thread in the opening clause (e.g., "Iran-IAEA verification:", "Sahel realignment:", "Lebanon mandate:").
  - Anchor it in time using the MM-DD dates on the items — e.g., "Earlier in the week (06-21), … ; by today (06-26) …". If statements span more days than news, lean on statements for the earlier anchor.
  - End with a single sharp verb for the trajectory: accelerating, stalling, pivoting, hardening, fragmenting, consolidating, reversing, or "holding" if genuinely no movement.
Citations: cite ONLY the 1-2 items that anchor each end of the arc. No trailing citation dump.
If one of your candidate threads doesn't show real movement, drop it — better to write 2 disciplined arcs than 3 mushy ones. Only write the "data too thin" disclaimer if no thread anywhere shows movement.

CRITICAL RULES:
- Use ONLY facts from the provided data. Do not invent meetings, votes, statements, or quotes.
- If a section has thin data, say so plainly in 1 sentence rather than padding. "Limited reporting today on [topic]" is acceptable.
- Where relevant, name specific delegations, resolutions, missions, or speakers — vague phrases ("some countries", "diplomatic sources") are not useful to this reader.
- Do not editorialize about whether developments are "concerning" or "welcome" — describe and assess implications, not desirability.`

export function buildTodayBriefingPrompt(data: {
  dateLabel: string
  todayNews: any[]
  todayStatements: any[]
  weekNews: any[]
  weekStatements: any[]
  recentSCActions: any[]
  recentSCMeetings?: { date: string; topic: string; outcome: string; meeting: string }[]
  recentVetoes: any[]
  p5Activity: any[]
  activeTopics: any[]
  topCountriesToday: { iso3: string; count: number }[]
  topCountriesWeek: { iso3: string; count: number }[]
}): LLMMessage[] {
  const prompts = getPromptConfig()
  const systemBase = prompts.systemBase || DEFAULT_SYSTEM_BASE

  let ctx = `# Today's Intelligence Brief — ${data.dateLabel} (New York local day)\n\n`

  ctx += `## TODAY — News (last 24h, NY) — cite with [nN] IDs\n`
  if (data.todayNews.length === 0) {
    ctx += `(none reported yet)\n\n`
  } else {
    data.todayNews.slice(0, 40).forEach((n, i) => {
      const id = `n${i + 1}`
      ctx += `[${id}] [${n.source}] ${n.title}`
      if (n.countries?.length) ctx += ` [${n.countries.join(', ')}]`
      if (n.topics?.length) ctx += ` {${n.topics.join(', ')}}`
      ctx += '\n'
      if (n.description) ctx += `  > ${n.description.slice(0, 200)}\n`
    })
    ctx += '\n'
  }

  ctx += `## TODAY — Diplomatic Statements — cite with [sN] IDs\n`
  if (data.todayStatements.length === 0) {
    ctx += `(none reported yet)\n\n`
  } else {
    data.todayStatements.slice(0, 25).forEach((s, i) => {
      const id = `s${i + 1}`
      ctx += `[${id}] [${s.source}] ${s.title}`
      if (s.speaker) ctx += ` — ${s.speaker}`
      if (s.type) ctx += ` (${s.type})`
      if (s.countries?.length) ctx += ` [${s.countries.join(', ')}]`
      ctx += '\n'
      if (s.excerpt) ctx += `  > ${s.excerpt.slice(0, 220)}\n`
    })
    ctx += '\n'
  }

  ctx += `## TOP COUNTRIES IN COVERAGE\n`
  ctx += `Today: ${data.topCountriesToday.slice(0, 10).map(c => `${c.iso3}(${c.count})`).join(', ') || '—'}\n`
  ctx += `This week: ${data.topCountriesWeek.slice(0, 10).map(c => `${c.iso3}(${c.count})`).join(', ') || '—'}\n\n`

  // News volume is high (~500/day) and ages out quickly, so for arc context we
  // sample a few items per day rather than just taking the most-recent slice.
  const newsByDay = new Map<string, any[]>()
  for (const n of data.weekNews) {
    const day = (n.publishedAt || '').slice(5, 10)
    if (!day) continue
    if (!newsByDay.has(day)) newsByDay.set(day, [])
    newsByDay.get(day)!.push(n)
  }
  const sampledWeekNews: any[] = []
  for (const [, items] of [...newsByDay.entries()].sort((a, b) => a[0] < b[0] ? 1 : -1)) {
    sampledWeekNews.push(...items.slice(0, 12))
  }

  ctx += `## THIS WEEK — News (rolling 7 days, NY) — sampled across days for arc context; date prefix is MM-DD\n`
  ctx += `(Note: news volume is high; only ${sampledWeekNews.length} items shown, sampled across ${newsByDay.size} day(s). For deeper time-depth, prefer statements.)\n`
  for (const n of sampledWeekNews.slice(0, 80)) {
    const day = (n.publishedAt || '').slice(5, 10) || '??-??'
    ctx += `- [${day}] ${n.title}`
    if (n.countries?.length) ctx += ` [${n.countries.slice(0, 4).join(', ')}]`
    ctx += '\n'
  }
  ctx += '\n'

  ctx += `## THIS WEEK — Statements — date prefix is MM-DD (these span the full week; best source for arc evolution)\n`
  for (const s of data.weekStatements.slice(0, 60)) {
    const day = (s.publishedAt || '').slice(5, 10) || '??-??'
    ctx += `- [${day}] ${s.title}`
    if (s.countries?.length) ctx += ` [${s.countries.slice(0, 4).join(', ')}]`
    ctx += '\n'
  }
  ctx += '\n'

  if (data.recentSCActions?.length) {
    ctx += `## RECENT SECURITY COUNCIL ACTIONS\n`
    for (const r of data.recentSCActions.slice(0, 8)) {
      const status = r.adopted ? 'ADOPTED' : r.vetoed ? 'VETOED' : 'NOT ADOPTED (insufficient votes)'
      const vetoers = r.vetoedBy?.length ? ` (vetoed by ${r.vetoedBy.map((v: any) => v.name).join(', ')})` : ''
      ctx += `- ${r.date} | ${r.id} | ${status} | ${r.title}${vetoers}\n`
    }
    ctx += '\n'
  }

  if (data.recentSCMeetings?.length) {
    ctx += `## SECURITY COUNCIL MEETINGS (official record, newest first)\n`
    for (const m of data.recentSCMeetings) {
      ctx += `- ${m.date} | ${m.meeting} | ${m.topic}${m.outcome ? ` | outcome: ${m.outcome}` : ' | briefing/debate, no decision'}\n`
    }
    ctx += '\n'
  }

  if (data.p5Activity?.length) {
    ctx += `## P5 MISSION ACTIVITY (statement volume)\n`
    for (const p of data.p5Activity) {
      ctx += `- ${p.name}: ${p.count} statements`
      if (p.latest) ctx += ` | latest: "${p.latest.title}" (${p.latest.date.slice(0, 10)})`
      ctx += '\n'
    }
    ctx += '\n'
  }

  if (data.activeTopics?.length) {
    ctx += `## ACTIVE TOPICS (statements): ${data.activeTopics.map((t: any) => `${t.topic}(${t.count})`).join(', ')}\n\n`
  }

  return [
    { role: 'system', content: systemBase + '\n\n' + DEFAULT_TODAY_BRIEFING_INSTRUCTIONS },
    { role: 'user', content: ctx },
  ]
}
