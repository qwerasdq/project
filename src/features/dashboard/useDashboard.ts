/**
 * 首页数据。固定看**当前自然月**，不跟随 useMonth 的浏览月份。
 */

import { computed } from 'vue'

import { currentMonth, shiftMonth } from '@/lib/date'
import { monthTotals } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

export function useDashboard(recentLimit = 5) {
  const store = useDbStore()

  const month = currentMonth()
  const prevMonth = shiftMonth(month, -1)

  const totals = computed(() => monthTotals(store.db.transactions, month, store.statsCtx))
  const prevTotals = computed(() => monthTotals(store.db.transactions, prevMonth, store.statsCtx))

  /** 支出较上月的环比；上月为 0 时无从比较，返回 null */
  const expenseDelta = computed(() => {
    const before = prevTotals.value.expense
    if (before === 0) return null
    return (totals.value.expense - before) / before
  })

  /** 最近若干笔，按发生日期倒序，同日按记录时间倒序 */
  const recent = computed(() =>
    [...store.db.transactions]
      .sort(
        (a, b) =>
          b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, recentLimit),
  )

  const hasAnyTransaction = computed(() => store.db.transactions.length > 0)

  const budgetCount = computed(
    () => store.db.budgets.filter((b) => b.month === month).length,
  )

  return { month, totals, prevTotals, expenseDelta, recent, hasAnyTransaction, budgetCount }
}
