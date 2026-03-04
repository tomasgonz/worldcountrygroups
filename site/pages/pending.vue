<template>
  <div class="min-h-[60vh] flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="bg-white rounded-2xl border border-primary-100 p-8 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <svg class="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 class="font-serif text-2xl font-bold text-primary-900 mb-3">Account Pending</h1>
        <p class="text-sm text-primary-500 mb-6">
          Your account is awaiting admin approval. You'll be able to access the site once an administrator has reviewed and approved your registration.
        </p>
        <button
          @click="handleLogout"
          class="text-sm text-primary-400 hover:text-primary-900 transition-colors"
        >
          Log out
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Pending Approval — World Country Groups' })

const { logout } = useAuth()

async function handleLogout() {
  await logout()
  await navigateTo('/login')
}
</script>
