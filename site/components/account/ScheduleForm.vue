<template>
  <form class="rounded-xl ring-1 ring-primary-200 p-4 space-y-3" @submit.prevent="$emit('save', f)">
    <label class="block text-xs text-primary-500">Title
      <input v-model="f.title" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm" maxlength="120" placeholder="e.g. Weekly brief on Brazil">
    </label>
    <label class="block text-xs text-primary-500">What should the briefing cover?
      <textarea v-model="f.question" rows="3" required minlength="10" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Prepare a briefing on Brazil: the main developments of the past week, its positions at the UN and what to watch." />
    </label>
    <div class="grid sm:grid-cols-3 gap-3">
      <label class="text-xs text-primary-500">Format
        <select v-model="f.mode" class="sel"><option value="briefing">Briefing</option><option value="answer">Short answer</option></select>
      </label>
      <label v-if="f.mode === 'briefing'" class="text-xs text-primary-500">Briefing type
        <select v-model="f.template" class="sel"><option value="free">Free-form</option><option value="country">Country</option><option value="bilateral">Bilateral meeting</option><option value="issue">Issue</option><option value="group">Group</option></select>
      </label>
      <label class="text-xs text-primary-500">Language
        <select v-model="f.language" class="sel"><option v-for="(n, k) in LANGS" :key="k" :value="k">{{ n }}</option></select>
      </label>
    </div>
    <div class="grid sm:grid-cols-3 gap-3">
      <label class="text-xs text-primary-500">How often
        <select v-model="f.frequency" class="sel">
          <option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option>
          <option value="sg-straw-poll">After each Secretary-General straw poll</option>
        </select>
      </label>
      <label v-if="f.frequency === 'weekly'" class="text-xs text-primary-500">Day
        <select v-model.number="f.weekday" class="sel"><option v-for="(d, i) in DAYS" :key="d" :value="i">{{ d }}</option></select>
      </label>
      <label v-if="f.frequency === 'monthly'" class="text-xs text-primary-500">Day of the month
        <select v-model.number="f.day" class="sel"><option v-for="d in 28" :key="d" :value="d">{{ d }}</option></select>
      </label>
      <label v-if="f.frequency !== 'sg-straw-poll'" class="text-xs text-primary-500">Time
        <select v-model.number="f.hour" class="sel"><option v-for="h in 24" :key="h" :value="h - 1">{{ String(h - 1).padStart(2, '0') }}:00 UTC ({{ local(h - 1) }} your time)</option></select>
      </label>
    </div>
    <label class="flex items-center gap-2 text-sm text-primary-700"><input v-model="f.email" type="checkbox" class="rounded"> Also send it by email</label>
    <div class="flex gap-2">
      <button class="text-sm px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800">{{ submitLabel || 'Create' }}</button>
      <button type="button" class="text-sm px-4 py-2 rounded-lg bg-primary-100 text-primary-600" @click="$emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<script setup lang="ts">
const props = defineProps<{ model: any; submitLabel?: string }>()
defineEmits<{ save: [any]; cancel: [] }>()
const f = reactive({ ...props.model })
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const LANGS: Record<string, string> = { en: 'English', es: 'Español', fr: 'Français', ar: 'العربية', zh: '中文', ru: 'Русский', pt: 'Português', de: 'Deutsch' }
function local(h: number) {
  const d = new Date(); d.setUTCHours(h, 0, 0, 0)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.sel { @apply mt-1 w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white; }
</style>
