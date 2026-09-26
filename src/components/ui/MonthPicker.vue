<script setup lang="ts">
import { useMonth } from '@/composables/useMonth'

const { label, canGoNext, prev, next, reset, isCurrent } = useMonth()
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <button
      type="button"
      class="h-9 w-9 rounded-lg text-ink-secondary active:bg-hairline"
      aria-label="上一个月"
      @click="prev"
    >
      ‹
    </button>

    <button
      type="button"
      class="rounded-lg px-3 py-1.5 text-[15px] font-medium text-ink active:bg-hairline"
      :title="isCurrent ? '当前为本月' : '回到本月'"
      @click="reset"
    >
      {{ label }}
    </button>

    <button
      type="button"
      class="h-9 w-9 rounded-lg text-ink-secondary active:bg-hairline disabled:opacity-30"
      aria-label="下一个月"
      :disabled="!canGoNext"
      @click="next"
    >
      ›
    </button>
  </div>
</template>
