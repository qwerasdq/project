<script setup lang="ts">
import { useToast, type ToastLevel } from '@/composables/useToast'

const { items, dismiss } = useToast()

/**
 * 状态色必须伴随图标 + 文字，绝不只靠颜色表达状态
 * （浅色模式下 warning 对表面色的对比度仅 1.79:1）。
 */
const LEVEL_STYLE: Record<ToastLevel, { icon: string; accent: string }> = {
  info: { icon: 'ℹ️', accent: 'text-ink' },
  success: { icon: '✅', accent: 'text-good' },
  warning: { icon: '⚠️', accent: 'text-ink' },
  over: { icon: '🔴', accent: 'text-critical' },
  error: { icon: '⛔', accent: 'text-critical' },
}

const LEVEL_BAR: Record<ToastLevel, string> = {
  info: 'bg-rule',
  success: 'bg-good',
  warning: 'bg-warning',
  over: 'bg-critical',
  error: 'bg-critical',
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        leave-active-class="transition duration-150 ease-in"
        enter-from-class="-translate-y-2 opacity-0"
        leave-to-class="opacity-0"
        move-class="transition duration-150"
      >
        <div
          v-for="item in items"
          :key="item.id"
          class="pointer-events-auto flex w-full max-w-md items-start gap-2.5 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-[var(--ring)]"
          @click="dismiss(item.id)"
        >
          <span class="w-1 self-stretch" :class="LEVEL_BAR[item.level]" aria-hidden="true" />
          <span class="py-3 pl-1 text-base" aria-hidden="true">{{ LEVEL_STYLE[item.level].icon }}</span>
          <span class="py-3 pr-4 text-sm" :class="LEVEL_STYLE[item.level].accent">
            {{ item.message }}
          </span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
