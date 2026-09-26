<script setup lang="ts">
import { computed } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BudgetProgressBar from '@/components/BudgetProgressBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useCurrency } from '@/composables/useCurrency'
import { useMonth } from '@/composables/useMonth'
import { useToast } from '@/composables/useToast'
import { monthLabel } from '@/lib/date'
import { budgetLevel } from '@/lib/stats'
import { useBudgetEditor, useBudgetManager } from './useBudgetManager'

const { month, label } = useMonth()
const { formatMain } = useCurrency()
const toast = useToast()

const {
  rows,
  totalLimit,
  totalSpent,
  totalRatio,
  lastMonth,
  canCopyLastMonth,
  copyLastMonth,
} = useBudgetManager(month)

const {
  open,
  categoryId,
  limitText,
  categoryError,
  limitError,
  categoryOptions,
  categoryLocked,
  canCreate,
  existing,
  startCreate,
  startEdit,
  save,
  remove,
} = useBudgetEditor(month)

/** 剩余 / 超支文案，负数改说「超支」，避免出现「剩余 -320.00」 */
function remainText(limit: number, spent: number): string {
  const remain = limit - spent
  return remain >= 0 ? `剩余 ${formatMain(remain)}` : `超支 ${formatMain(-remain)}`
}

/** 剩余金额的着色：只有在超支时才用状态色，正常态保持中性 */
function remainTone(ratio: number): string {
  const level = budgetLevel(ratio)
  if (level === 'over') return 'text-critical'
  if (level === 'warning') return 'text-ink'
  return 'text-ink-muted'
}

/** 弹层里显示所选分类本月已花，帮用户判断限额该定多少 */
const editingSpent = computed(
  () => rows.value.find((row) => row.budget.categoryId === categoryId.value)?.progress.spent ?? 0,
)

function onCopyLastMonth(): void {
  const count = copyLastMonth()
  toast.success(`已沿用 ${monthLabel(lastMonth.value)} 的 ${count} 条预算`)
}
</script>

<template>
  <section class="rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
    <p class="text-sm text-ink-secondary">{{ label }}预算</p>
    <p class="mt-1 text-3xl font-semibold text-ink">{{ formatMain(totalLimit) }}</p>
    <p class="tnum mt-1 text-sm" :class="remainTone(totalRatio)">
      <span class="text-ink-muted">已花 {{ formatMain(totalSpent) }} ·</span>
      {{ remainText(totalLimit, totalSpent) }}
    </p>

    <div v-if="totalLimit > 0" class="mt-3">
      <BudgetProgressBar :ratio="totalRatio" label="总使用进度" />
    </div>
  </section>

  <EmptyState
    v-if="rows.length === 0"
    icon="🎯"
    title="本月还没有预算"
    description="给常花钱的分类设个月度上限，接近和超出时会提醒你"
  />

  <template v-else>
    <h2 class="mt-5 mb-1.5 px-1 text-xs font-medium text-ink-secondary">分类预算</h2>

    <div class="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <button
        v-for="row in rows"
        :key="row.budget.id"
        type="button"
        class="block w-full border-b border-hairline px-4 py-3 text-left last:border-b-0 active:bg-hairline/50"
        @click="startEdit(row.category.id)"
      >
        <div class="mb-2 flex items-center justify-between gap-2">
          <span class="flex items-center gap-2 text-[15px] text-ink">
            <span aria-hidden="true">{{ row.category.icon }}</span>
            {{ row.category.name }}
          </span>
          <span class="tnum text-sm" :class="remainTone(row.progress.ratio)">
            {{ remainText(row.progress.limit, row.progress.spent) }}
          </span>
        </div>

        <BudgetProgressBar
          :ratio="row.progress.ratio"
          :name="row.category.name"
          :label="`${formatMain(row.progress.spent)} / ${formatMain(row.progress.limit)}`"
        />
      </button>
    </div>
  </template>

  <BaseButton class="mt-3" variant="secondary" block :disabled="!canCreate" @click="startCreate">
    添加预算
  </BaseButton>
  <p v-if="!canCreate" class="mt-1.5 text-center text-xs text-ink-muted">
    所有支出分类都已设置预算
  </p>

  <BaseButton v-if="canCopyLastMonth" class="mt-3" variant="ghost" block @click="onCopyLastMonth">
    沿用 {{ monthLabel(lastMonth) }} 的预算
  </BaseButton>

  <BaseModal :open="open" :title="categoryLocked ? '修改预算' : '添加预算'" @close="open = false">
    <div class="space-y-4">
      <BaseSelect
        v-model="categoryId"
        label="分类"
        :options="categoryOptions"
        :disabled="categoryLocked"
        :error="categoryError"
      />

      <BaseInput
        v-model="limitText"
        label="月度限额（元）"
        placeholder="0.00"
        inputmode="decimal"
        numeric
        :error="limitError"
        :hint="editingSpent > 0 ? `本月已花 ${formatMain(editingSpent)}` : ''"
      />

      <div class="flex gap-2">
        <BaseButton v-if="existing" variant="danger" @click="remove">删除预算</BaseButton>
        <BaseButton block @click="save">保存</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
