<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-primary-50/40">
    <div class="max-w-lg w-full bg-white rounded-2xl ring-1 ring-primary-200/70 p-8 text-center">
      <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">Shared link</p>
      <h1 class="font-serif text-3xl text-primary-900 mt-2">{{ msg.title }}</h1>
      <p class="text-primary-600 mt-3 leading-relaxed">{{ msg.body }}</p>
      <p class="text-xs text-primary-400 mt-4">Visits through shared links, including refused ones like this, are recorded (time, IP address, browser and device) and kept for one year.</p>
      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <NuxtLink v-if="state.share" :to="state.share.path" class="px-4 py-2 rounded-xl bg-primary-900 text-white text-sm hover:bg-primary-800">Back to {{ state.share.label }}</NuxtLink>
        <NuxtLink to="/login" class="px-4 py-2 rounded-xl ring-1 ring-primary-200 text-sm text-primary-700 hover:bg-primary-50">Sign in</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Shared link — World Country Groups' })
const route = useRoute()
const { state } = useAuth()
const MESSAGES: Record<string, { title: string; body: string }> = {
  scope: { title: 'This link opens one page', body: 'The link you were given shares a single page. To see the rest of World Country Groups, sign in or ask for an account.' },
  expired: { title: 'This link has expired', body: 'Ask the person who shared it for a new link.' },
  revoked: { title: 'This link was withdrawn', body: 'The person who shared it has switched it off. Ask them for a new link if you still need it.' },
  'used up': { title: 'This link has been used up', body: 'It could be opened a limited number of times. Ask the person who shared it for a new link.' },
  missing: { title: 'Link not found', body: 'Check that the address was copied in full, or ask for a new link.' },
}
const msg = computed(() => MESSAGES[String(route.query.reason)] || MESSAGES.missing)
</script>
