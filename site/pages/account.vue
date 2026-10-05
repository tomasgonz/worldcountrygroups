<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <h1 class="font-serif text-3xl font-bold text-primary-900 mb-8">Account</h1>

    <!-- Profile Card -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-6">Profile</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label class="block text-xs font-medium text-primary-400 uppercase tracking-wider mb-1">Username</label>
          <div class="text-sm text-primary-700">{{ profile?.username }}</div>
        </div>
        <div>
          <label class="block text-xs font-medium text-primary-400 uppercase tracking-wider mb-1">Role</label>
          <span :class="profile?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-primary-100 text-primary-600'" class="text-xs font-medium px-2 py-0.5 rounded-full">
            {{ profile?.role }}
          </span>
        </div>
        <div>
          <label class="block text-xs font-medium text-primary-400 uppercase tracking-wider mb-1">Status</label>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">{{ profile?.status }}</span>
        </div>
        <div>
          <label class="block text-xs font-medium text-primary-400 uppercase tracking-wider mb-1">Member since</label>
          <div class="text-sm text-primary-700">{{ formatDate(profile?.createdAt) }}</div>
        </div>
      </div>

      <div class="border-t border-primary-100 pt-6 space-y-4">
        <div>
          <label for="displayName" class="block text-sm font-medium text-primary-700 mb-1">Display Name</label>
          <input
            id="displayName"
            v-model="form.displayName"
            type="text"
            maxlength="50"
            class="w-full sm:w-80 px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label for="email" class="block text-sm font-medium text-primary-700 mb-1">Email</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            class="w-full sm:w-80 px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="saveProfile"
            :disabled="saving"
            class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
          <span v-if="profileMsg" class="text-sm" :class="profileOk ? 'text-green-600' : 'text-red-600'">{{ profileMsg }}</span>
        </div>
      </div>
    </div>

    <!-- Watchlist Email Digest -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mb-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-2">Watchlist Email Digest</h2>
      <p class="text-sm text-primary-500 mb-5">
        Get an email about the countries you follow: General Debate speeches, votes where they broke with their blocs,
        drops in democracy scores, and new statements and news.
      </p>
      <div v-if="digest">
        <div class="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label="Digest frequency">
          <button v-for="opt in digestOptions" :key="opt.value" type="button" role="radio" :aria-checked="digest.frequency === opt.value"
            class="text-sm px-4 py-1.5 rounded-full border transition-colors"
            :class="digest.frequency === opt.value ? 'bg-primary-900 text-white border-primary-900' : 'bg-white text-primary-600 border-primary-200 hover:border-primary-400'"
            @click="setDigest(opt.value)">{{ opt.label }}</button>
        </div>
        <p class="text-sm text-primary-600 mb-1">
          <template v-if="digest.countries?.length">Following {{ digest.countries.length }} {{ digest.countries.length === 1 ? 'country' : 'countries' }}.</template>
          <template v-else>You don't follow any countries yet. Bookmark countries from their pages to add them.</template>
          <NuxtLink to="/dashboard" class="text-accent-600 hover:text-accent-700 underline ml-1">Manage watchlist</NuxtLink>
        </p>
        <p v-if="!digest.email" class="text-sm text-amber-700 mb-1">Add an email address in your profile above to receive digests.</p>
        <p v-else class="text-xs text-primary-400 mb-1">Sent to {{ digest.email }}<span v-if="digest.lastSent"> &middot; last sent {{ new Date(digest.lastSent).toLocaleString() }}</span></p>
        <p v-if="digest.lastError" class="text-xs text-red-600 mb-1">Last delivery failed: {{ digest.lastError }}</p>
        <p class="text-xs text-primary-400 mb-4">Delivery only works for addresses this server is allowed to email. If a test fails, email this site's address with the subject <code>subscribe</code>, or ask the administrator.</p>
        <div class="flex items-center gap-3">
          <button type="button" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            :disabled="testing || !digest.email || !digest.countries?.length" @click="sendTest">
            {{ testing ? 'Sending…' : 'Send me a digest now' }}
          </button>
          <span v-if="digestMsg" class="text-sm" :class="digestOk ? 'text-green-600' : 'text-red-600'">{{ digestMsg }}</span>
        </div>
      </div>
      <div v-else class="skeleton h-20 rounded-xl" />
    </div>

    <!-- Change Password Card -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-6">Change Password</h2>
      <div class="space-y-4 max-w-sm">
        <div>
          <label for="currentPassword" class="block text-sm font-medium text-primary-700 mb-1">Current Password</label>
          <input
            id="currentPassword"
            v-model="pw.current"
            type="password"
            class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label for="newPassword" class="block text-sm font-medium text-primary-700 mb-1">New Password</label>
          <input
            id="newPassword"
            v-model="pw.newPw"
            type="password"
            class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label for="confirmPassword" class="block text-sm font-medium text-primary-700 mb-1">Confirm New Password</label>
          <input
            id="confirmPassword"
            v-model="pw.confirm"
            type="password"
            class="w-full px-3 py-2 border border-primary-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="changePassword"
            :disabled="changingPw"
            class="bg-primary-900 text-white py-2 px-5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {{ changingPw ? 'Changing...' : 'Change Password' }}
          </button>
          <span v-if="pwMsg" class="text-sm" :class="pwOk ? 'text-green-600' : 'text-red-600'">{{ pwMsg }}</span>
        </div>
      </div>
    </div>

    <!-- Your data -->
    <div class="bg-white rounded-2xl border border-primary-100 p-6 sm:p-8 mt-8">
      <h2 class="font-serif text-xl font-bold text-primary-900 mb-2">Your data and privacy</h2>
      <p class="text-sm text-primary-500 mb-4">Download a copy of everything we hold about your account, or delete your account. See the <NuxtLink to="/privacy" class="underline">privacy policy</NuxtLink>.</p>
      <div class="flex flex-wrap gap-3">
        <a href="/api/account/export" class="text-sm px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50">Download my data</a>
        <button v-if="!deleting" class="text-sm px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50" @click="deleting = true">Delete my account…</button>
      </div>
      <form v-if="deleting" class="mt-4 rounded-xl ring-1 ring-red-200 bg-red-50/50 p-4 space-y-3" @submit.prevent="deleteAccount">
        <p class="text-sm text-red-800">This permanently deletes your account, your saved questions and your digest settings. It can't be undone; copies in our encrypted backups expire within twelve months.</p>
        <label class="block text-xs text-primary-600">Enter your password to confirm
          <input v-model="delPw" type="password" autocomplete="current-password" class="mt-1 w-full max-w-xs border border-primary-200 rounded-lg px-3 py-1.5 text-sm" required>
        </label>
        <div class="flex gap-2">
          <button class="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" :disabled="!delPw">Delete my account permanently</button>
          <button type="button" class="text-sm px-4 py-2 rounded-lg bg-primary-100 text-primary-600" @click="deleting = false; delPw = ''">Cancel</button>
        </div>
        <p v-if="delMsg" class="text-sm text-red-700">{{ delMsg }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Account — World Country Groups' })

const auth = useAuth()

const profile = ref<any>(null)
const form = reactive({ displayName: '', email: '' })
const saving = ref(false)
const profileMsg = ref('')
const profileOk = ref(false)

const pw = reactive({ current: '', newPw: '', confirm: '' })
const changingPw = ref(false)
const pwMsg = ref('')
const pwOk = ref(false)

const deleting = ref(false)
const delPw = ref('')
const delMsg = ref('')
async function deleteAccount() {
  delMsg.value = ''
  try {
    await $fetch('/api/account/delete', { method: 'POST', body: { password: delPw.value } })
    auth.state.value = { ...auth.state.value, authenticated: false, userId: null, username: null, displayName: null, role: null, status: null }
    await navigateTo('/')
  } catch (e: any) {
    delMsg.value = e?.data?.statusMessage || 'Could not delete the account'
  }
}

const digest = ref<any>(null)
const testing = ref(false)
const digestMsg = ref('')
const digestOk = ref(false)
const digestOptions = [
  { value: 'off', label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

async function loadDigest() {
  try {
    digest.value = await $fetch<any>('/api/account/digest')
  } catch {}
}

async function setDigest(frequency: string) {
  digestMsg.value = ''
  try {
    await $fetch('/api/account/digest', { method: 'PUT', body: { frequency } })
    digest.value.frequency = frequency
    digestOk.value = true
    digestMsg.value = frequency === 'off' ? 'Digest turned off' : `You'll get a ${frequency} digest`
  } catch (e: any) {
    digestOk.value = false
    digestMsg.value = e?.data?.statusMessage || 'Could not save'
  }
}

async function sendTest() {
  testing.value = true
  digestMsg.value = ''
  try {
    const r = await $fetch<any>('/api/account/digest/test', { method: 'POST' })
    digestOk.value = r.ok || r.status === 'nothing new'
    digestMsg.value = r.ok ? 'Digest sent' : r.status === 'nothing new' ? 'Nothing new to report yet' : (r.error || 'Delivery failed')
    digest.value = { ...digest.value, lastSent: r.lastSent, lastError: r.lastError }
  } catch (e: any) {
    digestOk.value = false
    digestMsg.value = e?.data?.statusMessage || 'Delivery failed'
  } finally {
    testing.value = false
  }
}

async function loadProfile() {
  try {
    profile.value = await $fetch<any>('/api/account')
    form.displayName = profile.value.displayName || ''
    form.email = profile.value.email || ''
  } catch {
    // handled by middleware
  }
}

async function saveProfile() {
  saving.value = true
  profileMsg.value = ''
  try {
    const updated = await $fetch<any>('/api/account', {
      method: 'PUT',
      body: { displayName: form.displayName, email: form.email },
    })
    profile.value = updated
    profileOk.value = true
    profileMsg.value = 'Profile updated'
    await auth.fetchStatus()
  } catch (e: any) {
    profileOk.value = false
    profileMsg.value = e?.data?.statusMessage || 'Failed to update profile'
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  pwMsg.value = ''
  if (pw.newPw !== pw.confirm) {
    pwOk.value = false
    pwMsg.value = 'Passwords do not match'
    return
  }
  if (pw.newPw.length < 6) {
    pwOk.value = false
    pwMsg.value = 'Password must be at least 6 characters'
    return
  }
  changingPw.value = true
  try {
    await $fetch('/api/account/password', {
      method: 'POST',
      body: { currentPassword: pw.current, newPassword: pw.newPw },
    })
    pwOk.value = true
    pwMsg.value = 'Password changed successfully'
    pw.current = ''
    pw.newPw = ''
    pw.confirm = ''
  } catch (e: any) {
    pwOk.value = false
    pwMsg.value = e?.data?.statusMessage || 'Failed to change password'
  } finally {
    changingPw.value = false
  }
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

onMounted(() => {
  loadProfile()
  loadDigest()
})
</script>
