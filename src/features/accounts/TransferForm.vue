<script setup lang="ts">
import { computed } from 'vue'

import AmountText from '@/components/ui/AmountText.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { MAIN_CURRENCY, currencyName } from '@/lib/money'
import { useDbStore } from '@/stores/db'
import { useTransferForm } from './useTransferForm'

const emit = defineEmits<{ saved: [] }>()

const store = useDbStore()
const toast = useToast()

const {
  state,
  errors,
  fromCurrency,
  toCurrency,
  crossCurrency,
  rateUnset,
  accountOptions,
  toAccountOptions,
  toAmount,
  fromBalance,
  insufficient,
  markRateTouched,
  swapAccounts,
  submit,
} = useTransferForm()

const enoughAccounts = computed(() => store.activeAccounts.length >= 2)

const fromSymbol = computed(() => symbolOf(fromCurrency.value ?? MAIN_CURRENCY))

function symbolOf(code: string): string {
  const parts = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: code }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? code
}

/** 汇率的自然语言读法，比裸数字好核对 */
const rateHint = computed(() => {
  if (!crossCurrency.value || !fromCurrency.value || !toCurrency.value) return ''
  return `1 ${currencyName(fromCurrency.value)} = ${state.rateText} ${currencyName(toCurrency.value)}`
})

function onSwap(): void {
  swapAccounts()
}

function onSubmit(): void {
  if (!submit()) return
  toast.success('转账已记录')
  emit('saved')
}
</script>

<template>
  <EmptyState
    v-if="!enoughAccounts"
    icon="💳"
    title="至少需要两个账户"
    description="转账发生在两个账户之间，去账户管理再建一个"
  >
    <RouterLink to="/accounts">
      <BaseButton size="sm">去账户管理</BaseButton>
    </RouterLink>
  </EmptyState>

  <div v-else class="space-y-5 pb-4">
    <div class="space-y-3">
      <BaseSelect
        v-model="state.fromAccountId"
        label="转出账户"
        :options="accountOptions"
        placeholder="请选择账户"
      />

      <div class="flex justify-center">
        <button
          type="button"
          class="flex h-8 items-center gap-1 rounded-full border border-hairline bg-surface px-3 text-xs text-ink-secondary active:bg-hairline"
          aria-label="交换转出与转入账户"
          @click="onSwap"
        >
          <span aria-hidden="true">⇅</span> 交换
        </button>
      </div>

      <BaseSelect
        v-model="state.toAccountId"
        label="转入账户"
        :options="toAccountOptions"
        placeholder="请选择账户"
      />
    </div>

    <p v-if="errors.accounts" class="-mt-2 px-1 text-sm text-critical">{{ errors.accounts }}</p>

    <div>
      <label
        for="transfer-amount"
        class="block rounded-2xl border bg-surface px-4 py-3"
        :class="errors.amount ? 'border-critical' : 'border-hairline'"
      >
        <span class="text-sm text-ink-secondary">转出金额</span>
        <span class="mt-1 flex items-center gap-1.5">
          <span class="text-2xl font-semibold text-ink-muted">{{ fromSymbol }}</span>
          <input
            id="transfer-amount"
            v-model="state.amountText"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="0.00"
            class="tnum w-full bg-transparent text-3xl font-semibold text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </span>
      </label>
      <p v-if="errors.amount" class="mt-1 px-1 text-sm text-critical">{{ errors.amount }}</p>
      <p v-else class="mt-1 flex items-center gap-1 px-1 text-xs text-ink-muted">
        转出账户余额
        <AmountText :cents="fromBalance" :currency="fromCurrency ?? MAIN_CURRENCY" size="sm" />
      </p>
    </div>

    <!-- 余额不足只提示不拦截：允许透支，也允许先转账后补记 -->
    <p
      v-if="insufficient"
      class="-mt-2 flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-ink-secondary ring-1 ring-[var(--ring)]"
    >
      <span aria-hidden="true">⚠️</span>
      <span>转出金额超过该账户余额，仍可继续，余额会变成负数。</span>
    </p>

    <!-- 跨币种才需要汇率；同币种恒为 1 -->
    <div v-if="crossCurrency">
      <BaseInput
        v-model="state.rateText"
        label="汇率"
        inputmode="decimal"
        numeric
        :hint="rateHint"
        :error="errors.rate"
        @update:model-value="markRateTouched"
      />

      <div class="mt-3 flex items-center justify-between rounded-xl bg-surface px-3.5 py-3 ring-1 ring-[var(--ring)]">
        <span class="text-sm text-ink-secondary">预计到账</span>
        <AmountText
          v-if="toAmount !== null"
          :cents="toAmount"
          :currency="toCurrency ?? MAIN_CURRENCY"
          size="lg"
          :label-foreign="false"
        />
        <span v-else class="text-sm text-ink-muted">填金额后显示</span>
      </div>

      <p
        v-if="rateUnset"
        class="mt-2 flex items-start gap-2 rounded-xl bg-surface px-3 py-2 text-sm text-ink-secondary ring-1 ring-[var(--ring)]"
      >
        <span aria-hidden="true">⚠️</span>
        <span>
          这两个币种的汇率还没设置，上面的数字是按 1:1 预填的。
          <RouterLink to="/settings" class="text-series-1 underline">去设置汇率</RouterLink>
        </span>
      </p>
    </div>

    <BaseInput v-model="state.occurredAt" label="日期" type="date" numeric :error="errors.date" />
    <BaseInput v-model="state.note" label="备注" placeholder="选填" :maxlength="50" :error="errors.note" />

    <BaseButton block @click="onSubmit">确认转账</BaseButton>

    <p class="px-1 text-center text-xs text-ink-muted">
      转账会生成一出一进两条记录，不计入收支统计。
    </p>
  </div>
</template>
