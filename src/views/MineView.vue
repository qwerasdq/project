<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import PageShell from '@/components/ui/PageShell.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useDbStore } from '@/stores/db'
import { totalBalanceMain } from '@/lib/stats'

const store = useDbStore()
const { formatMain, missingRateCurrencies } = useCurrency()

const totalBalance = computed(() =>
  totalBalanceMain(store.accounts, store.db.transactions, store.statsCtx),
)

const ENTRIES = [
  { to: '/accounts', icon: '💳', label: '账户管理', hint: '账户、余额与转账' },
  { to: '/categories', icon: '🏷️', label: '分类管理', hint: '增删收支分类' },
  { to: '/budgets', icon: '🎯', label: '预算管理', hint: '设置每月支出上限' },
  { to: '/settings', icon: '⚙️', label: '设置', hint: '汇率与数据' },
] as const
</script>

<template>
  <PageShell title="我的">
    <section class="rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
      <p class="text-sm text-ink-secondary">账户总资产（折合人民币）</p>
      <p class="mt-1 text-3xl font-semibold text-ink">{{ formatMain(totalBalance) }}</p>
      <p class="mt-1 text-sm text-ink-muted">
        共 {{ store.activeAccounts.length }} 个账户<span v-if="store.accounts.length > store.activeAccounts.length"
          >（另有 {{ store.accounts.length - store.activeAccounts.length }} 个已归档）</span
        >
      </p>
    </section>

    <p
      v-if="missingRateCurrencies.length > 0"
      class="mt-3 flex items-start gap-2 rounded-xl bg-surface px-3.5 py-3 text-sm text-ink-secondary ring-1 ring-[var(--ring)]"
    >
      <span aria-hidden="true">⚠️</span>
      <span>
        未设置 {{ missingRateCurrencies.join('、') }} 的汇率，折算暂按 1:1 处理。
        <RouterLink to="/settings" class="text-series-1 underline">去设置</RouterLink>
      </span>
    </p>

    <nav class="mt-4 overflow-hidden rounded-2xl bg-surface ring-1 ring-[var(--ring)]">
      <RouterLink
        v-for="(entry, index) in ENTRIES"
        :key="entry.to"
        :to="entry.to"
        class="flex items-center gap-3 px-4 py-3.5 active:bg-hairline"
        :class="index > 0 ? 'border-t border-hairline' : ''"
      >
        <span class="text-xl" aria-hidden="true">{{ entry.icon }}</span>
        <span class="flex-1">
          <span class="block text-[15px] text-ink">{{ entry.label }}</span>
          <span class="block text-xs text-ink-muted">{{ entry.hint }}</span>
        </span>
        <span class="text-ink-muted" aria-hidden="true">›</span>
      </RouterLink>
    </nav>
  </PageShell>
</template>
