<script setup lang="ts">
import MonthPicker from '@/components/ui/MonthPicker.vue'
import PageShell from '@/components/ui/PageShell.vue'
import BudgetManager from '@/features/budgets/BudgetManager.vue'
</script>

<template>
  <PageShell title="预算" back>
    <MonthPicker />
    <div class="mt-3">
      <BudgetManager />
    </div>
  </PageShell>
</template>
