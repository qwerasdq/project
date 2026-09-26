<script setup lang="ts">
export interface SelectOption {
  value: string
  label: string
}

withDefaults(
  defineProps<{
    label?: string
    modelValue: string
    options: readonly SelectOption[]
    placeholder?: string
    error?: string | null
    disabled?: boolean
  }>(),
  {
    label: '',
    placeholder: '请选择',
    error: null,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-sm text-ink-secondary">{{ label }}</span>

    <select
      :value="modelValue"
      :disabled="disabled"
      :class="[
        'h-12 w-full appearance-none rounded-xl border bg-surface px-3.5 text-base text-ink',
        'bg-[length:12px] bg-[right_14px_center] bg-no-repeat',
        'focus:outline-none focus:ring-2',
        'disabled:opacity-50',
        error
          ? 'border-critical focus:ring-critical/30'
          : 'border-hairline focus:border-series-1 focus:ring-series-1/25',
      ]"
      style="
        background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23898781' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E&quot;);
      "
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>

    <span v-if="error" class="mt-1 block text-sm text-critical">{{ error }}</span>
  </label>
</template>
