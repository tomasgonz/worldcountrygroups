<template>
  <div v-if="isGuest && open" class="notice fixed inset-x-0 bottom-0 z-50 px-3" role="region" aria-label="Privacy notice">
    <div class="max-w-2xl mx-auto mb-3 rounded-xl bg-white/95 backdrop-blur ring-1 ring-primary-200 shadow-md px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-primary-600">
      <p class="flex-1 min-w-[14rem] leading-snug">
        We keep simple, anonymous statistics on visits to shared pages; no tracking cookies.
        <NuxtLink to="/privacy" class="underline hover:text-primary-900">Privacy policy</NuxtLink>
      </p>
      <button class="shrink-0 px-2 py-1 rounded-lg text-primary-500 hover:text-primary-900 underline" @click="optOut">Don't count my visit</button>
      <button class="shrink-0 px-2.5 py-1 rounded-lg bg-primary-900 text-white hover:bg-primary-800" @click="dismiss">OK</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/** A short privacy note for visitors who arrive through a share link. */
const { state } = useAuth()
const isGuest = computed(() => !state.value.authenticated && !!state.value.share)
const open = ref(false)
const KEY = 'wcg-share-notice'

onMounted(() => {
  let seen = false
  try { seen = localStorage.getItem(KEY) === '1' } catch {}
  open.value = !seen
})
async function optOut() {
  try { await $fetch('/api/share-optout', { method: 'POST', body: { optOut: true } }) } catch {}
  dismiss()
}
function dismiss() {
  open.value = false
  try { localStorage.setItem(KEY, '1') } catch {}
}
if (import.meta.client) window.addEventListener('wcg:share-notice', () => { open.value = true })
</script>

<style scoped>
.notice { padding-bottom: env(safe-area-inset-bottom, 0px); }
</style>
