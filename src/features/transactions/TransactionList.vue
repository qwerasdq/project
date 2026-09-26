<script setup lang="ts">
import type { DayGroup } from './useTransactionFilters'
import TransactionListItem from './TransactionListItem.vue'
import { useCurrency } from '@/composables/useCurrency'

defineProps<{ groups: DayGroup[] }>()

const { formatMain } = useCurrency()
</script>

<template>
  <div class="space-y-4">
    <section v-for="group in groups" :key="group.date">
      <div class="flex items-baseline justify-between px-1 pb-1.5">
        <h2 class="text-xs font-medium text-ink-secondary">{{ group.label }}</h2>
        <p class="tnum flex gap-2 text-xs text-ink-muted">
          <span v-if="group.expense > 0">支出 {{ formatMain(group.expense) }}</span>
          <span v-if="group.income > 0">收入 {{ formatMain(group.income) }}</span>
        </p>
      </div>

      <div class="overflow-hidden rounded-2xl border border-hairline bg-surface">
        <TransactionListItem
          v-for="tx in group.txs"
          :key="tx.id"
          :transaction="tx"
          class="border-b border-hairline last:border-b-0"
        />
      </div>
    </section>
  </div>
</template>
