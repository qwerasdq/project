<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** 移动端从底部弹出，桌面端居中 */
    closable?: boolean
  }>(),
  {
    title: '',
    closable: true,
  },
)

const emit = defineEmits<{
  close: []
}>()

// 打开时锁定页面滚动，避免背景跟着滚
watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
  },
  { immediate: true },
)

function onEscape(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.open && props.closable) emit('close')
}

window.addEventListener('keydown', onEscape)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscape)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        @click.self="closable && emit('close')"
      >
        <div
          role="dialog"
          aria-modal="true"
          class="max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl"
        >
          <div v-if="title" class="mb-4 flex items-center justify-between">
            <h2 class="text-base font-semibold text-ink">{{ title }}</h2>
            <button
              v-if="closable"
              type="button"
              class="h-8 w-8 rounded-lg text-ink-muted active:bg-hairline"
              aria-label="关闭"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>

          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
