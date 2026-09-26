/**
 * 记一笔 / 编辑账目的表单逻辑。UI 在 TransactionForm.vue。
 *
 * 三种模式：
 * - create   新建
 * - edit     编辑已有普通账目
 * - readonly 查看转账记录（只读，引导用户删除重建，避免破坏成对记录）
 */

import { computed, reactive, ref, watch } from 'vue'

import type { BudgetWarning, Transaction, TransactionType } from '@/types'
import { useDbStore } from '@/stores/db'
import { todayISO } from '@/lib/date'
import { formatAmount } from '@/lib/money'
import { isTransfer } from '@/lib/stats'
import { parseAmountText, validateDate, validateNote } from '@/lib/validate'

export type TransactionFormMode = 'create' | 'edit' | 'readonly'

export interface TransactionFormErrors {
  amount: string | null
  category: string | null
  account: string | null
  date: string | null
  note: string | null
}

export interface SubmitOutcome {
  ok: boolean
  budgetWarning?: BudgetWarning
}

export function useTransactionForm(transactionId: () => string | undefined) {
  const store = useDbStore()

  const existing = computed<Transaction | undefined>(() => {
    const id = transactionId()
    return id ? store.db.transactions.find((t) => t.id === id) : undefined
  })

  const mode = computed<TransactionFormMode>(() => {
    const tx = existing.value
    if (!tx) return 'create'
    return isTransfer(tx) ? 'readonly' : 'edit'
  })

  const state = reactive({
    type: 'expense' as TransactionType,
    amountText: '',
    categoryId: '',
    accountId: '',
    occurredAt: todayISO(),
    note: '',
  })

  const errors = reactive<TransactionFormErrors>({
    amount: null,
    category: null,
    account: null,
    date: null,
    note: null,
  })

  const submitting = ref(false)

  /** 当前收支方向下可选的分类 */
  const categories = computed(() => store.categoriesByType[state.type])

  /** 可选账户：编辑时即使账户已归档也要能被选中，否则历史账目无法保存 */
  const selectableAccounts = computed(() => {
    const list = [...store.activeAccounts]
    const current = existing.value ? store.accountOf(existing.value.accountId) : undefined
    if (current && current.archived && !list.some((a) => a.id === current.id)) list.push(current)
    return list
  })

  const selectedCategory = computed(() => store.categoryOf(state.categoryId || null))

  /** 转账记录没有分类，无法编辑 */
  const readonlyReason = computed(() =>
    mode.value === 'readonly'
      ? '转账记录不可直接编辑，如需修改请删除后重新转账。'
      : '',
  )

  function clearErrors(): void {
    errors.amount = null
    errors.category = null
    errors.account = null
    errors.date = null
    errors.note = null
  }

  /** 用已有账目填充表单（编辑模式） */
  function loadFrom(tx: Transaction): void {
    state.type = tx.type
    state.amountText = formatAmount(tx.amount)
    state.categoryId = tx.categoryId ?? ''
    state.accountId = tx.accountId
    state.occurredAt = tx.occurredAt
    state.note = tx.note ?? ''
    clearErrors()
  }

  /** 新建模式的默认值：记住上次选的账户 */
  function applyDefaults(): void {
    const preferred = store.db.settings.lastAccountId
    const available = store.activeAccounts
    const fallback = available[0]?.id ?? ''
    state.accountId = available.some((a) => a.id === preferred) ? (preferred as string) : fallback
    state.occurredAt = todayISO()
    state.categoryId = ''
    state.amountText = ''
    state.note = ''
    clearErrors()
  }

  // 进入编辑模式时载入原值；新建模式则套用默认值
  watch(
    existing,
    (tx) => {
      if (tx) loadFrom(tx)
      else applyDefaults()
    },
    { immediate: true },
  )

  /*
   * 收支方向变化后，已选分类若不属于新方向就必须清掉——否则会存出
   * 「收入账目挂着支出分类」的脏数据（分类网格里也看不到它，用户无从察觉）。
   *
   * 判据是「分类是否仍在可选列表里」而非「是否切换了方向」：编辑模式载入原值时
   * 类型和分类一起变，此时分类仍然合法，不该被清掉。
   */
  watch(
    () => state.type,
    () => {
      if (!state.categoryId) return
      if (categories.value.some((c) => c.id === state.categoryId)) return
      state.categoryId = ''
      errors.category = null
    },
  )

  function validate(): boolean {
    clearErrors()

    const amount = parseAmountText(state.amountText)
    if (!amount.ok) errors.amount = amount.error

    if (!state.categoryId) errors.category = '请选择分类'
    if (!state.accountId) errors.account = '请选择账户'

    const dateError = validateDate(state.occurredAt)
    if (dateError) errors.date = dateError

    const noteError = validateNote(state.note)
    if (noteError) errors.note = noteError

    return !errors.amount && !errors.category && !errors.account && !errors.date && !errors.note
  }

  function submit(): SubmitOutcome {
    if (mode.value === 'readonly') return { ok: false }
    if (!validate()) return { ok: false }

    const amount = parseAmountText(state.amountText)
    if (!amount.ok) return { ok: false }

    const payload = {
      type: state.type,
      accountId: state.accountId,
      categoryId: state.categoryId,
      amount: amount.value,
      note: state.note,
      occurredAt: state.occurredAt,
    }

    submitting.value = true
    try {
      if (mode.value === 'edit') {
        const tx = existing.value
        if (!tx) return { ok: false }
        store.updateTransaction(tx.id, payload)
        return { ok: true }
      }

      const { budgetWarning } = store.addTransaction(payload)
      return budgetWarning ? { ok: true, budgetWarning } : { ok: true }
    } finally {
      submitting.value = false
    }
  }

  /** 「保存并再记一笔」：保留方向、账户、日期，清掉金额、分类、备注 */
  function resetForNext(): void {
    state.amountText = ''
    state.categoryId = ''
    state.note = ''
    clearErrors()
  }

  function remove(): boolean {
    const tx = existing.value
    if (!tx) return false
    store.deleteTransaction(tx.id)
    return true
  }

  return {
    state,
    errors,
    mode,
    existing,
    categories,
    selectableAccounts,
    selectedCategory,
    readonlyReason,
    submitting,
    validate,
    submit,
    resetForNext,
    remove,
  }
}
