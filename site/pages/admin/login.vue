<template>
  <div class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-2xl border border-primary-100 p-8">
        <h1 class="font-serif text-2xl font-bold text-primary-900 mb-6 text-center">Admin Login</h1>

        <form @submit.prevent="handleLogin">
          <div class="mb-4">
            <label for="password" class="block text-sm font-medium text-primary-600 mb-2">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="Enter admin password"
            />
          </div>

          <div v-if="errorMsg" class="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
            {{ errorMsg }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-primary-900 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
          >
            {{ loading ? 'Logging in...' : 'Log in' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Admin Login — World Country Groups' })

const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true

  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: { password: password.value },
    })
    await navigateTo('/admin')
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || 'Invalid password'
  } finally {
    loading.value = false
  }
}
</script>
