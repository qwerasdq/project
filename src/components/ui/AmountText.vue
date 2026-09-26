<script setup lang="ts">
import { computed } from 'vue'

import type { CurrencyCode } from '@/types'
import { MAIN_CURRENCY, formatMoney } from '@/lib/money'

const props = withDefaults(
  defineProps<{
    /** 金额，整数分 */
    cents: number
    currency: CurrencyCode
    type?: 'income' | 'expense' | 'neutral'
    size?: 'sm' | 'md' | 'lg' | 'xl'
    /** 显示正负号，收支列表用 */
    signed?: boolean
    /** 外币金额额外标出币种代码，避免「¥」符号看起来像人民币 */
    labelForeign?: boolean
  }>(),
  {
    type: 'neutral',
    size: 'md',
    signed: false,
    labelForeign: true,
  },
)

const SIZE_CLASS = {
  sm: 'text-sm',
  md: 'text-[15px]',
  lg: 'text-lg font-semibold',
  xl: 'text-3xl font-semibold',
} as const

const TYPE_CLASS = {
  income: 'text-delta-up',
  expense: 'text-delta-down',
  neutral: 'text-ink',
} as const

const text = computed(() => {
  const sign = props.signed && props.type === 'income' ? '+' : props.signed ? '-' : ''
  return `${sign}${formatMoney(Math.abs(props.cents), props.currency)}`
})

const classes = computed(() => ['tnum', SIZE_CLASS[props.size], TYPE_CLASS[props.type]])

/** Intl 对多数币种也用「$」符号，标出代码才不会与人民币混淆 */
const showCode = computed(() => props.labelForeign && props.currency !== MAIN_CURRENCY)
</script>

<template>
  <span :class="classes">
    {{ text }}<span v-if="showCode" class="ml-1 text-xs text-ink-muted">{{ currency }}</span>
  </span>
</template>
