<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageShell from '@/components/ui/PageShell.vue'
import TransactionForm from '@/features/transactions/TransactionForm.vue'

const route = useRoute()
const router = useRouter()

/** 编辑页与新建页共用同一个组件，靠路由参数区分 */
const transactionId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id ? id : undefined
})

const isEdit = computed(() => transactionId.value !== undefined)

function onSaved(): void {
  if (window.history.length > 1) router.back()
  else router.push('/transactions')
}
</script>

<template>
  <PageShell :title="isEdit ? '编辑账目' : '记一笔'" back>
    <TransactionForm :transaction-id="transactionId" @saved="onSaved" />
  </PageShell>
</template>
