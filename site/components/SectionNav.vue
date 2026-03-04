<template>
  <!-- Desktop: dot rail on right edge -->
  <nav
    v-if="sections.length > 1"
    class="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 flex-col items-end gap-3"
  >
    <button
      v-for="s in sections"
      :key="s.id"
      class="group flex items-center gap-2"
      @click="$emit('navigate', s.id)"
    >
      <!-- Label (visible on hover or when active) -->
      <span
        class="text-xs font-medium px-2.5 py-1 rounded-lg border shadow-sm whitespace-nowrap transition-all duration-200"
        :class="activeSection === s.id
          ? 'opacity-100 bg-primary-900 text-white border-primary-900'
          : 'opacity-0 group-hover:opacity-100 bg-white text-primary-700 border-primary-200'"
      >{{ s.label }}</span>
      <!-- Dot -->
      <span
        class="block rounded-full transition-all duration-200 flex-shrink-0"
        :class="activeSection === s.id
          ? 'w-2.5 h-2.5 bg-primary-900'
          : 'w-2 h-2 bg-primary-300 group-hover:bg-primary-500'"
      />
    </button>
  </nav>

  <!-- Mobile: FAB + overlay -->
  <div v-if="sections.length > 1" class="lg:hidden">
    <!-- FAB button -->
    <button
      class="fixed right-4 bottom-6 z-40 w-11 h-11 rounded-full bg-primary-900 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95"
      :class="mobileOpen ? 'rotate-45' : ''"
      @click="mobileOpen = !mobileOpen"
    >
      <svg class="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
        <path v-if="!mobileOpen" fill-rule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clip-rule="evenodd" />
        <path v-else fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <!-- Overlay panel -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-4"
    >
      <div
        v-if="mobileOpen"
        class="fixed right-4 bottom-20 z-40 bg-white rounded-2xl border border-primary-200 shadow-xl py-2 w-56 max-h-80 overflow-y-auto"
      >
        <button
          v-for="s in sections"
          :key="s.id"
          class="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
          :class="activeSection === s.id
            ? 'text-primary-900 font-semibold bg-primary-50'
            : 'text-primary-600 hover:bg-primary-50 hover:text-primary-800'"
          @click="$emit('navigate', s.id); mobileOpen = false"
        >
          <span
            class="w-1.5 h-1.5 rounded-full flex-shrink-0"
            :class="activeSection === s.id ? 'bg-primary-900' : 'bg-primary-300'"
          />
          {{ s.label }}
        </button>
      </div>
    </Transition>

    <!-- Backdrop -->
    <Transition
      enter-active-class="transition duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mobileOpen"
        class="fixed inset-0 z-30"
        @click="mobileOpen = false"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { SectionDef } from '~/composables/useSectionNav'

defineProps<{
  sections: SectionDef[]
  activeSection: string
}>()

defineEmits<{
  navigate: [id: string]
}>()

const mobileOpen = ref(false)
</script>
