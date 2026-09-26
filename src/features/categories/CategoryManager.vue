<script setup lang="ts">
import type { TransactionType } from '@/types'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import ColorPicker from '@/components/ui/ColorPicker.vue'
import EmojiPicker from '@/components/ui/EmojiPicker.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { BADGE_COLORS, badgeStyle } from '@/lib/presets'
import { useCategoryEditor, useCategoryManager } from './useCategoryManager'

const toast = useToast()
const { type, rows, counts, remove } = useCategoryManager()
const { open, state, nameError, mode, typeLocked, iconOptions, startCreate, startEdit, save } =
  useCategoryEditor()

const TYPES: { value: TransactionType; label: string; count: () => number }[] = [
  { value: 'expense', label: '支出', count: () => counts.value.expense },
  { value: 'income', label: '收入', count: () => counts.value.income },
]

function onDelete(id: string, name: string): void {
  const error = remove(id)
  if (error) toast.warning(error)
  else toast.success(`已删除「${name}」`)
}
</script>

<template>
  <div class="grid grid-cols-2 gap-1 rounded-xl bg-hairline/60 p-1" role="group" aria-label="分类类型">
    <button
      v-for="item in TYPES"
      :key="item.value"
      type="button"
      class="h-9 rounded-lg text-[15px] font-medium transition-colors"
      :class="type === item.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary'"
      :aria-pressed="type === item.value"
      @click="type = item.value"
    >
      {{ item.label }} {{ item.count() }}
    </button>
  </div>

  <EmptyState
    v-if="rows.length === 0"
    icon="🏷️"
    title="还没有分类"
    description="分类用来把账目归类，统计页的占比就是按它算的"
  />

  <div v-else class="mt-3 overflow-hidden rounded-2xl border border-hairline bg-surface">
    <div
      v-for="row in rows"
      :key="row.category.id"
      class="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
    >
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
        :style="badgeStyle(row.category.color)"
        aria-hidden="true"
      >
        {{ row.category.icon }}
      </span>

      <button type="button" class="min-w-0 flex-1 text-left" @click="startEdit(row.category)">
        <span class="block truncate text-[15px] text-ink">{{ row.category.name }}</span>
        <span class="block text-xs text-ink-muted">
          {{ row.usage > 0 ? `${row.usage} 笔账目` : '还没用过' }}
        </span>
      </button>

      <!-- 图标 + 名称已经说清身份，删除按钮只需要留在触摸范围内 -->
      <button
        type="button"
        class="-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink-muted active:bg-hairline"
        :aria-label="`删除分类 ${row.category.name}`"
        @click="onDelete(row.category.id, row.category.name)"
      >
        ✕
      </button>
    </div>
  </div>

  <BaseButton class="mt-3" variant="secondary" block @click="startCreate(type)">
    新增{{ type === 'expense' ? '支出' : '收入' }}分类
  </BaseButton>

  <BaseModal :open="open" :title="mode === 'edit' ? '编辑分类' : '新增分类'" @close="open = false">
    <div class="space-y-4">
      <BaseInput v-model="state.name" label="分类名" placeholder="如：餐饮" :error="nameError" />

      <div v-if="typeLocked" class="rounded-xl bg-hairline/60 px-3 py-2 text-sm text-ink-secondary">
        ⓘ 已有分类不能改收支类型：历史账目还带着原来的方向，改了它们会找不到自己。
      </div>
      <div v-else class="grid grid-cols-2 gap-1 rounded-xl bg-hairline/60 p-1">
        <button
          v-for="item in TYPES"
          :key="item.value"
          type="button"
          class="h-9 rounded-lg text-[15px] font-medium transition-colors"
          :class="state.type === item.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary'"
          :aria-pressed="state.type === item.value"
          @click="state.type = item.value"
        >
          {{ item.label }}
        </button>
      </div>

      <EmojiPicker v-model="state.icon" label="图标" :options="iconOptions" />
      <ColorPicker v-model="state.color" label="标识色" :options="BADGE_COLORS" />

      <!-- 删除不放这里：删分类要先看它被多少笔账目引用，那个信息在列表行上 -->
      <div class="flex gap-2">
        <BaseButton variant="secondary" block @click="open = false">取消</BaseButton>
        <BaseButton block @click="save">保存</BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
