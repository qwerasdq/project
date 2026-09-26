<script setup lang="ts">
import BaseInput from '@/components/ui/BaseInput.vue'
import { useExchangeRates } from './useExchangeRates'

const { rows, commit, emptyHint } = useExchangeRates()
</script>

<template>
  <section>
    <h2 class="mb-1.5 px-1 text-xs font-medium text-ink-secondary">汇率</h2>

    <div class="rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
      <p v-if="emptyHint" class="text-sm text-ink-muted">{{ emptyHint }}</p>

      <template v-else>
        <p class="mb-3 text-xs text-ink-muted">
          外币账户的余额、统计与预算都按这里的汇率折算成人民币。留空即不设汇率，暂按 1:1 处理。
        </p>

        <div class="space-y-3">
          <!-- 方向写进标签：汇率填反是这里唯一容易犯的错 -->
          <BaseInput
            v-for="row in rows"
            :key="row.code"
            v-model="row.text"
            :label="`1 ${row.name} = ? 人民币`"
            placeholder="未设置，暂按 1:1 · 如 7.1"
            inputmode="decimal"
            numeric
            :error="row.error"
            @blur="commit(row)"
          />
        </div>
      </template>
    </div>
  </section>
</template>
