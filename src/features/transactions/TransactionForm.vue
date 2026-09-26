<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { TransactionType } from '@/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import AmountText from '@/components/ui/AmountText.vue'
import { useToast } from '@/composables/useToast'
import { MAIN_CURRENCY } from '@/lib/money'
import { isTransfer } from '@/lib/stats'
import { parseAmountText } from '@/lib/validate'
import { useDbStore } from '@/stores/db'
import { useTransactionForm } from './useTransactionForm'

const props = defineProps<{ transactionId?: string }>()
const emit = defineEmits<{ saved: [] }>()

const store = useDbStore()
const toast = useToast()

const {
  state,
  errors,
  mode,
  existing,
  categories,
  selectableAccounts,
  readonlyReason,
  submit,
  resetForNext,
  remove,
} = useTransactionForm(() => props.transactionId)

const amountInput = ref<HTMLInputElement | null>(null)
const confirmDelete = ref(false)

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'expense', label: '支出' },
  { value: 'income', label: '收入' },
]

const currentAccount = computed(() => store.accountOf(state.accountId))
const currency = computed(() => currentAccount.value?.currency ?? MAIN_CURRENCY)

/** 从 Intl 取符号，日元/美元等符号与人民币不同，写死「¥」会误导 */
const currencySymbol = computed(() => {
  const parts = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency.value,
  }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency.value
})

const accountOptions = computed(() =>
  selectableAccounts.value.map((a) => ({
    value: a.id,
    label: a.archived ? `${a.name}（已归档）· ${a.currency}` : `${a.name} · ${a.currency}`,
  })),
)

const peerAccount = computed(() => {
  const id = existing.value?.transferPeerAccountId
  return id ? store.accountOf(id) : undefined
})

const canSave = computed(
  () => mode.value !== 'readonly' && accountOptions.value.length > 0 && categories.value.length > 0,
)

watch(
  () => state.amountText,
  () => {
    if (errors.amount) errors.amount = null
  },
)

/** 失焦即校验金额，不用等到点保存才报错 */
function onAmountBlur(): void {
  if (!state.amountText.trim()) return
  const result = parseAmountText(state.amountText)
  errors.amount = result.ok ? null : result.error
}

function onSave(continueAfter = false): void {
  const outcome = submit()
  if (!outcome.ok) {
    if (errors.amount) amountInput.value?.focus()
    return
  }

  const warning = outcome.budgetWarning
  if (warning) {
    const percent = Math.round(warning.ratio * 100)
    if (warning.level === 'over') toast.over(`「${warning.categoryName}」本月预算已超支（${percent}%）`)
    else toast.warning(`「${warning.categoryName}」本月预算已用 ${percent}%`)
  } else {
    toast.success(mode.value === 'edit' ? '已保存' : '记好了')
  }

  if (continueAfter && mode.value === 'create') {
    resetForNext()
    void nextTick(() => amountInput.value?.focus())
    return
  }
  emit('saved')
}

function onDelete(): void {
  const transfer = existing.value ? isTransfer(existing.value) : false
  if (!remove()) return
  confirmDelete.value = false
  toast.success(transfer ? '转账记录已删除' : '已删除')
  emit('saved')
}

const transferSummary = computed(() => {
  const tx = existing.value
  if (!tx) return null
  return {
    direction: tx.type === 'expense' ? '转出' : '转入',
    from: tx.type === 'expense' ? currentAccount.value : peerAccount.value,
    to: tx.type === 'expense' ? peerAccount.value : currentAccount.value,
  }
})
</script>

