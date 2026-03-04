<template>
  <div class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-2xl border border-primary-100 p-8">
        <h1 class="font-serif text-2xl font-bold text-primary-900 mb-6 text-center">Log In</h1>

        <form @submit.prevent="handleLogin">
          <div class="mb-4">
            <label for="username" class="block text-sm font-medium text-primary-600 mb-2">Username</label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="Enter username"
            />
          </div>

          <div class="mb-4">
            <label for="password" class="block text-sm font-medium text-primary-600 mb-2">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="Enter password"
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

        <p class="mt-6 text-center text-sm text-primary-400">
          Don't have an account?
          <NuxtLink to="/register" class="text-primary-700 hover:text-primary-900 font-medium">Register</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Log In — World Country Groups' })

const route = useRoute()
const { login: doLogin } = useAuth()

const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  errorMsg.value = ''
  loading.value = true

  try {
    const result = await doLogin(username.value, password.value)
    const { state } = useAuth()

    if (state.value.role === 'admin') {
      await navigateTo('/admin')
    } else if (state.value.status === 'pending') {
      await navigateTo('/pending')
    } else {
      const redirect = route.query.redirect as string
      await navigateTo(redirect || '/groups')
    }
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || 'Invalid credentials'
  } finally {
    loading.value = false
  }
}
</script>
