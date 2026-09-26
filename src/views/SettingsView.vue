<script setup lang="ts">
import PageShell from '@/components/ui/PageShell.vue'
import DataSection from '@/features/settings/DataSection.vue'
import ExchangeRateList from '@/features/settings/ExchangeRateList.vue'
import { MAIN_CURRENCY, currencyName } from '@/lib/money'
</script>

<template>
  <PageShell title="设置" back>
    <section class="mb-4 rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
      <p class="text-sm text-ink-secondary">主币种</p>
      <p class="mt-1 text-lg text-ink">{{ currencyName(MAIN_CURRENCY) }}（{{ MAIN_CURRENCY }}）</p>
      <p class="mt-1 text-xs text-ink-muted">
        统计、预算与总资产都以主币种计。当前版本固定为人民币，暂不可更改。
      </p>
    </section>

    <ExchangeRateList class="mb-4" />
    <DataSection />
  </PageShell>
</template>
