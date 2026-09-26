/**
 * 当前选中月份。账单、统计、预算三个页面共享同一个值——在一个页面切到 8 月，
 * 切到另一个页面仍是 8 月，符合「我在看同一段时间」的直觉。
 */

import { computed, ref } from 'vue'

import { currentMonth, monthLabel, shiftMonth } from '@/lib/date'

const month = ref(currentMonth())

export function useMonth() {
  const label = computed(() => monthLabel(month.value))
  const isCurrent = computed(() => month.value === currentMonth())
  /** 不允许翻到未来的月份——没有数据可看 */
  const canGoNext = computed(() => month.value < currentMonth())

  return {
    month,
    label,
    isCurrent,
    canGoNext,
    prev: () => {
      month.value = shiftMonth(month.value, -1)
    },
    next: () => {
      if (canGoNext.value) month.value = shiftMonth(month.value, 1)
    },
    goTo: (value: string) => {
      month.value = value
    },
    reset: () => {
      month.value = currentMonth()
    },
  }
}
