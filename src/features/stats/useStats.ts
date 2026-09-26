/**
 * 统计页的数据装配：浏览月份 + 区间（近 6 / 12 个月）→ 趋势点与占比段。
 *
 * 口径全部在这里收敛：转账不计收支、外币按汇率折算到主币种，
 * 都由 lib/stats 的纯函数完成，视图与图表只负责画，不各算一套。
 */

import type { Ref } from 'vue'
import { computed, ref } from 'vue'

import type { ShareItem, TrendPoint } from '@/components/charts/types'
import { useMonth } from '@/composables/useMonth'
import { lastNMonths, monthLabel, monthShortLabel } from '@/lib/date'
import type { CategorySlice } from '@/lib/stats'
import { categoryBreakdown, summarizeByMonth, totalsOf } from '@/lib/stats'
import { SERIES_OTHER_VAR, assignSeriesSlots, inlinePercentFits, seriesColorVar } from '@/lib/viz'
import { useDbStore } from '@/stores/db'

export type { ShareItem, TrendPoint }

export type TrendRange = 6 | 12

export const TREND_RANGES: readonly TrendRange[] = [6, 12]

export interface UseStats {
  month: Ref<string>
  range: Ref<TrendRange>
  trend: Ref<TrendPoint[]>
  /** '2026年4月 – 2026年9月' */
  rangeLabel: Ref<string>
  hasTrendData: Ref<boolean>
  share: Ref<ShareItem[]>
}

export function useStats(): UseStats {
  const store = useDbStore()
  const { month } = useMonth()
  const range = ref<TrendRange>(6)

  /** 趋势以浏览月份为终点往前看，和账单页停在同一段时间上 */
  const months = computed(() => lastNMonths(range.value, month.value))
  const summary = computed(() =>
    summarizeByMonth(store.db.transactions, months.value, store.statsCtx),
  )

  const trend = computed<TrendPoint[]>(() =>
    months.value.map((m) => {
      const totals = totalsOf(summary.value, m)
      return { month: m, label: monthLabel(m), short: monthShortLabel(m), ...totals }
    }),
  )

  const rangeLabel = computed(() => {
    const first = trend.value[0]
    const last = trend.value[trend.value.length - 1]
    return first && last ? `${first.label} – ${last.label}` : ''
  })

  const hasTrendData = computed(() => trend.value.some((p) => p.income > 0 || p.expense > 0))

  /** top7 + 折叠段，最多 8 段；各段之和恒等于本月支出（转账已排除） */
  const slices = computed<CategorySlice[]>(() =>
    categoryBreakdown(store.db.transactions, month.value, 'expense', store.statsCtx, 7),
  )

  /**
   * 槽位按**分类实体**分配（用分类的稳定顺序），不按当月金额排名 ——
   * 否则换个月份各段的颜色会整体重排，读者刚记住的颜色就失效了。
   */
  const share = computed<ShareItem[]>(() => {
    const expenseCategories = store.categoriesByType.expense
    const slots = assignSeriesSlots(
      slices.value.flatMap((s) => (s.categoryId ? [s.categoryId] : [])),
      expenseCategories.map((c) => c.id),
    )
    const byId = new Map(expenseCategories.map((c) => [c.id, c]))

    return slices.value.map((slice) => {
      const category = slice.categoryId ? byId.get(slice.categoryId) : undefined
      const slot = slice.categoryId ? slots.get(slice.categoryId) : undefined
      return {
        key: slice.categoryId ?? 'other',
        name: foldName(slice, category?.name),
        icon: category?.icon ?? '🗂️',
        amount: slice.amount,
        percent: slice.percent,
        // 折叠段拿中性色 --series-other，不占槽位，因此 8 段也不会出现同色
        color: slot === undefined ? SERIES_OTHER_VAR : seriesColorVar(slot),
        showPercent: inlinePercentFits(slice.percent),
      }
    })
  })

  return { month, range, trend, rangeLabel, hasTrendData, share }
}

/**
 * 折叠段的名字必须说清折叠了什么：种子数据里本来就有一个叫「其他」的分类，
 * 折叠段再叫「其他」就分不清了。
 */
function foldName(slice: CategorySlice, categoryName: string | undefined): string {
  if (categoryName) return categoryName
  if (slice.count > 0) return `其余 ${slice.count} 类`
  return '未分类'
}
