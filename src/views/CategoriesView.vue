<script setup lang="ts">
import PageShell from '@/components/ui/PageShell.vue'
import CategoryManager from '@/features/categories/CategoryManager.vue'
</script>

<template>
  <PageShell title="分类" back>
    <CategoryManager />
  </PageShell>
</template>
