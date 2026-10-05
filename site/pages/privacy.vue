<template>
  <div class="bg-primary-50/40 min-h-screen">
    <article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <p class="text-[11px] uppercase tracking-[0.14em] text-primary-500">Privacy</p>
      <h1 class="font-serif text-4xl text-primary-900 mt-2">Privacy policy</h1>
      <p v-if="policy?.updatedAt" class="text-sm text-primary-500 mt-2">Last updated {{ new Date(policy.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) }}</p>

      <div class="policy mt-8 bg-white rounded-2xl ring-1 ring-primary-200/70 p-6 sm:p-8">
        <div v-if="policyHtml" class="policy-text" v-html="policyHtml" />
        <p v-else class="text-sm text-primary-400">Loading…</p>

        <h2 id="contact">Contact us about your data</h2>
        <form v-if="!sent" class="space-y-3 mt-3" @submit.prevent="send">
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="text-sm text-primary-600">Your email address (so we can reply)
              <input v-model="req.email" type="email" required autocomplete="email" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
            </label>
            <label class="text-sm text-primary-600">Your name (optional)
              <input v-model="req.name" autocomplete="name" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-1.5 text-sm">
            </label>
          </div>
          <label class="block text-sm text-primary-600">What would you like to do?
            <select v-model="req.type" class="mt-1 w-full sm:w-72 border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white">
              <option value="access">Get a copy of my data</option>
              <option value="correction">Correct my data</option>
              <option value="deletion">Delete my data</option>
              <option value="objection">Object to how my data is used</option>
              <option value="restriction">Restrict how my data is used</option>
              <option value="portability">Receive my data to move it elsewhere</option>
              <option value="question">Ask a question</option>
            </select>
          </label>
          <label class="block text-sm text-primary-600">Your request
            <textarea v-model="req.message" rows="4" required minlength="10" class="mt-1 w-full border border-primary-200 rounded-lg px-3 py-2 text-sm" placeholder="Tell us what it concerns, for example your account name." />
          </label>
          <input v-model="req.website" type="text" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
          <p class="text-xs text-primary-500">We use what you send only to answer your request (legal basis: legal obligation), and keep it for up to three years after the request is closed.</p>
          <button class="px-4 py-2 rounded-lg bg-primary-900 text-white text-sm hover:bg-primary-800 disabled:opacity-50" :disabled="sending">{{ sending ? 'Sending…' : 'Send request' }}</button>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        </form>
        <p v-else class="mt-3 text-sm text-emerald-700">Thank you. We have received your request and will answer by email within one month.</p>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'

useHead({ title: 'Privacy policy — World Country Groups' })
const { data: policy } = await useFetch<{ markdown: string; updatedAt: string }>('/api/privacy-policy')
const policyHtml = computed(() => (policy.value?.markdown ? marked.parse(policy.value.markdown) as string : ''))
const req = reactive({ email: '', name: '', type: 'access', message: '', website: '' })
const sending = ref(false)
const sent = ref(false)
const error = ref('')
async function send() {
  sending.value = true; error.value = ''
  try {
    await $fetch('/api/privacy-request', { method: 'POST', body: { ...req } })
    sent.value = true
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Could not send the request; please try again'
  } finally { sending.value = false }
}
</script>

<style scoped>
.policy :deep(h2) { @apply font-serif text-xl text-primary-900 mt-8 mb-2; }
.policy :deep(p) { @apply text-[15px] leading-7 text-primary-700 mt-3; }
.policy :deep(.policy-text > p:first-child) { @apply text-base text-primary-800 mt-0; }
.policy :deep(ul) { @apply list-disc pl-5 mt-3 space-y-1.5 text-[15px] leading-7 text-primary-700; }
.policy :deep(a) { @apply text-accent-700 underline; }
.policy :deep(code) { @apply text-[13px] bg-primary-50 px-1 rounded; }
.policy :deep(table) { @apply w-full text-sm mt-3; }
.policy :deep(th) { @apply text-left font-medium text-primary-500 border-b border-primary-100 py-2 pr-4; }
.policy :deep(td) { @apply border-b border-primary-50 py-2 pr-4 text-primary-700 align-top; }
</style>
