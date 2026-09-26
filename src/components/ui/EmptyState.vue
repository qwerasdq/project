<script setup lang="ts">
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
  }>(),
  {
    icon: '📭',
    description: '',
  },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
    <span class="text-4xl" aria-hidden="true">{{ icon }}</span>
    <p class="mt-3 text-[15px] font-medium text-ink">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-xs text-sm text-ink-muted">{{ description }}</p>
    <div class="mt-4">
      <slot />
    </div>
  </div>
</template>
