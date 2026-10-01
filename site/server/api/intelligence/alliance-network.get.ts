import { getCountryAlliances } from '~/server/utils/alliances'
import { getRegistry } from '~/server/utils/wcg'

interface GraphNode {
  id: string
  label: string
  primary?: boolean
}

interface GraphEdge {
  source: string
  target: string
  type: string
  name: string | null
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const iso = ((query.iso as string) || '').toUpperCase()
  if (!iso) throw createError({ statusCode: 400, message: 'iso parameter required' })

  const allianceData = getCountryAlliances(iso)
  if (!allianceData?.has_data) {
    return { nodes: [], edges: [] }
  }

  const registry = getRegistry()
  const getLabel = (code: string) => {
    const m = registry.getCountryMembership(code)
    return m?.name || code
  }

  // Build nodes: primary country + allies
  const nodeSet = new Set<string>([iso])
  const edges: GraphEdge[] = []

  // Add direct allies and edges from shared alliances
  const activeAlliances = allianceData.alliances.filter(a => !a.end_year)

  for (const alliance of activeAlliances) {
    for (const member of alliance.co_members) {
      nodeSet.add(member)
    }
  }

  // Limit allies to 20
  const allNodes = Array.from(nodeSet)
  const limitedNodes = allNodes.length > 21
    ? [iso, ...allNodes.filter(n => n !== iso).slice(0, 20)]
    : allNodes
  const limitedSet = new Set(limitedNodes)

  // Build edges from alliances (only between nodes in our set)
  for (const alliance of activeAlliances) {
    const allMembers = [iso, ...alliance.co_members].filter(m => limitedSet.has(m))
    // Connect primary country to each co-member
    for (const member of alliance.co_members) {
      if (!limitedSet.has(member)) continue
      const edgeKey = [iso, member].sort().join('-') + ':' + alliance.type
      if (!edges.find(e => [e.source, e.target].sort().join('-') + ':' + e.type === edgeKey)) {
        edges.push({
          source: iso,
          target: member,
          type: alliance.type,
          name: alliance.name,
        })
      }
    }
  }

  // Inter-ally edges (2nd degree): check if allies share alliances with each other
  const allyList = limitedNodes.filter(n => n !== iso)
  for (const ally of allyList) {
    const allyAlliances = getCountryAlliances(ally)
    if (!allyAlliances?.alliances) continue
    const allyActive = allyAlliances.alliances.filter(a => !a.end_year)
    for (const alliance of allyActive) {
      for (const coMember of alliance.co_members) {
        if (coMember === iso || coMember === ally || !limitedSet.has(coMember)) continue
        const edgeKey = [ally, coMember].sort().join('-') + ':' + alliance.type
        if (!edges.find(e => [e.source, e.target].sort().join('-') + ':' + e.type === edgeKey)) {
          edges.push({
            source: ally,
            target: coMember,
            type: alliance.type,
            name: alliance.name,
          })
        }
      }
    }
  }

  const nodes: GraphNode[] = limitedNodes.map(id => ({
    id,
    label: getLabel(id),
    primary: id === iso,
  }))

  return { nodes, edges }
})
