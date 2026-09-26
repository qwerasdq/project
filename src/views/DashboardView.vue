<script setup lang="ts">
import { computed } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageShell from '@/components/ui/PageShell.vue'
import BudgetAlertList from '@/features/dashboard/BudgetAlertList.vue'
import { useDashboard } from '@/features/dashboard/useDashboard'
import TransactionListItem from '@/features/transactions/TransactionListItem.vue'
import { useCurrency } from '@/composables/useCurrency'
import { monthLabel } from '@/lib/date'

const { month, totals, expenseDelta, recent, hasAnyTransaction } = useDashboard()
const { formatMain, missingRateCurrencies } = useCurrency()

/** 环比方向：支出涨了用「坏」色，降了用「好」色 —— 箭头与百分比同时给出，不靠颜色单独表意 */
const deltaTone = computed(() => {
  if (expenseDelta.value === null) return ''
  return expenseDelta.value > 0 ? 'text-delta-down' : 'text-delta-up'
})

const deltaText = computed(() => {
  if (expenseDelta.value === null) return ''
  const arrow = expenseDelta.value > 0 ? '▲' : '▼'
  return `${arrow} 较上月 ${Math.abs(expenseDelta.value * 100).toFixed(0)}%`
})
</script>

<template>
  <PageShell title="首页">
    <section class="rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
      <p class="text-sm text-ink-secondary">{{ monthLabel(month) }}结余</p>
      <!-- 大号独立数字用比例字形：tabular 会让「121」这类数字在大字号下显得松散 -->
      <p
        class="mt-1 text-3xl font-semibold"
        :class="totals.balance < 0 ? 'text-delta-down' : 'text-ink'"
      >
        {{ formatMain(totals.balance) }}
      </p>

      <div class="mt-3 grid grid-cols-2 gap-2 border-t border-hairline pt-3">
        <div>
          <p class="text-xs text-ink-secondary">支出</p>
          <p class="tnum mt-0.5 text-[15px] font-semibold text-ink">
            {{ formatMain(totals.expense) }}
          </p>
          <p v-if="deltaText" class="tnum mt-0.5 text-xs" :class="deltaTone">{{ deltaText }}</p>
        </div>
        <div>
          <p class="text-xs text-ink-secondary">收入</p>
          <p class="tnum mt-0.5 text-[15px] font-semibold text-ink">
            {{ formatMain(totals.income) }}
          </p>
        </div>
      </div>
    </section>

    <p
      v-if="missingRateCurrencies.length > 0"
      class="mt-2 flex items-start gap-1.5 px-1 text-xs text-ink-muted"
    >
      <span aria-hidden="true">⚠️</span>
      <span>
        未设置 {{ missingRateCurrencies.join('、') }} 汇率，以上金额按 1:1 折算。
        <RouterLink to="/settings" class="text-series-1 underline">去设置</RouterLink>
      </span>
    </p>

    <BudgetAlertList />

    <template v-if="hasAnyTransaction">
      <div class="mt-5 mb-1.5 flex items-baseline justify-between px-1">
        <h2 class="text-xs font-medium text-ink-secondary">最近记录</h2>
        <RouterLink to="/transactions" class="text-xs text-series-1">全部账单</RouterLink>
      </div>

      <div class="overflow-hidden rounded-2xl border border-hairline bg-surface">
        <TransactionListItem
          v-for="tx in recent"
          :key="tx.id"
          :transaction="tx"
          class="border-b border-hairline last:border-b-0"
        />
      </div>
    </template>

    <EmptyState
      v-else
      icon="🧾"
      title="还没有记账"
      description="记下第一笔，开始看清钱花在哪里"
    >
      <RouterLink to="/transactions/new">
        <BaseButton size="sm">记一笔</BaseButton>
      </RouterLink>
    </EmptyState>
  </PageShell>
</template>
