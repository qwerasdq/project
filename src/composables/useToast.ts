/**
 * 轻提示。模块级单例——同一时刻全局只应有一处 Toast 容器。
 */

import { ref } from 'vue'

export type ToastLevel = 'info' | 'success' | 'warning' | 'over' | 'error'

export interface ToastItem {
  id: number
  message: string
  level: ToastLevel
  /** 毫秒 */
  duration: number
}

const items = ref<ToastItem[]>([])
let nextId = 0

function dismiss(id: number): void {
  const index = items.value.findIndex((t) => t.id === id)
  if (index >= 0) items.value.splice(index, 1)
}

function show(message: string, level: ToastLevel = 'info', duration = 2400): number {
  const id = ++nextId
  items.value.push({ id, message, level, duration })
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

export function useToast() {
  return {
    items,
    dismiss,
    show,
    info: (message: string, duration?: number) => show(message, 'info', duration),
    success: (message: string, duration?: number) => show(message, 'success', duration),
    warning: (message: string, duration?: number) => show(message, 'warning', duration),
    /** 超支提示，需要用户看清，停留更久 */
    over: (message: string) => show(message, 'over', 4000),
    error: (message: string, duration?: number) => show(message, 'error', duration ?? 3200),
  }
}
