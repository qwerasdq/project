/**
 * 月度预算的读取与编辑。UI 在 BudgetManager.vue。
 *
 * 预算按月存（Budget.month），限额以主币种计；已花金额由 lib/stats 的
 * budgetProgress 折算汇总，与统计页口径一致（排除转账）。
 */

import { computed, ref, type Ref } from 'vue'

import { useDbStore } from '@/stores/db'
import { formatAmount } from '@/lib/money'
import { shiftMonth } from '@/lib/date'
import { budgetRows } from '@/lib/stats'
import { parseAmountText } from '@/lib/validate'

export function useBudgetManager(month: Ref<string>) {
  const store = useDbStore()

  /** 本月预算行，按已花比例降序（超支的排最前） */
  const rows = computed(() =>
    budgetRows(store.db.transactions, store.db.budgets, month.value, store.categories, store.statsCtx),
  )

  const totalLimit = computed(() => rows.value.reduce((sum, row) => sum + row.progress.limit, 0))
  const totalSpent = computed(() => rows.value.reduce((sum, row) => sum + row.progress.spent, 0))
  const totalRatio = computed(() => (totalLimit.value > 0 ? totalSpent.value / totalLimit.value : 0))

  /** 本月一个预算都没设，但上个月设过 —— 可以把上月的限额搬过来 */
  const lastMonth = computed(() => shiftMonth(month.value, -1))
  const lastMonthRows = computed(() =>
    budgetRows(
      store.db.transactions,
      store.db.budgets,
      lastMonth.value,
      store.categories,
      store.statsCtx,
    ),
  )
  const canCopyLastMonth = computed(
    () => rows.value.length === 0 && lastMonthRows.value.length > 0,
  )

  /**
   * 把上月的限额搬到本月，**只补本月还没有的分类**。
   * 界面上只在「本月一条预算都没有」时才给按钮，所以覆盖不到什么；
   * 但这里仍然不覆盖，避免以后放宽入口时把用户已定的限额悄悄冲掉。
   */
  function copyLastMonth(): number {
    let copied = 0
    for (const row of lastMonthRows.value) {
      const { categoryId, limitAmount } = row.budget
      if (store.budgetOf(categoryId, month.value)) continue
      store.setBudget(categoryId, month.value, limitAmount)
      copied++
    }
    return copied
  }

  return {
    rows,
    totalLimit,
    totalSpent,
    totalRatio,
    lastMonth,
    canCopyLastMonth,
    copyLastMonth,
  }
}

/** 新增 / 修改单条预算的弹层逻辑 */
export function useBudgetEditor(month: Ref<string>) {
  const store = useDbStore()

  const open = ref(false)
  const categoryId = ref('')
  const limitText = ref('')
  // 两个字段各自的错误分开存，界面上才能标在对应的输入框上
  const categoryError = ref<string | null>(null)
  const limitError = ref<string | null>(null)

  const usedCategoryIds = computed(
    () =>
      new Set(
        store.db.budgets.filter((b) => b.month === month.value).map((b) => b.categoryId),
      ),
  )

  /** 已设置过预算的分类不再出现在新增列表里，避免「添加」变成「覆盖」 */
  const categoryOptions = computed(() =>
    store.categoriesByType.expense
      .filter((c) => !usedCategoryIds.value.has(c.id) || c.id === categoryId.value)
      .map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` })),
  )

  /** 编辑已有预算时分类不可改：改成另一个分类等于把限额挪走，语义混乱 */
  const categoryLocked = computed(
    () => categoryId.value !== '' && usedCategoryIds.value.has(categoryId.value),
  )

  /** 全部支出分类都已设过预算时，没有可新增的对象 */
  const canCreate = computed(() => categoryOptions.value.length > 0)

  const existing = computed(() =>
    categoryId.value ? store.budgetOf(categoryId.value, month.value) : undefined,
  )

  function clearErrors(): void {
    categoryError.value = null
    limitError.value = null
  }

  function startCreate(): void {
    categoryId.value = ''
    limitText.value = ''
    clearErrors()
    open.value = true
  }

  function startEdit(id: string): void {
    const budget = store.budgetOf(id, month.value)
    categoryId.value = id
    limitText.value = budget ? formatAmount(budget.limitAmount) : ''
    clearErrors()
    open.value = true
  }

  function save(): boolean {
    clearErrors()
    if (!categoryId.value) {
      categoryError.value = '请选择分类'
      return false
    }
    const parsed = parseAmountText(limitText.value)
    if (!parsed.ok) {
      limitError.value = parsed.error
      return false
    }
    store.setBudget(categoryId.value, month.value, parsed.value)
    open.value = false
    return true
  }

  function remove(): void {
    if (!categoryId.value) return
    store.removeBudget(categoryId.value, month.value)
    clearErrors()
    open.value = false
  }

  return {
    open,
    categoryId,
    limitText,
    categoryError,
    limitError,
    categoryOptions,
    categoryLocked,
    canCreate,
    existing,
    startCreate,
    startEdit,
    save,
    remove,
  }
}
