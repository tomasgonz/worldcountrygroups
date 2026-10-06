<template>
  <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
    <h2 class="font-serif text-xl font-bold text-primary-900 mb-2">Calendar subscription</h2>
    <p class="text-sm text-primary-500 mb-5">
      Add UN meetings, elections and UN appointments to Outlook, Google Calendar or Apple Calendar.
      The calendar keeps itself up to date: new meetings appear, changed ones move and cancelled ones are marked.
    </p>

    <div v-if="loading" class="text-sm text-primary-400">Loading…</div>
    <div v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</div>
    <template v-else-if="state">
      <!-- Options -->
      <div class="space-y-5">
        <fieldset>
          <legend class="block text-sm font-medium text-primary-700 mb-2">UN meetings <span class="font-normal text-primary-400">(from the UN Journal, next 8 days)</span></legend>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="UN meetings">
            <button v-for="opt in meetingOptions" :key="opt.value" type="button" role="radio" :aria-checked="form.unMeetings === opt.value"
              class="text-sm px-4 py-1.5 rounded-full border transition-colors"
              :class="form.unMeetings === opt.value ? 'bg-primary-900 text-white border-primary-900' : 'bg-white text-primary-600 border-primary-200 hover:border-primary-400'"
              @click="set('unMeetings', opt.value)">{{ opt.label }}</button>
          </div>
          <label v-if="form.unMeetings !== 'none'" class="mt-3 flex items-center gap-2 text-sm text-primary-600">
            <input type="checkbox" class="rounded border-primary-300 text-primary-900 focus:ring-primary-500" :checked="form.unMeetingsPublicOnly"
              @change="set('unMeetingsPublicOnly', ($event.target as HTMLInputElement).checked)" />
            Public meetings only (leave out closed meetings)
          </label>
        </fieldset>

        <fieldset>
          <legend class="block text-sm font-medium text-primary-700 mb-2">National elections <span class="font-normal text-primary-400">(next 12 months)</span></legend>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="National elections">
            <button v-for="opt in electionOptions" :key="opt.value" type="button" role="radio" :aria-checked="form.elections === opt.value"
              class="text-sm px-4 py-1.5 rounded-full border transition-colors"
              :class="form.elections === opt.value ? 'bg-primary-900 text-white border-primary-900' : 'bg-white text-primary-600 border-primary-200 hover:border-primary-400'"
              @click="set('elections', opt.value)">{{ opt.label }}</button>
          </div>
          <p v-if="form.elections === 'followed'" class="text-xs text-primary-400 mt-2">
            <template v-if="state.followedCountries">Elections in the {{ state.followedCountries }} {{ state.followedCountries === 1 ? 'country' : 'countries' }} you follow.</template>
            <template v-else>You don't follow any countries yet, so no elections will be shown.</template>
            <NuxtLink to="/dashboard" class="text-accent-600 hover:text-accent-700 underline ml-1">Manage watchlist</NuxtLink>
          </p>
          <p class="text-xs text-primary-400 mt-1">Elections whose exact day isn't known yet appear on the first of the month, marked "date TBC".</p>
        </fieldset>

        <label class="flex items-start gap-2 text-sm text-primary-600">
          <input type="checkbox" class="mt-0.5 rounded border-primary-300 text-primary-900 focus:ring-primary-500" :checked="form.unElections"
            @change="set('unElections', ($event.target as HTMLInputElement).checked)" />
          <span>
            <span class="font-medium text-primary-700">UN elections and appointments</span><br>
            Secretary-General selection milestones and straw polls, Security Council and General Assembly President elections.
          </span>
        </label>
      </div>

      <div class="flex items-center gap-3 mt-5">
        <button v-if="!state.enabled" type="button" :disabled="busy"
          class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          @click="save()">{{ busy ? 'Creating…' : 'Create my calendar link' }}</button>
        <span v-if="msg" class="text-sm" :class="ok ? 'text-green-600' : 'text-red-600'" aria-live="polite">{{ msg }}</span>
      </div>

      <!-- Feed link -->
      <div v-if="state.enabled && state.feedUrl" class="border-t border-primary-100 mt-6 pt-6">
        <label for="calendarFeedUrl" class="block text-sm font-medium text-primary-700 mb-1">Your calendar link</label>
        <div class="flex flex-col sm:flex-row gap-2">
          <input id="calendarFeedUrl" :value="state.feedUrl" readonly
            class="flex-1 min-w-0 px-3 py-2 border border-primary-200 rounded-lg text-sm font-mono text-primary-700 bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            @focus="($event.target as HTMLInputElement).select()" />
          <button type="button" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 shrink-0" @click="copy">
            {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p class="text-xs text-primary-400 mt-1">
          {{ state.eventCount }} {{ state.eventCount === 1 ? 'event' : 'events' }} in the calendar right now.
        </p>
        <p class="text-xs text-amber-700 mt-2">
          Keep this link private: anyone who has it can see this calendar (only the meetings and elections you chose; nothing else about your account).
          If it has been shared by mistake, get a new link below.
        </p>

        <div class="mt-5 flex flex-wrap gap-2">
          <a :href="state.webcalUrl!" class="bg-primary-900 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
            Add to Apple Calendar / Outlook desktop
          </a>
          <a :href="googleUrl" target="_blank" rel="noopener noreferrer"
            class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50">Open in Google Calendar</a>
        </div>

        <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-primary-600">
          <div>
            <h3 class="font-medium text-primary-800 mb-1">Google Calendar</h3>
            <p>On a computer, open Google Calendar, then <strong>Other calendars → + → From URL</strong>. Paste the link and choose <strong>Add calendar</strong>.</p>
          </div>
          <div>
            <h3 class="font-medium text-primary-800 mb-1">Outlook on the web</h3>
            <p>Open the calendar, then <strong>Add calendar → Subscribe from web</strong>. Paste the link, give it a name and choose <strong>Import</strong>.</p>
          </div>
          <div>
            <h3 class="font-medium text-primary-800 mb-1">Apple Calendar</h3>
            <p>Use the button above, or <strong>File → New Calendar Subscription</strong> on a Mac and paste the link. On iPhone: Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar.</p>
          </div>
          <div>
            <h3 class="font-medium text-primary-800 mb-1">Outlook desktop</h3>
            <p>Use the button above, or <strong>Add calendar → From Internet</strong> and paste the link.</p>
          </div>
        </div>
        <p class="text-xs text-primary-400 mt-4">
          Changes to the options above apply to the same link. We update the calendar every few hours, but calendar apps
          refresh subscriptions on their own schedule: Apple and Outlook usually within a few hours, Google Calendar can take up to a day.
          Times are shown in your calendar's time zone.
        </p>

        <!-- New link / turn off -->
        <div class="border-t border-primary-100 mt-6 pt-5">
          <div v-if="confirming === 'regenerate'" class="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <p class="mb-3">The current link will stop working at once, and every calendar subscribed to it will stop updating. You'll need to add the new link again.</p>
            <div class="flex gap-2">
              <button type="button" :disabled="busy" class="py-1.5 px-4 rounded-lg text-sm font-medium bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-50" @click="act('regenerate')">Get a new link</button>
              <button type="button" class="py-1.5 px-4 rounded-lg text-sm border border-amber-300 hover:bg-amber-100" @click="confirming = null">Cancel</button>
            </div>
          </div>
          <div v-else-if="confirming === 'delete'" class="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800">
            <p class="mb-3">Turn off the calendar subscription? The link will stop working and subscribed calendars will stop updating.</p>
            <div class="flex gap-2">
              <button type="button" :disabled="busy" class="py-1.5 px-4 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" @click="act('delete')">Turn off</button>
              <button type="button" class="py-1.5 px-4 rounded-lg text-sm border border-red-300 hover:bg-red-100" @click="confirming = null">Cancel</button>
            </div>
          </div>
          <div v-else class="flex flex-wrap gap-3">
            <button type="button" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50" @click="confirming = 'regenerate'">Get a new link</button>
            <button type="button" class="text-sm px-4 py-2 rounded-lg text-red-600 hover:bg-red-50" @click="confirming = 'delete'">Turn off</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
type Include = {
  unMeetings: 'none' | 'newyork' | 'geneva' | 'both'
  unMeetingsPublicOnly: boolean
  elections: 'none' | 'followed' | 'all'
  unElections: boolean
}
interface CalendarState {
  enabled: boolean
  include: Include
  feedUrl: string | null
  webcalUrl: string | null
  createdAt: string | null
  followedCountries: number
  eventCount: number
}

const meetingOptions = [
  { value: 'none', label: 'None' },
  { value: 'newyork', label: 'New York' },
  { value: 'geneva', label: 'Geneva' },
  { value: 'both', label: 'Both' },
] as const
const electionOptions = [
  { value: 'none', label: 'None' },
  { value: 'followed', label: 'Countries I follow' },
  { value: 'all', label: 'All countries' },
] as const

const state = ref<CalendarState | null>(null)
const form = reactive<Include>({ unMeetings: 'newyork', unMeetingsPublicOnly: true, elections: 'followed', unElections: true })
const loading = ref(true)
const loadError = ref('')
const busy = ref(false)
const msg = ref('')
const ok = ref(true)
const copied = ref(false)
const confirming = ref<null | 'regenerate' | 'delete'>(null)

const googleUrl = computed(() => state.value?.webcalUrl
  ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(state.value.webcalUrl)}`
  : '#')

function apply(s: CalendarState) {
  state.value = s
  Object.assign(form, s.include)
}

async function load() {
  loading.value = true
  try {
    apply(await $fetch<CalendarState>('/api/account/calendar'))
  } catch (e: any) {
    loadError.value = e?.data?.statusMessage || 'Could not load calendar settings'
  } finally {
    loading.value = false
  }
}

async function save() {
  busy.value = true
  msg.value = ''
  const creating = !state.value?.enabled
  try {
    apply(await $fetch<CalendarState>('/api/account/calendar', { method: 'POST', body: { action: 'save', include: { ...form } } }))
    ok.value = true
    msg.value = creating ? 'Calendar link created' : 'Saved'
  } catch (e: any) {
    ok.value = false
    msg.value = e?.data?.statusMessage || 'Could not save'
  } finally {
    busy.value = false
  }
}

function set<K extends keyof Include>(key: K, value: Include[K]) {
  form[key] = value
  // once the feed exists, every change is saved straight away (the link stays the same)
  if (state.value?.enabled) save()
}

async function act(action: 'regenerate' | 'delete') {
  busy.value = true
  msg.value = ''
  try {
    apply(await $fetch<CalendarState>('/api/account/calendar', { method: 'POST', body: { action } }))
    ok.value = true
    msg.value = action === 'regenerate' ? 'New link created; the old one no longer works' : 'Calendar subscription turned off'
    confirming.value = null
    copied.value = false
  } catch (e: any) {
    ok.value = false
    msg.value = e?.data?.statusMessage || 'Something went wrong'
  } finally {
    busy.value = false
  }
}

async function copy() {
  if (!state.value?.feedUrl) return
  try {
    await navigator.clipboard.writeText(state.value.feedUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    const el = document.getElementById('calendarFeedUrl') as HTMLInputElement | null
    el?.select()
  }
}

onMounted(load)
</script>
