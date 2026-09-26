<script setup lang="ts">
import { useRouter } from 'vue-router'

import PageShell from '@/components/ui/PageShell.vue'
import TransferForm from '@/features/accounts/TransferForm.vue'

const router = useRouter()

function onSaved(): void {
  if (window.history.length > 1) router.back()
  else router.push('/accounts')
}
</script>

<template>
  <PageShell title="转账" back>
    <TransferForm @saved="onSaved" />
  </PageShell>
</template>
