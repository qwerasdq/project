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
        v-for="color in options"
        :key="color"
        type="button"
        class="h-9 w-9 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow"
        :class="modelValue === color ? 'ring-2 ring-series-1' : 'ring-1 ring-hairline'"
        :style="{ backgroundColor: color }"
        :aria-pressed="modelValue === color"
        :aria-label="`颜色 ${color}`"
        @click="emit('update:modelValue', color)"
      />
    </div>
  </div>
</template>
