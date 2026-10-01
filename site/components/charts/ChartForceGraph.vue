<template>
  <div ref="containerRef" class="relative">
    <svg :width="width" :height="height" class="overflow-visible">
      <!-- Edges -->
      <line
        v-for="(edge, i) in renderedEdges"
        :key="'e' + i"
        :x1="edge.x1" :y1="edge.y1"
        :x2="edge.x2" :y2="edge.y2"
        :stroke="edgeColor(edge.type)"
        stroke-width="1.5"
        stroke-opacity="0.5"
      />

      <!-- Nodes -->
      <g
        v-for="node in renderedNodes"
        :key="node.id"
        class="cursor-pointer"
        @mouseenter="onNodeHover(node, $event)"
        @mouseleave="hideTooltip"
      >
        <circle
          :cx="node.x" :cy="node.y"
          :r="node.primary ? 12 : 7"
          :fill="node.primary ? '#1e293b' : '#94a3b8'"
          :stroke="node.primary ? '#0f172a' : '#cbd5e1'"
          stroke-width="2"
        />
        <text
          :x="node.x" :y="node.y + (node.primary ? 22 : 16)"
          text-anchor="middle"
          class="text-[9px] fill-primary-600 pointer-events-none"
          :class="node.primary ? 'font-bold' : ''"
        >{{ node.label.length > 12 ? node.id : node.label }}</text>
      </g>
    </svg>

    <!-- Tooltip -->
    <ChartsChartTooltip
      :visible="tooltip.visible"
      :pos-x="tooltip.x"
      :pos-y="tooltip.y"
      :title="tooltip.title"
      :lines="tooltip.lines"
    />

    <!-- Legend -->
    <div class="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-primary-400">
      <span v-for="t in allianceTypes" :key="t.type" class="flex items-center gap-1">
        <span class="w-3 h-0.5 rounded" :style="{ background: t.color }" />
        {{ t.label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
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

const props = withDefaults(defineProps<{
  nodes: GraphNode[]
  edges: GraphEdge[]
  width?: number
  height?: number
}>(), {
  width: 600,
  height: 400,
})

const containerRef = ref<HTMLElement | null>(null)

const allianceTypes = [
  { type: 'defense', label: 'Defense', color: '#ef4444' },
  { type: 'entente', label: 'Entente', color: '#3b82f6' },
  { type: 'neutrality', label: 'Neutrality', color: '#10b981' },
  { type: 'nonaggression', label: 'Non-aggression', color: '#f59e0b' },
]

function edgeColor(type: string) {
  const found = allianceTypes.find(t => t.type === type)
  return found?.color || '#94a3b8'
}

// Force simulation state
interface SimNode extends GraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

const simNodes = ref<SimNode[]>([])
let animFrame: number | null = null

function initSim() {
  const cx = props.width / 2
  const cy = props.height / 2
  simNodes.value = props.nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / props.nodes.length
    const r = n.primary ? 0 : 100 + Math.random() * 60
    return {
      ...n,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    }
  })
}

function runSimulation() {
  const nodes = simNodes.value
  if (nodes.length < 2) return

  const cx = props.width / 2
  const cy = props.height / 2
  const edgeMap = new Map<string, boolean>()
  for (const e of props.edges) {
    edgeMap.set(`${e.source}-${e.target}`, true)
    edgeMap.set(`${e.target}-${e.source}`, true)
  }

  let iterations = 0
  const maxIterations = 200

  function step() {
    const dt = 0.3
    const repulsion = 2000
    const attraction = 0.01
    const damping = 0.85
    const centering = 0.005

    // Repulsive forces (Coulomb)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const dist = Math.max(Math.hypot(dx, dy), 10)
        const force = repulsion / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        nodes[i].vx -= fx * dt
        nodes[i].vy -= fy * dt
        nodes[j].vx += fx * dt
        nodes[j].vy += fy * dt
      }
    }

    // Attractive forces along edges (Hooke)
    for (const edge of props.edges) {
      const src = nodes.find(n => n.id === edge.source)
      const tgt = nodes.find(n => n.id === edge.target)
      if (!src || !tgt) continue
      const dx = tgt.x - src.x
      const dy = tgt.y - src.y
      const dist = Math.hypot(dx, dy)
      const idealDist = 120
      const force = attraction * (dist - idealDist)
      const fx = (dx / (dist || 1)) * force
      const fy = (dy / (dist || 1)) * force
      src.vx += fx * dt
      src.vy += fy * dt
      tgt.vx -= fx * dt
      tgt.vy -= fy * dt
    }

    // Centering force
    for (const node of nodes) {
      node.vx += (cx - node.x) * centering
      node.vy += (cy - node.y) * centering
    }

    // Apply velocity + damping + boundary
    let totalKE = 0
    const pad = 30
    for (const node of nodes) {
      node.vx *= damping
      node.vy *= damping
      node.x += node.vx
      node.y += node.vy
      node.x = Math.max(pad, Math.min(props.width - pad, node.x))
      node.y = Math.max(pad, Math.min(props.height - pad, node.y))
      totalKE += node.vx * node.vx + node.vy * node.vy
    }

    // Trigger reactivity
    simNodes.value = [...nodes]

    iterations++
    if (totalKE > 0.1 && iterations < maxIterations) {
      animFrame = requestAnimationFrame(step)
    }
  }

  animFrame = requestAnimationFrame(step)
}

const renderedNodes = computed(() => simNodes.value)

const renderedEdges = computed(() => {
  return props.edges.map(e => {
    const src = simNodes.value.find(n => n.id === e.source)
    const tgt = simNodes.value.find(n => n.id === e.target)
    return {
      x1: src?.x || 0, y1: src?.y || 0,
      x2: tgt?.x || 0, y2: tgt?.y || 0,
      type: e.type,
    }
  })
})

// Tooltip
const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as { label: string; value?: string; color?: string }[],
})

function onNodeHover(node: SimNode, e: MouseEvent) {
  const nodeEdges = props.edges.filter(ed => ed.source === node.id || ed.target === node.id)
  tooltip.visible = true
  tooltip.x = e.clientX
  tooltip.y = e.clientY
  tooltip.title = node.label
  tooltip.lines = [
    { label: 'ISO', value: node.id },
    { label: 'Alliances', value: String(nodeEdges.length) },
  ]
}

function hideTooltip() {
  tooltip.visible = false
}

watch(() => [props.nodes, props.edges], () => {
  if (animFrame) cancelAnimationFrame(animFrame)
  initSim()
  runSimulation()
}, { immediate: true })

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
})
</script>
