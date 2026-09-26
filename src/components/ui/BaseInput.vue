<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    modelValue: string
    placeholder?: string
    /** 错误信息，非空时输入框描边转为 critical 色 */
    error?: string | null
    hint?: string
    type?: 'text' | 'date' | 'number'
    inputmode?: 'text' | 'decimal' | 'numeric'
    maxlength?: number
    disabled?: boolean
    /** 数字类输入用等宽数字，避免光标跳动 */
    numeric?: boolean
    autofocus?: boolean
  }>(),
  {
    label: '',
    placeholder: '',
    error: null,
    hint: '',
    type: 'text',
    inputmode: 'text',
    maxlength: undefined,
    disabled: false,
    numeric: false,
    autofocus: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
}>()
</script>

<template>
  <label class="block">
    <span v-if="label" class="mb-1.5 block text-sm text-ink-secondary">{{ label }}</span>

    <input
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :inputmode="inputmode"
      :maxlength="maxlength"
      :disabled="disabled"
      :autofocus="autofocus"
      :aria-invalid="error ? true : undefined"
      :class="[
        'w-full rounded-xl border bg-surface px-3.5 text-base text-ink',
        'placeholder:text-ink-muted',
        'focus:outline-none focus:ring-2',
        'disabled:opacity-50',
        numeric ? 'tnum h-12' : 'h-12',
        error
          ? 'border-critical focus:ring-critical/30'
          : 'border-hairline focus:border-series-1 focus:ring-series-1/25',
      ]"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @blur="emit('blur')"
    />

    <span v-if="error" class="mt-1 block text-sm text-critical">{{ error }}</span>
    <span v-else-if="hint" class="mt-1 block text-sm text-ink-muted">{{ hint }}</span>
  </label>
</template>