<template>
  <!-- 转账记录只读：改动单边会破坏配对，引导用户删除重建 -->
  <div v-if="mode === 'readonly'" class="space-y-4">
    <div class="rounded-2xl border border-hairline bg-surface p-4">
      <p class="text-sm text-ink-secondary">转账金额</p>
      <AmountText
        class="mt-1 block"
        :cents="existing?.amount ?? 0"
        :currency="currency"
        :type="existing?.type ?? 'expense'"
        size="xl"
      />
      <div class="mt-3 flex items-center gap-2 text-sm text-ink-secondary">
        <span>{{ transferSummary?.from?.icon }} {{ transferSummary?.from?.name ?? '—' }}</span>
        <span aria-hidden="true">→</span>
        <span>{{ transferSummary?.to?.icon }} {{ transferSummary?.to?.name ?? '—' }}</span>
      </div>
      <p class="mt-2 text-sm text-ink-muted">{{ existing?.occurredAt }}</p>
      <p v-if="existing?.note" class="mt-1 text-sm text-ink-secondary">{{ existing.note }}</p>
    </div>

    <p class="rounded-xl bg-hairline/60 px-3 py-2 text-sm text-ink-secondary">
      ⓘ {{ readonlyReason }}
    </p>

    <BaseButton variant="danger" block @click="confirmDelete = true">删除转账记录</BaseButton>
  </div>

  <div v-else class="space-y-5 pb-4">
    <!-- 收支方向 -->
    <div class="grid grid-cols-2 gap-1 rounded-xl bg-hairline/60 p-1">
      <button
        v-for="item in TYPES"
        :key="item.value"
        type="button"
        class="h-9 rounded-lg text-[15px] font-medium transition-colors"
        :class="
          state.type === item.value
            ? item.value === 'expense'
              ? 'bg-surface text-delta-down shadow-sm'
              : 'bg-surface text-delta-up shadow-sm'
            : 'text-ink-secondary'
        "
        :aria-pressed="state.type === item.value"
        @click="state.type = item.value"
      >
        {{ item.label }}
      </button>
    </div>

    <!-- 金额 -->
    <div>
      <label
        for="tx-amount"
        class="block rounded-2xl border bg-surface px-4 py-3"
        :class="errors.amount ? 'border-critical' : 'border-hairline'"
      >
        <span class="text-sm text-ink-secondary">金额</span>
        <span class="mt-1 flex items-center gap-1.5">
          <span class="text-2xl font-semibold text-ink-muted">{{ currencySymbol }}</span>
          <input
            id="tx-amount"
            ref="amountInput"
            v-model="state.amountText"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0.00"
            class="tnum w-full bg-transparent text-3xl font-semibold text-ink placeholder:text-ink-muted focus:outline-none"
            :aria-invalid="errors.amount ? true : undefined"
            @blur="onAmountBlur"
          />
        </span>
      </label>
      <p v-if="errors.amount" class="mt-1 px-1 text-sm text-critical">{{ errors.amount }}</p>
    </div>

    <!-- 分类 -->
    <div>
      <div class="mb-2 flex items-baseline justify-between px-1">
        <span class="text-sm text-ink-secondary">分类</span>
        <RouterLink to="/categories" class="text-xs text-series-1">管理分类</RouterLink>
      </div>

      <EmptyState
        v-if="categories.length === 0"
        icon="🏷️"
        :title="`还没有${state.type === 'expense' ? '支出' : '收入'}分类`"
        description="先建一个分类才能记账"
      >
        <RouterLink to="/categories">
          <BaseButton size="sm">去创建分类</BaseButton>
        </RouterLink>
      </EmptyState>

      <div v-else class="grid grid-cols-4 gap-2">
        <button
          v-for="category in categories"
          :key="category.id"
          type="button"
          class="flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 transition-colors"
          :class="
            state.categoryId === category.id
              ? 'border-series-1 bg-series-1/10'
              : 'border-hairline bg-surface'
          "
          :aria-pressed="state.categoryId === category.id"
          @click="state.categoryId = category.id"
        >
          <span class="text-xl" aria-hidden="true">{{ category.icon }}</span>
          <span
            class="w-full truncate text-center text-xs"
            :class="state.categoryId === category.id ? 'text-series-1' : 'text-ink-secondary'"
          >
            {{ category.name }}
          </span>
        </button>
      </div>
      <p v-if="errors.category" class="mt-1 px-1 text-sm text-critical">{{ errors.category }}</p>
    </div>

    <!-- 账户 / 日期 / 备注 -->
    <BaseSelect
      v-model="state.accountId"
      label="账户"
      :options="accountOptions"
      placeholder="请选择账户"
      :error="errors.account"
    />

    <BaseInput
      v-model="state.occurredAt"
      label="日期"
      type="date"
      :error="errors.date"
      numeric
    />

    <BaseInput
      v-model="state.note"
      label="备注"
      placeholder="选填"
      :maxlength="50"
      :error="errors.note"
    />

    <div class="flex gap-2 pt-1">
      <BaseButton
        v-if="mode === 'create'"
        variant="secondary"
        :disabled="!canSave"
        @click="onSave(true)"
      >
        保存并再记一笔
      </BaseButton>
      <BaseButton block :disabled="!canSave" @click="onSave(false)">保存</BaseButton>
    </div>

    <BaseButton
      v-if="mode === 'edit'"
      variant="ghost"
      block
      class="!text-critical"
      @click="confirmDelete = true"
    >
      删除这笔账
    </BaseButton>
  </div>

  <BaseModal
    :open="confirmDelete"
    :title="existing && isTransfer(existing) ? '删除转账记录' : '删除这笔账'"
    @close="confirmDelete = false"
  >
    <p class="text-sm text-ink-secondary">
      {{
        existing && isTransfer(existing)
          ? '转出与转入两条记录会一并删除，且不可恢复。'
          : '删除后不可恢复。'
      }}
    </p>
    <p v-if="existing" class="mt-2 flex items-center gap-2 text-sm text-ink-muted">
      <span>{{ store.categoryOf(existing.categoryId)?.name ?? '转账' }}</span>
      <AmountText
        :cents="existing.amount"
        :currency="currency"
        :type="existing.type"
      />
    </p>
    <div class="mt-5 flex gap-2">
      <BaseButton variant="secondary" block @click="confirmDelete = false">取消</BaseButton>
      <BaseButton variant="danger" block @click="onDelete">删除</BaseButton>
    </div>
  </BaseModal>
</template>
