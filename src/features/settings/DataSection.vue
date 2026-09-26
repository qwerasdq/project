<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import { useToast } from '@/composables/useToast'
import { hasBackup, recoveryReason } from '@/db'
import { useDbStore } from '@/stores/db'

const store = useDbStore()
const toast = useToast()

const confirmOpen = ref(false)

/**
 * 加载时的损坏兜底结果。这两个值在一趟会话里不会变，读取一次即可 ——
 * 它们不是响应式的，放进 computed 反而会误导人以为会更新。
 */
const recovered = recoveryReason()
const backupExists = hasBackup()

/** 清空前先把要销毁的东西数清楚，让用户知道自己在删什么 */
const summary = computed(() => [
  { label: '账目', value: store.db.transactions.length },
  { label: '账户', value: store.db.accounts.length },
  { label: '分类', value: store.db.categories.length },
  { label: '预算', value: store.db.budgets.length },
])

function reset(): void {
  store.resetAll()
  confirmOpen.value = false
  toast.success('已清空，恢复到初始数据')
}
</script>

<template>
  <section>
    <h2 class="mb-1.5 px-1 text-xs font-medium text-ink-secondary">数据</h2>

    <div class="rounded-2xl bg-surface p-4 ring-1 ring-[var(--ring)]">
      <p class="text-sm text-ink-secondary">
        所有数据只保存在这台设备的浏览器里，不上传任何服务器。换设备或清理浏览器数据都会丢失。
      </p>

      <dl class="mt-3 grid grid-cols-4 gap-2 border-t border-hairline pt-3 text-center">
        <div v-for="item in summary" :key="item.label">
          <dt class="text-xs text-ink-muted">{{ item.label }}</dt>
          <dd class="mt-0.5 text-lg text-ink">{{ item.value }}</dd>
        </div>
      </dl>

      <!-- 数据曾经损坏过：必须说出来，否则用户会以为账目是自己消失的 -->
      <p
        v-if="recovered"
        class="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-sm text-ink-secondary"
      >
        <span aria-hidden="true">⚠️</span>
        <span>
          上次打开时本地数据{{ recovered }}，已恢复到初始数据。
          <template v-if="backupExists">原始内容仍留存在浏览器里，未经处理请勿继续记账覆盖。</template>
        </span>
      </p>

      <BaseButton class="mt-3" variant="danger" block @click="confirmOpen = true">
        清空所有数据
      </BaseButton>
    </div>

    <BaseModal :open="confirmOpen" title="清空所有数据" @close="confirmOpen = false">
      <p class="text-sm text-ink-secondary">
        账目、账户、分类、预算与汇率设置会全部删除，并恢复到初始账户与默认分类。
      </p>
      <p class="mt-2 text-sm text-ink-muted">此操作不可恢复，也没有云端副本可以找回。</p>

      <div class="mt-5 flex gap-2">
        <BaseButton variant="secondary" block @click="confirmOpen = false">取消</BaseButton>
        <BaseButton variant="danger" block @click="reset">清空</BaseButton>
      </div>
    </BaseModal>
  </section>
</template>
