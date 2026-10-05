<template>
  <!-- Wikimedia Commons portrait when available, otherwise initials -->
  <img v-if="(image || imageUrl) && !failed" :src="src" :alt="`Portrait of ${name}`" :class="[size, 'rounded-xl object-cover object-top bg-primary-100 shrink-0']" loading="lazy" @error="failed = true">
  <div v-else :class="[size, 'rounded-xl bg-primary-100 text-primary-500 flex items-center justify-center font-serif text-xl shrink-0']" aria-hidden="true">{{ initials }}</div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ image?: string | null; imagePath?: string | null; imageUrl?: string | null; name: string; size?: string; width?: number }>(), { size: 'h-16 w-16', width: 250 })
const failed = ref(false)
// Direct thumbnail URL; Wikimedia serves standard widths (250, 500) from cache
const src = computed(() => {
  if (!props.image && props.imageUrl) return relayImage(props.imageUrl) // official (non-Commons) photo
  if (props.imagePath) {
    const file = props.imagePath.split('/').pop() || ''
    const ext = /\.(svg|tif|tiff)$/i.test(file) ? '.png' : ''
    return relayImage(`https://upload.wikimedia.org/wikipedia/commons/thumb/${props.imagePath}/${props.width}px-${file}${ext}`)
  }
  return relayImage(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(props.image || '')}?width=${props.width}`)
})
const initials = computed(() => props.name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase())
</script>
