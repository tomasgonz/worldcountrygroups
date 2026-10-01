<template>
  <div v-if="events.length">
    <ChartsChartTimeline :events="events" :width="680" :height="160" />
  </div>
  <p v-else class="text-xs text-primary-400">Not enough data points for timeline.</p>
</template>

<script setup lang="ts">
import type { TimelineEvent } from '../charts/ChartTimeline.vue'

const props = defineProps<{ data: any }>()

const events = computed<TimelineEvent[]>(() => {
  const evts: TimelineEvent[] = []

  // News events
  if (props.data?.recentNews?.length) {
    for (const n of props.data.recentNews) {
      if (n.publishedAt) {
        evts.push({
          date: n.publishedAt,
          type: 'news',
          title: n.title || 'News article',
          detail: n.source || undefined,
          intensity: 0.4,
        })
      }
    }
  }

  // Conflict trend → yearly events
  if (props.data?.riskProfile?.conflict?.trend?.length) {
    for (const t of props.data.riskProfile.conflict.trend) {
      if (t.year) {
        evts.push({
          date: `${t.year}-01-01`,
          type: 'conflict',
          title: `${t.events} conflict events in ${t.year}`,
          detail: `${t.fatalities} fatalities`,
          intensity: Math.min(1, (t.events || 0) / 5000),
        })
      }
    }
  }

  // Latest speech
  if (props.data?.latestSpeech?.date || props.data?.latestSpeech?.year) {
    const speechDate = props.data.latestSpeech.date || `${props.data.latestSpeech.year}-09-15`
    evts.push({
      date: speechDate,
      type: 'speech',
      title: `UN Address – Session ${props.data.latestSpeech.session}`,
      detail: props.data.latestSpeech.speaker || undefined,
      intensity: 0.7,
    })
  }

  return evts
})
</script>
