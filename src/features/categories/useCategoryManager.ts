/**
 * 分类管理。UI 在 CategoryManager.vue。
 *
 * 分类是**账目的归类依据**，所以有两条硬约束：
 * 1. 被账目引用时拒绝删除 —— 删掉会让历史账目变成无分类的孤儿，统计里的
 *    「未分类」凭空变大，而用户根本不知道是哪几笔。
 * 2. 已有分类不允许改收支类型 —— 它的历史账目带着原来的方向，改了之后
 *    那些账目会挂在一个「收入型」分类下却仍是支出，筛选器里再也找不到它。
 *
 * 账户那边更严：账户连删除都不给（只归档），因为它还决定币种。
 */

import { computed, reactive, ref } from 'vue'

import type { Category, CategoryInput, TransactionType } from '@/types'
import { useDbStore } from '@/stores/db'
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  EXPENSE_CATEGORY_ICONS,
  INCOME_CATEGORY_ICONS,
} from '@/lib/presets'
import { validateName } from '@/lib/validate'

export interface CategoryRow {
  category: Category
  /** 引用该分类的账目条数 */
  usage: number
}

/** 分类列表：按收支类型分页，附带每个分类被引用的次数 */
export function useCategoryManager() {
  const store = useDbStore()
  const type = ref<TransactionType>('expense')

  /** 一次遍历算出所有分类的引用数，避免每个分类各扫一遍账目 */
  const usageByCategory = computed(() => {
    const map = new Map<string, number>()
    for (const tx of store.db.transactions) {
      if (tx.categoryId === null) continue
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + 1)
    }
    return map
  })

  const rows = computed<CategoryRow[]>(() =>
    store.categoriesByType[type.value].map((category) => ({
      category,
      usage: usageByCategory.value.get(category.id) ?? 0,
    })),
  )

  const counts = computed(() => ({
    expense: store.categoriesByType.expense.length,
    income: store.categoriesByType.income.length,
  }))

  /**
   * 删除分类。交给 store 判断能否删除，失败时把原因原样返回给界面。
   * 返回 null 表示删除成功。
   */
  function remove(id: string): string | null {
    return store.deleteCategory(id)
  }

  return { type, rows, counts, remove }
}

/** 新增 / 编辑分类的弹层逻辑 */
export function useCategoryEditor() {
  const store = useDbStore()

  const open = ref(false)
  const editingId = ref<string | null>(null)
  const nameError = ref<string | null>(null)

  const state = reactive({
    name: '',
    type: 'expense' as TransactionType,
    icon: DEFAULT_CATEGORY_ICON,
    color: DEFAULT_CATEGORY_COLOR,
  })

  const editing = computed(() =>
    editingId.value === null ? undefined : store.categoryOf(editingId.value),
  )

  const mode = computed<'create' | 'edit'>(() => (editing.value ? 'edit' : 'create'))

  /** 已有分类锁定收支类型，理由见文件头 */
  const typeLocked = computed(() => mode.value === 'edit')

  /** 图标候选跟着类型走：收入分类里出现「🍜」是没意义的噪音 */
  const iconOptions = computed(() =>
    state.type === 'expense' ? EXPENSE_CATEGORY_ICONS : INCOME_CATEGORY_ICONS,
  )

  function startCreate(type: TransactionType): void {
    editingId.value = null
    state.name = ''
    state.type = type
    state.icon = type === 'expense' ? DEFAULT_CATEGORY_ICON : '💰'
    state.color = DEFAULT_CATEGORY_COLOR
    nameError.value = null
    open.value = true
  }

  function startEdit(category: Category): void {
    editingId.value = category.id
    state.name = category.name
    state.type = category.type
    state.icon = category.icon
    state.color = category.color
    nameError.value = null
    open.value = true
  }

  function save(): boolean {
    const error = validateName(state.name, '分类名', 8)
    if (error) {
      nameError.value = error
      return false
    }

    const name = state.name.trim()
    // 同类型下重名会让记账时的九宫格出现两个一模一样的选项，直接拦住
    const clash = store.categories.some(
      (c) => c.type === state.type && c.name === name && c.id !== editingId.value,
    )
    if (clash) {
      nameError.value = '同类型下已有同名分类'
      return false
    }

    const input: CategoryInput = {
      name,
      type: state.type,
      icon: state.icon,
      color: state.color,
    }

    if (editing.value) store.updateCategory(editing.value.id, input)
    else store.addCategory(input)

    nameError.value = null
    open.value = false
    return true
  }

  return {
    open,
    state,
    nameError,
    editing,
    mode,
    typeLocked,
    iconOptions,
    startCreate,
    startEdit,
    save,
  }
}
