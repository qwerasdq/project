<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

withDefaults(
  defineProps<{
    title: string
    /** 显示返回箭头（表单类页面用） */
    back?: boolean
    /** 底部留白高度：有 TabBar 时预留出空间 */
    padded?: boolean
  }>(),
  {
    back: false,
    padded: true,
  },
)

const route = useRoute()
const router = useRouter()

/** 表单页没有 tab，需要自己留出底部安全区 */
const hasTabBar = computed(() => route.meta.tab !== undefined)

function goBack(): void {
  if (window.history.length > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-md flex-col">
    <header
      class="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-hairline bg-page/95 px-2 backdrop-blur"
    >
      <button
        v-if="back"
        type="button"
        class="-ml-1 h-9 w-9 rounded-lg text-xl text-ink-secondary active:bg-hairline"
        aria-label="返回"
        @click="goBack"
      >
        ‹
      </button>
      <h1 class="text-base font-semibold text-ink" :class="back ? '' : 'pl-2'">{{ title }}</h1>

      <div class="ml-auto flex items-center gap-1 pr-1">
        <slot name="actions" />
      </div>
    </header>

    <main
      class="flex-1 px-4 pt-3"
      :class="[padded && hasTabBar ? 'pb-24' : 'pb-[max(1.5rem,env(safe-area-inset-bottom))]']"
    >
      <slot />
    </main>

    <slot name="footer" />
  </div>
</template>
