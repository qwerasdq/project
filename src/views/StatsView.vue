<script setup lang="ts">
import CategoryShareChart from '@/components/charts/CategoryShareChart.vue'
import MonthlyTrendChart from '@/components/charts/MonthlyTrendChart.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MonthPicker from '@/components/ui/MonthPicker.vue'
import PageShell from '@/components/ui/PageShell.vue'
import { useCurrency } from '@/composables/useCurrency'
import { monthLabel } from '@/lib/date'
import { TREND_RANGES, useStats } from '@/features/stats/useStats'

const { month, range, trend, rangeLabel, hasTrendData, share } = useStats()
const { missingRateCurrencies } = useCurrency()
</script>

<template>
  <PageShell title="统计">
    <!--
      过滤区：一行，位于所有图表之上。月份决定两张图看的区间；区间开关只作用于趋势图，
      所以它的名字里写明了「趋势」，不做成各图自带的控件。
    -->
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <MonthPicker />
      </div>
      <div
        class="flex shrink-0 gap-1 rounded-xl bg-hairline/60 p-1"
        role="group"
        aria-label="趋势区间"
      >
        <button
          v-for="option in TREND_RANGES"
          :key="option"
          type="button"
          class="h-8 rounded-lg px-2.5 text-xs font-medium transition-colors"
          :class="range === option ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary'"
          :aria-pressed="range === option"
          @click="range = option"
        >
          近 {{ option }} 月
        </button>
      </div>
    </div>

    <p
      v-if="missingRateCurrencies.length > 0"
      class="mt-2 flex items-start gap-1.5 px-1 text-xs text-ink-muted"
    >
      <span aria-hidden="true">⚠️</span>
      <span>
        未设置 {{ missingRateCurrencies.join('、') }} 汇率，以上金额按 1:1 折算。
        <RouterLink to="/settings" class="text-series-1 underline">去设置</RouterLink>
      </span>
    </p>

    <template v-if="hasTrendData">
      <section class="mt-4 rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
        <div class="mb-1 flex items-baseline justify-between gap-2">
          <h2 class="text-sm font-medium text-ink">近 {{ range }} 个月收支</h2>
          <span class="text-xs text-ink-muted">单位：元</span>
        </div>
        <p class="mb-3 text-xs text-ink-muted">{{ rangeLabel }}</p>
        <MonthlyTrendChart :points="trend" />
      </section>

      <section class="mt-4 rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
        <h2 class="text-sm font-medium text-ink">{{ monthLabel(month) }}支出构成</h2>
        <p v-if="share.length === 0" class="mt-2 text-sm text-ink-muted">本月还没有支出记录</p>
        <CategoryShareChart
          v-else
          class="mt-1"
          :items="share"
          :label="monthLabel(month)"
        />
      </section>
    </template>

    <EmptyState
      v-else
      icon="📊"
      title="还没有可统计的账目"
      :description="`最近 ${range} 个月没有收支记录，先记几笔再看趋势`"
    />
  </PageShell>
</template>
