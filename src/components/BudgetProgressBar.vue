<script setup lang="ts">
import { computed } from 'vue'

import { budgetLevel } from '@/lib/stats'
import { BUDGET_LEVEL_STYLE } from '@/lib/status'

const props = withDefaults(
  defineProps<{
    /** 已花比例，>= 1 表示超支 */
    ratio: number
    label?: string
    /** 无障碍名称。label 常是金额，读屏念出来没有指向性，所以单给一个 */
    name?: string
    /** 紧凑模式用于首页提醒列表 */
    compact?: boolean
  }>(),
  {
    label: '',
    name: '',
    compact: false,
  },
)

const level = computed(() => budgetLevel(props.ratio))

/** 状态色恒取自 --status-*，且永远与图标 + 文字同时出现，见 lib/status.ts */
const style = computed(() => BUDGET_LEVEL_STYLE[level.value])

/** 进度条最多铺满 100%，超出部分用状态文案表达 */
const widthPercent = computed(() => `${Math.min(props.ratio, 1) * 100}%`)

const percentText = computed(() => `${Math.round(props.ratio * 100)}%`)

const ariaLabel = computed(() => props.name || props.label || '预算使用进度')
</script>

<template>
  <div>
    <div v-if="!compact" class="mb-1.5 flex items-center justify-between gap-2 text-sm">
      <span class="text-ink-secondary">{{ label }}</span>
      <span class="flex items-center gap-1">
        <span v-if="style.icon" aria-hidden="true">{{ style.icon }}</span>
        <span class="tnum" :class="style.tone">{{ percentText }}</span>
      </span>
    </div>

    <div
      class="w-full overflow-hidden rounded-full"
      :class="compact ? 'h-1.5' : 'h-2'"
      style="background-color: var(--meter-track)"
      role="progressbar"
      :aria-valuenow="Math.round(ratio * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="ariaLabel"
    >
      <div
        class="h-full rounded-full transition-[width] duration-300"
        :style="{ width: widthPercent, backgroundColor: style.fill }"
      />
    </div>

    <p v-if="!compact && style.text" class="mt-1 flex items-center gap-1 text-sm" :class="style.tone">
      <span aria-hidden="true">{{ style.icon }}</span>{{ style.text }}
    </p>
  </div>
</template>
