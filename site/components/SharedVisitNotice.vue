<template>
  <div v-if="isGuest && open" class="notice fixed inset-x-0 bottom-0 z-50 px-4" role="region" aria-label="Notice about visit records">
    <div class="max-w-3xl mx-auto mb-4 rounded-2xl bg-primary-900 text-white shadow-lg ring-1 ring-black/10 p-4 sm:p-5">
      <p class="text-sm leading-relaxed">
        <strong class="font-semibold">This page was shared with you by {{ share?.sharedBy }}.</strong>
        So that they can see how it is used, visits through this link are recorded: the time, your IP address, your browser and device, your language setting, the page you came from and the pages you view here.
        Records are kept for one year and are seen only by the site's administrators. Nothing else about you is collected and no advertising trackers are used.
      </p>
      <p class="text-xs text-primary-200 mt-2">If you would rather your visit was not recorded, close this page. To ask about or delete your records, contact the person who shared the link.</p>
      <div class="mt-3 flex justify-end">
        <button class="px-4 py-1.5 rounded-lg bg-white text-primary-900 text-sm font-medium hover:bg-primary-100" @click="dismiss">OK</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Tells visitors who arrive through a share link that their visit is recorded. */
const { state } = useAuth()
const share = computed(() => state.value.share)
const isGuest = computed(() => !state.value.authenticated && !!state.value.share)
const open = ref(false)
const key = computed(() => `wcg-share-notice:${share.value?.path || ''}`)

onMounted(() => {
  let seen = false
  try { seen = localStorage.getItem(key.value) === '1' } catch {}
  open.value = !seen
})
function dismiss() {
  open.value = false
  try { localStorage.setItem(key.value, '1') } catch {}
}
// the "Privacy" link in the header reopens it
if (import.meta.client) {
  window.addEventListener('wcg:share-notice', () => { open.value = true })
}
</script>

<style scoped>
.notice { padding-bottom: env(safe-area-inset-bottom, 0px); }
</style>
