<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppTabBar from '@/components/AppTabBar.vue'
import AppToast from '@/components/ui/AppToast.vue'

const route = useRoute()

/** 表单类页面（meta.tab 未设置）不显示底部导航，给表单腾出整屏 */
const showTabBar = computed(() => route.meta.tab !== undefined)
</script>

<template>
  <div class="min-h-dvh bg-page text-ink">
    <RouterView v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>

    <AppTabBar v-if="showTabBar" />
    <AppToast />
  </div>
</template>
