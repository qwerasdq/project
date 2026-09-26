<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    options: readonly string[]
    label?: string
  }>(),
  { label: '' },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div>
    <span v-if="label" class="mb-1.5 block text-sm text-ink-secondary">{{ label }}</span>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="icon in options"
        :key="icon"
        type="button"
        class="h-10 w-10 rounded-xl border text-xl transition-colors"
        :class="
          modelValue === icon ? 'border-series-1 bg-series-1/10' : 'border-hairline bg-surface'
        "
        :aria-pressed="modelValue === icon"
        :aria-label="`图标 ${icon}`"
        @click="emit('update:modelValue', icon)"
      >
        {{ icon }}
      </button>
    </div>
  </div>
</template>
