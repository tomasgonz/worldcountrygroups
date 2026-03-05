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
})
</script>
