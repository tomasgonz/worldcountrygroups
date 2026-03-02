<template>
  <div class="relative">
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      type="text"
      :placeholder="placeholder"
      class="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-accent-500 focus:border-transparent outline-none transition-shadow"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
