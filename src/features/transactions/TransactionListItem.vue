<script setup lang="ts">
import { computed } from 'vue'

import type { Transaction } from '@/types'
import AmountText from '@/components/ui/AmountText.vue'
import { MAIN_CURRENCY } from '@/lib/money'
import { badgeStyle } from '@/lib/presets'
import { isTransfer } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

const props = defineProps<{ transaction: Transaction }>()

const store = useDbStore()

const transfer = computed(() => isTransfer(props.transaction))
const category = computed(() => store.categoryOf(props.transaction.categoryId))
const account = computed(() => store.accountOf(props.transaction.accountId))
const peer = computed(() =>
  props.transaction.transferPeerAccountId
    ? store.accountOf(props.transaction.transferPeerAccountId)
    : undefined,
)

const currency = computed(() => account.value?.currency ?? MAIN_CURRENCY)

const icon = computed(() => (transfer.value ? '🔄' : (category.value?.icon ?? '📦')))

const title = computed(() => {
  if (transfer.value) return '转账'
  return category.value?.name ?? '未分类'
})

const subtitle = computed(() => {
  const tx = props.transaction
  if (transfer.value) {
    const peerName = peer.value?.name ?? '已删除账户'
    return tx.type === 'expense' ? `转出至 ${peerName}` : `从 ${peerName} 转入`
  }
  return [account.value?.name, tx.note].filter(Boolean).join(' · ')
})

/** 分类色仅用于列表徽标底色，图表一律用固定槽位调色板 */
const badge = computed(() => badgeStyle(transfer.value ? undefined : category.value?.color))
</script>

<template>
  <RouterLink
    :to="`/transactions/${transaction.id}/edit`"
    class="flex items-center gap-3 px-4 py-3 active:bg-hairline/50"
  >
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
      :style="badge"
      aria-hidden="true"
    >
      {{ icon }}
    </span>

    <span class="min-w-0 flex-1">
      <span class="flex items-center gap-1.5">
        <span class="truncate text-[15px] font-medium text-ink">{{ title }}</span>
        <span
          v-if="transfer"
          class="shrink-0 rounded px-1 py-px text-[10px] text-ink-muted ring-1 ring-hairline"
        >
          不计收支
        </span>
      </span>
      <span v-if="subtitle" class="mt-0.5 block truncate text-xs text-ink-muted">
        {{ subtitle }}
      </span>
    </span>

    <AmountText :cents="transaction.amount" :currency="currency" :type="transaction.type" signed />
  </RouterLink>
</template>
