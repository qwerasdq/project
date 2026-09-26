<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit'
    disabled?: boolean
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    block: false,
  },
)

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-series-1 text-white active:opacity-80',
  secondary: 'bg-hairline text-ink active:opacity-80',
  ghost: 'bg-transparent text-ink-secondary active:bg-hairline',
  danger: 'bg-critical text-white active:opacity-80',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-13 px-6 text-base',
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium',
  'transition-opacity select-none',
  'disabled:cursor-not-allowed disabled:opacity-40',
  VARIANT_CLASS[props.variant],
  SIZE_CLASS[props.size],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled">
    <slot />
  </button>
</template>
