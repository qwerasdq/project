<script setup lang="ts">
import { computed } from 'vue'

import type { CurrencyCode } from '@/types'
import AmountText from '@/components/ui/AmountText.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import ColorPicker from '@/components/ui/ColorPicker.vue'
import EmojiPicker from '@/components/ui/EmojiPicker.vue'
import { useToast } from '@/composables/useToast'
import { CURRENCIES, currencyName } from '@/lib/money'
import { ACCOUNT_ICONS, BADGE_COLORS } from '@/lib/presets'
import { useDbStore } from '@/stores/db'
import { useAccountForm } from './useAccountForm'

const props = defineProps<{ accountId?: string }>()
const emit = defineEmits<{ saved: [] }>()

const store = useDbStore()
const toast = useToast()

const { state, errors, mode, balance, archived, transactionCount, currencyLocked, submit, setArchived } =
  useAccountForm(() => props.accountId)

const currencyOptions = CURRENCIES.map((c) => ({ value: c.code, label: `${c.name} ${c.code}` }))

/** 最后一个在用账户不允许归档，否则记账时无账户可选 */
const isLastActive = computed(() => !archived.value && store.activeAccounts.length <= 1)

function onCurrencyChange(value: string): void {
  state.currency = value as CurrencyCode
}

function onSave(): void {
  if (!submit()) return
  toast.success(mode.value === 'edit' ? '已保存' : '账户已创建')
  emit('saved')
}

function onToggleArchive(): void {
  const next = !archived.value
  setArchived(next)
  toast.success(next ? '账户已归档' : '账户已恢复')
  emit('saved')
}
</script>

<template>
  <div class="space-y-5 pb-4">
    <!-- 编辑态：先把当前余额亮出来，用户才知道自己在改什么 -->
    <div
      v-if="mode === 'edit'"
      class="rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]"
    >
      <p class="text-sm text-ink-secondary">当前余额</p>
      <AmountText
        class="mt-1 block"
        :cents="balance"
        :currency="state.currency"
        size="xl"
        :label-foreign="false"
      />
      <p class="mt-1 text-xs text-ink-muted">
        {{ state.icon }} {{ state.name || '未命名' }} · {{ currencyName(state.currency) }} ·
        {{ transactionCount }} 笔账目
      </p>
    </div>

    <BaseInput v-model="state.name" label="账户名" placeholder="如：招行储蓄卡" :maxlength="12" :error="errors.name" />

    <div>
      <BaseSelect
        :model-value="state.currency"
        label="币种"
        :options="currencyOptions"
        placeholder=""
        :disabled="currencyLocked"
        @update:model-value="onCurrencyChange"
      />
      <p v-if="currencyLocked" class="mt-1 px-1 text-sm text-ink-muted">
        该账户已有 {{ transactionCount }} 笔账目，改币种会让历史金额整体变味，因此锁定。如需换币种请新建账户。
      </p>
    </div>

    <BaseInput
      v-model="state.initialBalanceText"
      label="初始余额"
      inputmode="decimal"
      numeric
      hint="按账户币种填写，可为负数（信用卡欠款、透支）"
      :error="errors.initialBalance"
    />

    <EmojiPicker v-model="state.icon" label="图标" :options="ACCOUNT_ICONS" />
    <ColorPicker v-model="state.color" label="颜色" :options="BADGE_COLORS" />

    <BaseButton block @click="onSave">{{ mode === 'edit' ? '保存' : '创建账户' }}</BaseButton>

    <template v-if="mode === 'edit'">
      <BaseButton
        variant="ghost"
        block
        :disabled="isLastActive"
        @click="onToggleArchive"
      >
        {{ archived ? '恢复账户' : '归档账户' }}
      </BaseButton>
      <p v-if="isLastActive" class="px-1 text-center text-xs text-ink-muted">
        这是唯一在用的账户，归档后无法记账
      </p>
      <p v-else class="px-1 text-center text-xs text-ink-muted">
        账户不提供删除：删掉会让历史账目失去币种依据。归档后不再出现在记账选项里，余额与账目保留。
      </p>
    </template>
  </div>
</template>
