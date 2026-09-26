<script setup lang="ts">
import { computed } from 'vue'

import BudgetProgressBar from '@/components/BudgetProgressBar.vue'
import { useCurrency } from '@/composables/useCurrency'
import { currentMonth } from '@/lib/date'
import { budgetLevel, budgetRows } from '@/lib/stats'
import { BUDGET_LEVEL_STYLE } from '@/lib/status'
import { useDbStore } from '@/stores/db'

const store = useDbStore()
const { formatMain } = useCurrency()

/**
 * 首页固定看**当前月**，不跟随 useMonth 的浏览月份 —— 用户把账单页翻到七月，
 * 回到首页不该看到七月的提醒。
 */
const alerts = computed(() =>
  budgetRows(
    store.db.transactions,
    store.db.budgets,
    currentMonth(),
    store.categories,
    store.statsCtx,
  )
    .map((row) => {
      const level = budgetLevel(row.progress.ratio)
      return { ...row, level, style: BUDGET_LEVEL_STYLE[level], percent: Math.round(row.progress.ratio * 100) }
    })
    .filter((row) => row.level !== 'normal'),
)
</script>

<template>
  <!-- 自带 mt-5：这是首页专属区块，无提醒时整体不渲染，不留空档 -->
  <section v-if="alerts.length > 0" class="mt-5">
    <div class="mb-1.5 flex items-baseline justify-between px-1">
      <h2 class="text-xs font-medium text-ink-secondary">预算提醒</h2>
      <RouterLink to="/budgets" class="text-xs text-series-1">管理</RouterLink>
    </div>

    <div class="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <RouterLink
        v-for="row in alerts"
        :key="row.budget.id"
        to="/budgets"
        class="block border-b border-hairline px-4 py-3 last:border-b-0 active:bg-hairline/50"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="flex items-center gap-1.5 text-[15px] text-ink">
            <span aria-hidden="true">{{ row.category.icon }}</span>
            {{ row.category.name }}
          </span>
          <span class="tnum text-xs text-ink-muted">
            {{ formatMain(row.progress.spent) }} / {{ formatMain(row.progress.limit) }}
          </span>
        </div>

        <!-- 紧凑模式只剩色条，状态必须由这行文字承载，否则颜色成了唯一线索 -->
        <p class="mt-2 flex items-center gap-1 text-xs" :class="row.style.tone">
          <span aria-hidden="true">{{ row.style.icon }}</span>
          {{ row.style.text }}
          <span class="tnum text-ink-muted">（{{ row.percent }}%）</span>
        </p>

        <div class="mt-1.5">
          <BudgetProgressBar compact :ratio="row.progress.ratio" :label="row.category.name" />
        </div>
      </RouterLink>
    </div>
  </section>
</template>
