/**
 * 全应用唯一的数据 store。
 *
 * 设计：一个 `reactive<Database>` + `watch(deep)` 自动落盘。任何 action 改完数据，
 * 持久化自动发生，不需要每处手动 save，也不会出现「多个 store 之间状态不同步」。
 *
 * 组件**绝不**直接访问 localStorage，一律经过这里。
 */

import { computed, reactive, watch } from 'vue'
import { defineStore } from 'pinia'

import type {
  Account,
  AccountInput,
  Budget,
  BudgetWarning,
  Category,
  CategoryInput,
  CurrencyCode,
  ExchangeRates,
  Transaction,
  TransactionInput,
  TransactionType,
  TransferInput,
} from '@/types'
import { loadDatabase, resetDatabase, saveDatabase } from '@/db'
import { uid } from '@/lib/id'
import { toMonth, todayISO } from '@/lib/date'
import { budgetLevel, makeStatsCtx, spentByCategory, isTransfer } from '@/lib/stats'

export const useDbStore = defineStore('db', () => {
  const db = reactive(loadDatabase())

  // 深度监听自动持久化。saveDatabase 返回 false 时只记录，不打断交互 ——
  // 存储不可用属于环境问题，弹窗轰炸没有意义。
  watch(
    db,
    () => {
      if (!saveDatabase(db)) {
        console.warn('[MoneyTracker] 本地存储写入失败，数据可能无法保存')
      }
    },
    { deep: true },
  )

  // ---------------- 派生数据 ----------------

  const accounts = computed(() =>
    [...db.accounts].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)),
  )

  /** 未归档账户，记账与转账时可选 */
  const activeAccounts = computed(() => accounts.value.filter((a) => !a.archived))

  const categories = computed(() =>
    [...db.categories].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt),
    ),
  )

  const categoriesByType = computed<Record<TransactionType, Category[]>>(() => ({
    expense: categories.value.filter((c) => c.type === 'expense'),
    income: categories.value.filter((c) => c.type === 'income'),
  }))

  const accountMap = computed(() => new Map(db.accounts.map((a) => [a.id, a])))
  const categoryMap = computed(() => new Map(db.categories.map((c) => [c.id, c])))

  /** 统计上下文：账户币种表 + 汇率，供 lib/stats 的纯函数使用 */
  const statsCtx = computed(() => makeStatsCtx(db.accounts, db.settings.exchangeRates))

  /** 转账记录按 transferId 归组，列表展示时用来标注「转账」 */
  const transferIds = computed(
    () => new Set(db.transactions.filter(isTransfer).map((t) => t.transferId as string)),
  )

  function accountOf(id: string): Account | undefined {
    return accountMap.value.get(id)
  }

  function categoryOf(id: string | null): Category | undefined {
    return id === null ? undefined : categoryMap.value.get(id)
  }

  function currencyOfAccount(accountId: string): CurrencyCode {
    return accountMap.value.get(accountId)?.currency ?? 'CNY'
  }

  // ---------------- 账户 ----------------

  function addAccount(input: AccountInput): Account {
    const account: Account = {
      id: uid(),
      name: input.name.trim(),
      currency: input.currency,
      initialBalance: input.initialBalance,
      icon: input.icon,
      color: input.color,
      archived: false,
      sortOrder: db.accounts.length,
      createdAt: new Date().toISOString(),
    }
    db.accounts.push(account)
    return account
  }

  function updateAccount(id: string, patch: Partial<Omit<Account, 'id' | 'createdAt'>>): void {
    const account = db.accounts.find((a) => a.id === id)
    if (!account) return
    if (patch.name !== undefined) patch.name = patch.name.trim()
    Object.assign(account, patch)
  }

  /** 账户只归档不删除 —— 删除会让历史账目失去币种依据 */
  function setAccountArchived(id: string, archived: boolean): void {
    const account = db.accounts.find((a) => a.id === id)
    if (account) account.archived = archived
  }

  // ---------------- 分类 ----------------

  function addCategory(input: CategoryInput): Category {
    const sameType = db.categories.filter((c) => c.type === input.type)
    const category: Category = {
      id: uid(),
      name: input.name.trim(),
      type: input.type,
      icon: input.icon,
      color: input.color,
      sortOrder: sameType.length,
      createdAt: new Date().toISOString(),
    }
    db.categories.push(category)
    return category
  }

  function updateCategory(id: string, patch: Partial<Omit<Category, 'id' | 'createdAt'>>): void {
    const category = db.categories.find((c) => c.id === id)
    if (!category) return
    if (patch.name !== undefined) patch.name = patch.name.trim()
    Object.assign(category, patch)
  }

  /**
   * 删除分类。被账目引用时拒绝 —— 否则历史账目会变成无分类的孤儿数据。
   * 返回错误信息或 null（成功）。
   */
  function deleteCategory(id: string): string | null {
    const used = db.transactions.some((t) => t.categoryId === id)
    if (used) return '该分类下已有账目，无法删除'
    const budgetUsed = db.budgets.some((b) => b.categoryId === id)
    if (budgetUsed) return '该分类已设置预算，请先删除预算'

    const index = db.categories.findIndex((c) => c.id === id)
    if (index >= 0) db.categories.splice(index, 1)
    return null
  }

  // ---------------- 账目 ----------------

  /** 判断新增一笔支出后是否越过了预算线。跨线才提示，避免每次记账都弹。 */
  function checkBudgetCrossing(
    categoryId: string,
    month: string,
    amountAdded: number,
  ): BudgetWarning | undefined {
    const budget = db.budgets.find((b) => b.categoryId === categoryId && b.month === month)
    if (!budget || budget.limitAmount <= 0) return undefined

    const total = spentByCategory(db.transactions as Transaction[], month, categoryId, statsCtx.value)
    const before = total - amountAdded
    const after = total
    if (after <= before) return undefined

    const levelAfter = budgetLevel(after / budget.limitAmount)
    const levelBefore = budgetLevel(before / budget.limitAmount)
    if (levelAfter === levelBefore || levelAfter === 'normal') return undefined

    const category = categoryOf(categoryId)
    return {
      categoryName: category?.name ?? '该分类',
      ratio: after / budget.limitAmount,
      level: levelAfter,
    }
  }

  function addTransaction(input: TransactionInput): {
    tx: Transaction
    budgetWarning?: BudgetWarning
  } {
    const tx: Transaction = {
      id: uid(),
      type: input.type,
      accountId: input.accountId,
      categoryId: input.categoryId,
      amount: input.amount,
      occurredAt: input.occurredAt,
      createdAt: new Date().toISOString(),
    }
    if (input.note?.trim()) tx.note = input.note.trim()
    db.transactions.push(tx)

    // 记住这次选的账户，下次记账默认选中
    db.settings.lastAccountId = input.accountId

    const budgetWarning =
      input.type === 'expense'
        ? checkBudgetCrossing(input.categoryId, toMonth(input.occurredAt), input.amount)
        : undefined

    return budgetWarning ? { tx, budgetWarning } : { tx }
  }

  function updateTransaction(id: string, patch: Partial<TransactionInput>): void {
    const tx = db.transactions.find((t) => t.id === id)
    if (!tx || isTransfer(tx)) return // 转账记录只读，防止破坏配对
    if (patch.type !== undefined) tx.type = patch.type
    if (patch.accountId !== undefined) tx.accountId = patch.accountId
    if (patch.categoryId !== undefined) tx.categoryId = patch.categoryId
    if (patch.amount !== undefined) tx.amount = patch.amount
    if (patch.occurredAt !== undefined) tx.occurredAt = patch.occurredAt
    if (patch.note !== undefined) tx.note = patch.note.trim() || undefined
  }

  /** 删除账目。若为转账则连带删除配对记录，避免单边残留。 */
  function deleteTransaction(id: string): void {
    const tx = db.transactions.find((t) => t.id === id)
    if (!tx) return

    if (isTransfer(tx)) {
      const transferId = tx.transferId
      for (let i = db.transactions.length - 1; i >= 0; i--) {
        if (db.transactions[i]?.transferId === transferId) db.transactions.splice(i, 1)
      }
      return
    }

    const index = db.transactions.findIndex((t) => t.id === id)
    if (index >= 0) db.transactions.splice(index, 1)
  }

  /**
   * 转账：**原子生成两条记录**（转出为支出、转入为收入），共享 transferId。
   * 金额为正，方向由 type 决定；两条记录的账户币种可以不同，靠 rate 换算。
   */
  function addTransfer(input: TransferInput): { from: Transaction; to: Transaction } {
    const transferId = uid()
    const createdAt = new Date().toISOString()
    const toAmount = Math.round(input.amount * input.rate)

    const from: Transaction = {
      id: uid(),
      type: 'expense',
      accountId: input.fromAccountId,
      categoryId: null,
      amount: input.amount,
      occurredAt: input.occurredAt,
      createdAt,
      transferId,
      transferPeerAccountId: input.toAccountId,
    }
    const to: Transaction = {
      id: uid(),
      type: 'income',
      accountId: input.toAccountId,
      categoryId: null,
      amount: toAmount,
      occurredAt: input.occurredAt,
      createdAt,
      transferId,
      transferPeerAccountId: input.fromAccountId,
    }

    if (input.note?.trim()) {
      from.note = input.note.trim()
      to.note = input.note.trim()
    }

    db.transactions.push(from, to)
    return { from, to }
  }

  // ---------------- 预算 ----------------

  /** 设置某分类某月预算；已存在则更新限额（upsert） */
  function setBudget(categoryId: string, month: string, limitAmount: number): void {
    const existing = db.budgets.find((b) => b.categoryId === categoryId && b.month === month)
    if (existing) {
      existing.limitAmount = limitAmount
      return
    }
    db.budgets.push({
      id: uid(),
      categoryId,
      month,
      limitAmount,
      createdAt: new Date().toISOString(),
    })
  }

  function removeBudget(categoryId: string, month: string): void {
    const index = db.budgets.findIndex((b) => b.categoryId === categoryId && b.month === month)
    if (index >= 0) db.budgets.splice(index, 1)
  }

  function budgetOf(categoryId: string, month: string): Budget | undefined {
    return db.budgets.find((b) => b.categoryId === categoryId && b.month === month)
  }

  // ---------------- 设置 ----------------

  function setExchangeRate(code: CurrencyCode, rate: number | null): void {
    if (rate === null) {
      delete db.settings.exchangeRates[code]
      return
    }
    db.settings.exchangeRates[code] = rate
  }

  function exchangeRates(): ExchangeRates {
    return db.settings.exchangeRates
  }

  /** 清空全部数据并回到种子状态 */
  function resetAll(): void {
    const fresh = resetDatabase()
    Object.assign(db, fresh)
  }

  return {
    // 原始数据（只读使用，改动请走 action）
    db,

    // 派生
    accounts,
    activeAccounts,
    categories,
    categoriesByType,
    accountMap,
    categoryMap,
    statsCtx,
    transferIds,
    accountOf,
    categoryOf,
    currencyOfAccount,

    // 账户
    addAccount,
    updateAccount,
    setAccountArchived,

    // 分类
    addCategory,
    updateCategory,
    deleteCategory,

    // 账目
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addTransfer,

    // 预算
    setBudget,
    removeBudget,
    budgetOf,

    // 设置
    setExchangeRate,
    exchangeRates,
    resetAll,
  }
})

/** 记账表单的默认日期 */
export const DEFAULT_OCCURRED_AT = todayISO
