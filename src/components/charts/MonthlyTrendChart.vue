<script setup lang="ts">
/**
 * 月度收支趋势：分组柱状图。
 *
 * 支出与收入同量纲（都是主币种金额），共用一个 y 轴 —— **绝不拆成对偶轴**。
 * 结余是两者的差，只在数据表里出现，不画成第三根柱子（那又会引入第二个量纲）。
 * 浅色模式下收入绿对表面色的对比度略低于 3:1，因此这里必然配一张数据表兜底。
 */

import { computed } from 'vue'
import type { EChartsOption } from 'echarts'

import type { TrendPoint } from './types'
import { useChartTheme } from '@/composables/useChartTheme'
import { VChart } from '@/lib/echarts'
import { MAIN_CURRENCY, formatCompactYuan, formatMoney } from '@/lib/money'

const props = defineProps<{ points: TrendPoint[] }>()

const theme = useChartTheme()

/** 两个系列都是「度量」，用语义色：橙=支出、绿=收入，与涨跌文字色同源 */
const SERIES = [
  { key: 'expense', name: '支出', token: 'expense' },
  { key: 'income', name: '收入', token: 'income' },
] as const

function money(cents: number): string {
  return formatMoney(cents, MAIN_CURRENCY)
}

/** 悬浮读数：值在前、名在后，读者已经知道是哪根柱子，要的是数字 */
function tooltipAt(index: number): string {
  const point = props.points[index]
  if (!point) return ''

  const rows = SERIES.map(
    (s) =>
      `<div style="display:flex;align-items:center;gap:6px">
         <span style="width:10px;height:2px;border-radius:1px;background:${theme.value[s.token]}"></span>
         <span style="color:${theme.value.inkSecondary}">${s.name}</span>
         <b style="margin-left:auto;color:${theme.value.ink}">${money(point[s.key])}</b>
       </div>`,
  ).join('')

  return `<div style="min-width:132px">
    <div style="margin-bottom:4px;color:${theme.value.inkMuted}">${point.label}</div>
    ${rows}
  </div>`
}

const option = computed<EChartsOption>(() => ({
  // containLabel 把刻度文字算进容器高度，容器再矮也不会截掉 x 轴那一带
  grid: { top: 30, right: 8, bottom: 0, left: 0, containLabel: true },
  legend: {
    top: 0,
    left: 0,
    itemGap: 16,
    itemWidth: 10,
    itemHeight: 10,
    icon: 'roundRect',
    textStyle: { color: theme.value.inkSecondary, fontSize: 12 },
  },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow', shadowStyle: { color: theme.value.hairline } },
    backgroundColor: theme.value.surface,
    borderColor: theme.value.hairline,
    borderWidth: 1,
    padding: [8, 10],
    formatter: (params) => tooltipAt(Array.isArray(params) ? (params[0]?.dataIndex ?? 0) : params.dataIndex),
  },
  xAxis: {
    type: 'category',
    data: props.points.map((p) => p.short),
    axisLine: { lineStyle: { color: theme.value.hairline } },
    axisTick: { show: false },
    axisLabel: { color: theme.value.inkMuted, fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: theme.value.hairline, type: 'solid' } },
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: theme.value.inkMuted,
      fontSize: 11,
      // ECharts 给的是 string | number，包一层再交给格式化函数
      formatter: (value: string | number) => formatCompactYuan(Number(value)),
    },
  },
  series: SERIES.map((s) => ({
    name: s.name,
    type: 'bar' as const,
    // 柱子最粗 24px，其余留白；相邻柱之间的间隙按柱宽比例给，12 个月时不至于挤成一块
    barMaxWidth: 24,
    barGap: '8%',
    barCategoryGap: '35%',
    itemStyle: { color: theme.value[s.token], borderRadius: [4, 4, 0, 0] },
    data: props.points.map((p) => p[s.key]),
  })),
}))
</script>

<template>
  <div>
    <VChart class="h-52 w-full" :option="option" autoresize />

    <details class="mt-2">
      <summary class="cursor-pointer text-xs text-ink-muted select-none">数据表</summary>
      <table class="tnum mt-2 w-full text-xs">
        <thead>
          <tr class="text-ink-muted">
            <th class="py-1 text-left font-normal">月份</th>
            <th class="py-1 text-right font-normal">支出</th>
            <th class="py-1 text-right font-normal">收入</th>
            <th class="py-1 text-right font-normal">结余</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="point in points" :key="point.month" class="border-t border-hairline">
            <td class="py-1 text-left text-ink-secondary">{{ point.label }}</td>
            <td class="py-1 text-right text-ink">{{ money(point.expense) }}</td>
            <td class="py-1 text-right text-ink">{{ money(point.income) }}</td>
            <td class="py-1 text-right text-ink">{{ money(point.balance) }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>
</template>
