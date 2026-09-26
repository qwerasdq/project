/**
 * 账单列表的筛选与分组。UI 在 TransactionsView.vue / TransactionList.vue。
 *
 * 筛选在**当月**范围内进行，与 MonthPicker 共享 useMonth 的月份。
 * 列表**包含转账**（用户可以核对），但顶部的收支合计**排除转账**，与统计口径一致。
 */

import { computed, ref, watch } from 'vue'

import type { MonthTotals } from '@/lib/stats'
import type { Transaction, TransactionType } from '@/types'
import { useMonth } from '@/composables/useMonth'
import { relativeDateLabel, toMonth } from '@/lib/date'
import { monthTotals } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

export type TypeFilter = 'all' | TransactionType

export interface DayGroup extends MonthTotals {
  date: string
  label: string
  txs: Transaction[]
}

export function useTransactionFilters() {
  const store = useDbStore()
  const { month } = useMonth()

  const type = ref<TypeFilter>('all')
  const categoryId = ref('')

  /** 当月全部账目，按日期倒序（同日按录入时间倒序） */
  const monthTransactions = computed(() =>
    store.db.transactions
      .filter((t) => toMonth(t.occurredAt) === month.value)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt)),
  )

  /** 分类下拉项：首项「全部分类」，其余跟随收支方向收敛，避免出现「选了支出分类却在看收入」 */
  const categoryOptions = computed(() => {
    const list = type.value === 'all' ? store.categories : store.categoriesByType[type.value]
    return [
      { value: '', label: '全部分类' },
      ...list.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })),
    ]
  })

  // 方向变了，原先选的分类可能不再可选，清掉以免筛出空结果
  watch(type, () => {
    categoryId.value = ''
  })

  const filtered = computed(() =>
    monthTransactions.value.filter((tx) => {
      if (type.value !== 'all' && tx.type !== type.value) return false
      if (categoryId.value && tx.categoryId !== categoryId.value) return false
      return true
    }),
  )

  /** 合计：折算主币种，排除转账 */
  const totals = computed(() => monthTotals(filtered.value, month.value, store.statsCtx))

  /** 按日分组，便于列表加日期小标题 */
  const groups = computed<DayGroup[]>(() => {
    const byDate = new Map<string, Transaction[]>()
    for (const tx of filtered.value) {
      const list = byDate.get(tx.occurredAt)
      if (list) list.push(tx)
      else byDate.set(tx.occurredAt, [tx])
    }

    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, txs]) => ({
        date,
        label: relativeDateLabel(date),
        txs,
        ...monthTotals(txs, toMonth(date), store.statsCtx),
      }))
  })

  const hasFilter = computed(() => type.value !== 'all' || categoryId.value !== '')
  const isEmpty = computed(() => monthTransactions.value.length === 0)

  function reset(): void {
    type.value = 'all'
    categoryId.value = ''
  }

  return {
    month,
    type,
    categoryId,
    categoryOptions,
    filtered,
    totals,
    groups,
    hasFilter,
    isEmpty,
    reset,
  }
}
