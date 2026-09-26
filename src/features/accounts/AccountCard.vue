<script setup lang="ts">
import { computed } from 'vue'

import type { Account } from '@/types'
import AmountText from '@/components/ui/AmountText.vue'
import { MAIN_CURRENCY, currencyName } from '@/lib/money'
import { badgeStyle } from '@/lib/presets'
import { accountBalance } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

const props = defineProps<{ account: Account }>()

const store = useDbStore()

/** 余额**包含转账**——转账确实改变余额。见 lib/stats 的说明。 */
const balance = computed(() => accountBalance(props.account, store.db.transactions))

const transactionCount = computed(
  () => store.db.transactions.filter((t) => t.accountId === props.account.id).length,
)

const badge = computed(() => badgeStyle(props.account.color))
</script>

<template>
  <div class="flex items-center gap-3 px-4 py-3.5">
    <span
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
      :style="badge"
      aria-hidden="true"
    >
      {{ account.icon }}
    </span>

    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-1.5">
        <span class="truncate text-[15px] font-medium text-ink">{{ account.name }}</span>
        <span
          v-if="account.archived"
          class="shrink-0 rounded px-1 py-px text-[10px] text-ink-muted ring-1 ring-hairline"
        >
          已归档
        </span>
      </p>
      <p class="mt-0.5 truncate text-xs text-ink-muted">
        {{ currencyName(account.currency) }} · {{ transactionCount }} 笔
      </p>
    </div>

    <AmountText
      :cents="balance"
      :currency="account.currency"
      size="lg"
      :label-foreign="account.currency !== MAIN_CURRENCY"
    />
  </div>
</template>
