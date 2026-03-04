<template>
  <div class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-2xl border border-primary-100 p-8">
        <h1 class="font-serif text-2xl font-bold text-primary-900 mb-6 text-center">Register</h1>

        <div v-if="success" class="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3 mb-4">
          <p class="font-medium mb-1">Registration successful!</p>
          <p>Your account is pending admin approval. You'll be able to log in once approved.</p>
          <NuxtLink to="/login" class="inline-block mt-3 text-primary-700 hover:text-primary-900 font-medium">Back to login</NuxtLink>
        </div>

        <form v-else @submit.prevent="handleRegister">
          <div class="mb-4">
            <label for="username" class="block text-sm font-medium text-primary-600 mb-2">Username</label>
            <input
              id="username"
              v-model="form.username"
              type="text"
              autocomplete="username"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="3-30 characters"
            />
          </div>

          <div class="mb-4">
            <label for="displayName" class="block text-sm font-medium text-primary-600 mb-2">Display Name</label>
            <input
              id="displayName"
              v-model="form.displayName"
              type="text"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="Optional"
            />
          </div>

          <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-primary-600 mb-2">Email</label>
            <input
              id="email"
              v-model="form.email"
              type="email"
              autocomplete="email"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="Optional"
            />
          </div>

          <div class="mb-4">
            <label for="password" class="block text-sm font-medium text-primary-600 mb-2">Password</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="At least 8 characters"
            />
          </div>

          <div class="mb-4">
            <label for="confirmPassword" class="block text-sm font-medium text-primary-600 mb-2">Confirm Password</label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              autocomplete="new-password"
              class="w-full px-4 py-2.5 border border-primary-200 rounded-lg text-primary-900 placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent"
              placeholder="Repeat password"
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
            {{ loading ? 'Registering...' : 'Register' }}
          </button>
        </form>

        <p v-if="!success" class="mt-6 text-center text-sm text-primary-400">
          Already have an account?
          <NuxtLink to="/login" class="text-primary-700 hover:text-primary-900 font-medium">Log in</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Register — World Country Groups' })

const { register } = useAuth()

const form = reactive({
  username: '',
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const loading = ref(false)
const errorMsg = ref('')
const success = ref(false)

async function handleRegister() {
  errorMsg.value = ''

  if (form.password !== form.confirmPassword) {
    errorMsg.value = 'Passwords do not match'
    return
  }

  loading.value = true
  try {
    await register({
      username: form.username,
      password: form.password,
      displayName: form.displayName || undefined,
      email: form.email || undefined,
    })
    success.value = true
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>
