<script setup lang="ts">
/**
 * 分类支出占比：横向 100% 堆叠条。
 *
 * 不用饼图 —— 占比条能同时给出「谁占多少」和「总共多少」，且不依赖角度目测。
 * 用 HTML/Tailwind 手写而非图表库：段数最多 8、只有一条轴，画布带来的
 * 定位与无障碍成本远大于收益（预算 meter 同理）。
 *
 * 两条规范落实在这里：
 * 1. 段与段之间是 **2px 的表面色空隙**（gap），不是描边 —— 描边是多余的数据墨水。
 * 2. 百分比标注浮在色块**上方**，不塞进色块里：色块高度只有 12px，塞进去要么裁切，
 *    要么得按填充色亮度选文字色；段太窄时直接不标，值由下方明细表兜住。
 */

import { computed, ref } from 'vue'

import type { ShareItem } from './types'
import { MAIN_CURRENCY, formatMoney } from '@/lib/money'

const props = defineProps<{
  items: ShareItem[]
  /** 期间说明，如「2026年9月」，用于无障碍名称 */
  label: string
}>()

const activeKey = ref<string | null>(null)

const active = computed(() => props.items.find((item) => item.key === activeKey.value) ?? null)

const total = computed(() => props.items.reduce((sum, item) => sum + item.amount, 0))

function money(cents: number): string {
  return formatMoney(cents, MAIN_CURRENCY)
}

function percentText(percent: number): string {
  return `${Math.round(percent * 100)}%`
}

/** 读屏没有「悬停」这回事，把每段的名称与占比一次性说清 */
const ariaLabel = computed(
  () =>
    `${props.label}支出构成：` +
    props.items.map((item) => `${item.name} ${percentText(item.percent)}`).join('，'),
)
</script>

<template>
  <div>
    <!-- pt-4 是给上方标注留的位置，标注因此永远不会被裁切 -->
    <div class="pt-4">
      <div
        class="flex h-3 gap-[2px]"
        role="img"
        :aria-label="ariaLabel"
        @mouseleave="activeKey = null"
      >
        <div
          v-for="item in items"
          :key="item.key"
          class="relative h-full transition-[filter] duration-150 first:rounded-l-full last:rounded-r-full before:absolute before:-top-1.5 before:right-0 before:-bottom-1.5 before:left-0 before:content-['']"
          :class="activeKey === item.key ? 'brightness-110' : ''"
          :style="{ flexGrow: item.percent, flexBasis: 0, backgroundColor: item.color }"
          @mouseenter="activeKey = item.key"
          @click="activeKey = activeKey === item.key ? null : item.key"
        >
          <span
            v-if="item.showPercent"
            class="tnum pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap text-ink-muted"
          >
            {{ percentText(item.percent) }}
          </span>
        </div>
      </div>
    </div>

    <p class="tnum mt-2 text-xs text-ink-secondary">
      <template v-if="active">
        <!-- 图例键随标记形状：色块是方的，图例键也用方角，不用圆点 -->
        <span
          class="mr-1 inline-block h-2 w-2 rounded-[2px] align-middle"
          :style="{ backgroundColor: active.color }"
          aria-hidden="true"
        />
        {{ active.name }} · {{ money(active.amount) }} · {{ percentText(active.percent) }}
      </template>
      <template v-else>合计 {{ money(total) }}</template>
    </p>

    <!-- 明细表同时承担图例与「数据表视图」：颜色从来不是身份的唯一线索 -->
    <table class="tnum mt-2 w-full text-xs">
      <thead>
        <tr class="text-ink-muted">
          <th class="py-1 text-left font-normal">分类</th>
          <th class="py-1 text-right font-normal">金额</th>
          <th class="py-1 text-right font-normal">占比</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.key"
          class="border-t border-hairline"
          @mouseenter="activeKey = item.key"
          @mouseleave="activeKey = null"
        >
          <td class="py-1 text-left text-ink">
            <span
              class="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
              :style="{ backgroundColor: item.color }"
              aria-hidden="true"
            />
            <span aria-hidden="true">{{ item.icon }}</span>
            {{ item.name }}
          </td>
          <td class="py-1 text-right text-ink">{{ money(item.amount) }}</td>
          <td class="py-1 text-right text-ink-secondary">{{ percentText(item.percent) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
