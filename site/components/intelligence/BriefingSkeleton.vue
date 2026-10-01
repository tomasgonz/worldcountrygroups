<template>
  <div class="space-y-6 animate-pulse">
    <div v-for="i in 3" :key="i" class="bg-white rounded-2xl border border-primary-100 p-6">
      <div class="h-6 bg-primary-100 rounded w-48 mb-4" />
      <div class="space-y-3">
        <div class="h-4 bg-primary-50 rounded w-full" />
        <div class="h-4 bg-primary-50 rounded w-5/6" />
        <div class="h-4 bg-primary-50 rounded w-4/6" />
      </div>
      <div class="grid grid-cols-3 gap-4 mt-4">
        <div class="h-20 bg-primary-50 rounded-xl" />
        <div class="h-20 bg-primary-50 rounded-xl" />
        <div class="h-20 bg-primary-50 rounded-xl" />
      </div>
    </div>
  </div>
</template>
