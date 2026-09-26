<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

/** 中央的记一笔按钮单独渲染，其余按顺序排开 */
const LEFT_TABS = [
  { tab: 'dashboard', to: '/', icon: '🏠', label: '首页' },
  { tab: 'transactions', to: '/transactions', icon: '📋', label: '账单' },
] as const

const RIGHT_TABS = [
  { tab: 'stats', to: '/stats', icon: '📊', label: '统计' },
  { tab: 'mine', to: '/mine', icon: '👤', label: '我的' },
] as const

const activeTab = computed(() => (route.meta.tab as string | undefined) ?? '')
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]"
    aria-label="主导航"
  >
    <div class="mx-auto flex h-14 max-w-md items-stretch">
      <RouterLink
        v-for="item in LEFT_TABS"
        :key="item.tab"
        :to="item.to"
        class="flex flex-1 flex-col items-center justify-center gap-0.5"
        :class="activeTab === item.tab ? 'text-series-1' : 'text-ink-muted'"
      >
        <span class="text-lg leading-none" aria-hidden="true">{{ item.icon }}</span>
        <span class="text-[11px]">{{ item.label }}</span>
      </RouterLink>

      <div class="relative w-16 shrink-0">
        <RouterLink
          to="/transactions/new"
          class="absolute -top-5 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-series-1 text-2xl text-white shadow-lg active:opacity-80"
          aria-label="记一笔"
        >
          <span aria-hidden="true">＋</span>
        </RouterLink>
      </div>

      <RouterLink
        v-for="item in RIGHT_TABS"
        :key="item.tab"
        :to="item.to"
        class="flex flex-1 flex-col items-center justify-center gap-0.5"
        :class="activeTab === item.tab ? 'text-series-1' : 'text-ink-muted'"
      >
        <span class="text-lg leading-none" aria-hidden="true">{{ item.icon }}</span>
        <span class="text-[11px]">{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
