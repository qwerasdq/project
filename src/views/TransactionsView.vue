<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MonthPicker from '@/components/ui/MonthPicker.vue'
import PageShell from '@/components/ui/PageShell.vue'
import TransactionList from '@/features/transactions/TransactionList.vue'
import type { TypeFilter } from '@/features/transactions/useTransactionFilters'
import { useTransactionFilters } from '@/features/transactions/useTransactionFilters'
import { useCurrency } from '@/composables/useCurrency'

const { type, categoryId, categoryOptions, totals, groups, hasFilter, isEmpty, reset } =
  useTransactionFilters()

const { formatMain } = useCurrency()

const TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
]

// BaseSelect 的 v-model 事件是 string，直接绑到联合类型的 ref 上过不了类型检查
function onTypeChange(value: string): void {
  type.value = value as TypeFilter
}
</script>

<template>
  <PageShell title="账单">
    <template #actions>
      <RouterLink to="/transfers/new">
        <BaseButton variant="ghost" size="sm">转账</BaseButton>
      </RouterLink>
    </template>

    <MonthPicker />

    <!-- 合计不含转账：账户间挪钱不是真实收支 -->
    <div class="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-hairline bg-surface p-3">
      <div>
        <p class="text-xs text-ink-secondary">支出</p>
        <p class="tnum mt-0.5 text-[15px] font-semibold text-ink">
          {{ formatMain(totals.expense) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-ink-secondary">收入</p>
        <p class="tnum mt-0.5 text-[15px] font-semibold text-ink">
          {{ formatMain(totals.income) }}
        </p>
      </div>
      <div>
        <p class="text-xs text-ink-secondary">结余</p>
        <p
          class="tnum mt-0.5 text-[15px] font-semibold"
          :class="totals.balance < 0 ? 'text-delta-down' : 'text-ink'"
        >
          {{ formatMain(totals.balance) }}
        </p>
      </div>
    </div>

    <!-- 筛选：一行放得下，不折叠 -->
    <div class="mt-3 grid grid-cols-2 gap-2">
      <BaseSelect
        :model-value="type"
        :options="TYPE_OPTIONS"
        placeholder=""
        @update:model-value="onTypeChange"
      />
      <BaseSelect v-model="categoryId" :options="categoryOptions" placeholder="" />
    </div>

    <div class="mt-3">
      <EmptyState
        v-if="isEmpty"
        icon="🧾"
        title="本月还没有记账"
        description="点下面的按钮记第一笔"
      >
        <RouterLink to="/transactions/new">
          <BaseButton size="sm">记一笔</BaseButton>
        </RouterLink>
      </EmptyState>

      <EmptyState
        v-else-if="groups.length === 0"
        icon="🔍"
        title="没有符合条件的记录"
        description="换个类型或分类看看"
      >
        <BaseButton size="sm" variant="secondary" @click="reset">清除筛选</BaseButton>
      </EmptyState>

      <TransactionList v-else :groups="groups" />

      <p v-if="hasFilter && groups.length > 0" class="mt-3 text-center text-xs text-ink-muted">
        已按条件筛选 ·
        <button type="button" class="text-series-1" @click="reset">清除</button>
      </p>
    </div>
  </PageShell>
</template>
