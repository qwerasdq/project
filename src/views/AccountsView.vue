<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import PageShell from '@/components/ui/PageShell.vue'
import AccountCard from '@/features/accounts/AccountCard.vue'
import AccountForm from '@/features/accounts/AccountForm.vue'
import { useCurrency } from '@/composables/useCurrency'
import { totalBalanceMain } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

const store = useDbStore()
const { formatMain, missingRateCurrencies } = useCurrency()

/** 账户表单字段不多，用弹层就地编辑，不跳页 */
const formOpen = ref(false)
const editingId = ref<string | undefined>(undefined)
const showArchived = ref(false)

const totalBalance = computed(() =>
  totalBalanceMain(store.accounts, store.db.transactions, store.statsCtx),
)

const archivedAccounts = computed(() => store.accounts.filter((a) => a.archived))

function openCreate(): void {
  editingId.value = undefined
  formOpen.value = true
}

function openEdit(id: string): void {
  editingId.value = id
  formOpen.value = true
}
</script>

<template>
  <PageShell title="账户" back>
    <template #actions>
      <RouterLink to="/transfers/new">
        <BaseButton variant="ghost" size="sm">转账</BaseButton>
      </RouterLink>
    </template>

    <section class="rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
      <p class="text-sm text-ink-secondary">账户总资产（折合人民币）</p>
      <p class="mt-1 text-3xl font-semibold text-ink">{{ formatMain(totalBalance) }}</p>
      <p class="mt-1 text-xs text-ink-muted">
        余额含转账与初始余额；已归档账户不计入
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

    <h2 class="mt-5 mb-1.5 px-1 text-xs font-medium text-ink-secondary">在用账户</h2>

    <div class="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <button
        v-for="account in store.activeAccounts"
        :key="account.id"
        type="button"
        class="block w-full border-b border-hairline text-left last:border-b-0 active:bg-hairline/50"
        @click="openEdit(account.id)"
      >
        <AccountCard :account="account" />
      </button>
    </div>

    <BaseButton class="mt-3" variant="secondary" block @click="openCreate">新增账户</BaseButton>

    <template v-if="archivedAccounts.length > 0">
      <button
        type="button"
        class="mt-5 mb-1.5 flex w-full items-center gap-1 px-1 text-xs font-medium text-ink-secondary"
        :aria-expanded="showArchived"
        @click="showArchived = !showArchived"
      >
        <span aria-hidden="true">{{ showArchived ? '▾' : '▸' }}</span>
        已归档（{{ archivedAccounts.length }}）
      </button>

      <div v-if="showArchived" class="overflow-hidden rounded-2xl border border-hairline bg-surface">
        <button
          v-for="account in archivedAccounts"
          :key="account.id"
          type="button"
          class="block w-full border-b border-hairline text-left last:border-b-0 active:bg-hairline/50"
          @click="openEdit(account.id)"
        >
          <AccountCard :account="account" />
        </button>
      </div>
    </template>

    <BaseModal
      :open="formOpen"
      :title="editingId ? '编辑账户' : '新增账户'"
      @close="formOpen = false"
    >
      <AccountForm :account-id="editingId" @saved="formOpen = false" />
    </BaseModal>
  </PageShell>
</template>
