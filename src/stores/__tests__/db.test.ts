import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { CategoryInput, TransactionInput } from '@/types'
import { DB_KEY } from '@/db'
import { useDbStore } from '../db'

// ---------------- 工具 ----------------

type Store = ReturnType<typeof useDbStore>

/**
 * store 的 watch 是异步落盘的（flush: 'pre'），若不在用例之间显式销毁，
 * 上一个用例挂起的写入会落回 localStorage，污染下一个用例。
 * 所以这里在每个用例开始前：销毁旧 store → 等挂起写入落地 → 清空存储。
 */
let current: Store | null = null

beforeEach(async () => {
  current?.$dispose()
  current = null
  await nextTick()
  localStorage.clear()
})

function setup(): Store {
  setActivePinia(createPinia())
  const store = useDbStore()
  current = store
  return store
}

/** 销毁当前 store 后重新打开，模拟「刷新页面」 */
async function reopen(): Promise<Store> {
  await nextTick() // 先让挂起的写入落地，再销毁（销毁会取消未执行的 watcher）
  current?.$dispose()
  await nextTick()
  return setup()
}

/** 取种子数据里的分类 id */
function categoryIdOf(store: Store, name: string): string {
  const c = store.categories.find((x) => x.name === name)
  if (!c) throw new Error(`测试夹具缺少分类：${name}`)
  return c.id
}

function cashIdOf(store: Store): string {
  const a = store.activeAccounts[0]
  if (!a) throw new Error('测试夹具缺少账户')
  return a.id
}

function expenseInput(store: Store, over: Partial<TransactionInput> = {}): TransactionInput {
  return {
    type: 'expense',
    accountId: cashIdOf(store),
    categoryId: categoryIdOf(store, '餐饮'),
    amount: 1000,
    occurredAt: '2026-09-15',
    ...over,
  }
}

// ---------------- 初始化 ----------------

describe('store 初始化', () => {
  it('首次使用生成种子数据', () => {
    const store = setup()
    expect(store.accounts).toHaveLength(1)
    expect(store.categories).toHaveLength(12)
    expect(store.db.transactions).toEqual([])
  })

  it('已有数据时读取已有数据而非重新播种', async () => {
    const first = setup()
    first.addAccount({
      name: '招行卡',
      currency: 'CNY',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })

    const second = await reopen()
    expect(second.accounts.map((a) => a.name)).toEqual(['现金', '招行卡'])
  })

  it('数据损坏时回退到种子数据并不抛异常', () => {
    localStorage.setItem(DB_KEY, '{ 这不是合法 JSON')
    expect(() => setup()).not.toThrow()
    expect(current?.accounts).toHaveLength(1)
  })

  it('损坏的原始数据被备份而非直接丢弃', () => {
    localStorage.setItem(DB_KEY, '{ 这不是合法 JSON')
    setup()
    expect(localStorage.getItem('moneytracker:db:backup')).toBe('{ 这不是合法 JSON')
  })
})

// ---------------- 持久化 ----------------

describe('自动持久化', () => {
  it('改动后自动写入 localStorage', async () => {
    const store = setup()
    store.addAccount({ name: '招行卡', currency: 'CNY', initialBalance: 0, icon: '💳', color: '#2a78d6' })
    await nextTick()

    const raw = localStorage.getItem(DB_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as { accounts: { name: string }[] }
    expect(parsed.accounts.map((a) => a.name)).toEqual(['现金', '招行卡'])
  })

  it('嵌套改动（修改备注）也会落盘', async () => {
    const store = setup()
    const { tx } = store.addTransaction(expenseInput(store))
    await nextTick()
    store.updateTransaction(tx.id, { note: '午饭' })
    await nextTick()

    const parsed = JSON.parse(localStorage.getItem(DB_KEY) as string) as {
      transactions: { note?: string }[]
    }
    expect(parsed.transactions[0]?.note).toBe('午饭')
  })
})

// ---------------- 账户 ----------------

describe('账户', () => {
  it('新增账户并记录币种', () => {
    const store = setup()
    const account = store.addAccount({
      name: '  美元账户  ',
      currency: 'USD',
      initialBalance: 10000,
      icon: '💵',
      color: '#1baf7a',
    })
    expect(account.name).toBe('美元账户') // 自动 trim
    expect(account.currency).toBe('USD')
    expect(account.archived).toBe(false)
    expect(store.accounts).toHaveLength(2)
  })

  it('重名不做限制（不同币种同名是合理的）', () => {
    const store = setup()
    store.addAccount({ name: '现金', currency: 'USD', initialBalance: 0, icon: '💵', color: '#2a78d6' })
    expect(store.accounts.filter((a) => a.name === '现金')).toHaveLength(2)
  })

  it('归档后不在可选账户中出现，但仍在完整列表里', () => {
    const store = setup()
    const id = cashIdOf(store)
    store.setAccountArchived(id, true)

    expect(store.activeAccounts).toHaveLength(0)
    expect(store.accounts).toHaveLength(1)
  })

  it('归档可撤销', () => {
    const store = setup()
    const id = cashIdOf(store)
    store.setAccountArchived(id, true)
    store.setAccountArchived(id, false)
    expect(store.activeAccounts).toHaveLength(1)
  })

  it('更新账户时名称自动 trim', () => {
    const store = setup()
    const id = cashIdOf(store)
    store.updateAccount(id, { name: '  钱包  ' })
    expect(store.accountOf(id)?.name).toBe('钱包')
  })

  it('更新不存在的账户是安全空操作', () => {
    const store = setup()
    expect(() => store.updateAccount('不存在', { name: 'x' })).not.toThrow()
  })
})

// ---------------- 分类 ----------------

describe('分类', () => {
  it('新增分类追加到同类末尾', () => {
    const store = setup()
    const input: CategoryInput = {
      name: '宠物',
      type: 'expense',
      icon: '🐱',
      color: '#eda100',
    }
    const category = store.addCategory(input)
    expect(category.sortOrder).toBe(8) // 已有 8 个支出分类
    expect(store.categoriesByType.expense).toHaveLength(9)
    expect(store.categoriesByType.income).toHaveLength(4)
  })

  it('未被引用的分类可以删除', () => {
    const store = setup()
    const category = store.addCategory({ name: '宠物', type: 'expense', icon: '🐱', color: '#eda100' })
    expect(store.deleteCategory(category.id)).toBeNull()
    expect(store.categoryOf(category.id)).toBeUndefined()
  })

  it('被账目引用的分类拒绝删除', () => {
    const store = setup()
    store.addTransaction(expenseInput(store))
    const id = categoryIdOf(store, '餐饮')
    expect(store.deleteCategory(id)).toBe('该分类下已有账目，无法删除')
    expect(store.categoryOf(id)).toBeDefined()
  })

  it('已设置预算的分类拒绝删除', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    expect(store.deleteCategory(id)).toBe('该分类已设置预算，请先删除预算')
  })

  it('删除转账记录不会误伤分类引用判断（转账无分类）', () => {
    const store = setup()
    const from = cashIdOf(store)
    const to = store.addAccount({
      name: '招行卡',
      currency: 'CNY',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    }).id
    store.addTransfer({ fromAccountId: from, toAccountId: to, amount: 1000, rate: 1, occurredAt: '2026-09-15' })
    expect(store.deleteCategory(categoryIdOf(store, '餐饮'))).toBeNull()
  })
})

// ---------------- 记账 ----------------

describe('记一笔', () => {
  it('写入账目并记住所选账户', () => {
    const store = setup()
    const { tx } = store.addTransaction(expenseInput(store))
    expect(tx.amount).toBe(1000)
    expect(tx.type).toBe('expense')
    expect(tx.transferId).toBeUndefined()
    expect(store.db.transactions).toHaveLength(1)
    expect(store.db.settings.lastAccountId).toBe(tx.accountId)
  })

  it('备注做 trim，空备注不写入字段', () => {
    const store = setup()
    const a = store.addTransaction(expenseInput(store, { note: '  午饭  ' })).tx
    const b = store.addTransaction(expenseInput(store, { note: '   ' })).tx
    expect(a.note).toBe('午饭')
    expect(b.note).toBeUndefined()
  })

  it('记为转账的记录带 transferId，可以区分', () => {
    const store = setup()
    store.addTransaction(expenseInput(store))
    expect(store.transferIds.size).toBe(0)
  })

  it('编辑账目', () => {
    const store = setup()
    const { tx } = store.addTransaction(expenseInput(store))
    store.updateTransaction(tx.id, { amount: 2500, note: '改过了' })
    const updated = store.db.transactions.find((t) => t.id === tx.id)
    expect(updated?.amount).toBe(2500)
    expect(updated?.note).toBe('改过了')
  })

  it('删除账目', () => {
    const store = setup()
    const { tx } = store.addTransaction(expenseInput(store))
    store.deleteTransaction(tx.id)
    expect(store.db.transactions).toHaveLength(0)
  })

  it('删除不存在的账目是安全空操作', () => {
    const store = setup()
    expect(() => store.deleteTransaction('不存在')).not.toThrow()
  })
})

// ---------------- 转账 ----------------

describe('转账', () => {
  function twoAccounts(store: Store): { from: string; to: string } {
    const from = cashIdOf(store)
    const to = store.addAccount({
      name: '美元账户',
      currency: 'USD',
      initialBalance: 0,
      icon: '💵',
      color: '#1baf7a',
    }).id
    return { from, to }
  }

  it('原子生成两条记录，共享 transferId', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { from: out, to: into } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 0.14,
      occurredAt: '2026-09-15',
    })

    expect(store.db.transactions).toHaveLength(2)
    expect(out.type).toBe('expense')
    expect(into.type).toBe('income')
    expect(out.transferId).toBe(into.transferId)
    expect(out.categoryId).toBeNull()
    expect(into.categoryId).toBeNull()
  })

  it('按汇率换算转入金额', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { to: into } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 100000, // 1000 元
      rate: 0.14, // 1 元 = 0.14 美元
      occurredAt: '2026-09-15',
    })
    expect(into.amount).toBe(14000) // 140 美元
  })

  it('记录转账对方账户，便于列表展示', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { from: out, to: into } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 1,
      occurredAt: '2026-09-15',
    })
    expect(out.transferPeerAccountId).toBe(to)
    expect(into.transferPeerAccountId).toBe(from)
  })

  it('同币种转账 rate 为 1，金额相等', () => {
    const store = setup()
    const from = cashIdOf(store)
    const to = store.addAccount({
      name: '招行卡',
      currency: 'CNY',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    }).id
    const { from: out, to: into } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 5000,
      rate: 1,
      occurredAt: '2026-09-15',
    })
    expect(out.amount).toBe(into.amount)
  })

  it('删除任一条都连带删除配对记录', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { from: out } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 1,
      occurredAt: '2026-09-15',
    })

    store.deleteTransaction(out.id)
    expect(store.db.transactions).toHaveLength(0)
  })

  it('从转入侧删除同样连带删除配对', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { to: into } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 1,
      occurredAt: '2026-09-15',
    })
    store.deleteTransaction(into.id)
    expect(store.db.transactions).toHaveLength(0)
  })

  it('删除转账不影响普通账目', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    store.addTransaction(expenseInput(store))
    const { from: out } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 1,
      occurredAt: '2026-09-15',
    })

    store.deleteTransaction(out.id)
    expect(store.db.transactions).toHaveLength(1)
    expect(store.db.transactions[0]?.transferId).toBeUndefined()
  })

  it('转账记录不可编辑（防止破坏配对）', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { from: out } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 1,
      occurredAt: '2026-09-15',
    })

    store.updateTransaction(out.id, { amount: 99999 })
    expect(store.db.transactions.find((t) => t.id === out.id)?.amount).toBe(10000)
  })

  it('备注同时写入两侧记录', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { from: out, to: into } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 1,
      occurredAt: '2026-09-15',
      note: '换汇',
    })
    expect(out.note).toBe('换汇')
    expect(into.note).toBe('换汇')
  })

  it('transferIds 能识别出转账记录', () => {
    const store = setup()
    const { from, to } = twoAccounts(store)
    const { from: out } = store.addTransfer({
      fromAccountId: from,
      toAccountId: to,
      amount: 10000,
      rate: 1,
      occurredAt: '2026-09-15',
    })
    expect(store.transferIds.has(out.transferId as string)).toBe(true)
  })
})

// ---------------- 预算 ----------------

describe('预算', () => {
  it('设置预算', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 200000)
    expect(store.budgetOf(id, '2026-09')?.limitAmount).toBe(200000)
  })

  it('重复设置同一分类同一月为更新而非新增', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 200000)
    store.setBudget(id, '2026-09', 300000)
    expect(store.db.budgets).toHaveLength(1)
    expect(store.budgetOf(id, '2026-09')?.limitAmount).toBe(300000)
  })

  it('不同月份各自独立', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 200000)
    store.setBudget(id, '2026-10', 300000)
    expect(store.db.budgets).toHaveLength(2)
  })

  it('删除预算', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 200000)
    store.removeBudget(id, '2026-09')
    expect(store.budgetOf(id, '2026-09')).toBeUndefined()
  })
})

// ---------------- 预算提醒 ----------------

describe('记账时的预算提醒', () => {
  it('未设预算时不提醒', () => {
    const store = setup()
    const result = store.addTransaction(expenseInput(store, { amount: 999999 }))
    expect(result.budgetWarning).toBeUndefined()
  })

  it('未达 80% 不提醒', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    const result = store.addTransaction(expenseInput(store, { amount: 50000 }))
    expect(result.budgetWarning).toBeUndefined()
  })

  it('越过 80% 时提醒 warning', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    const result = store.addTransaction(expenseInput(store, { amount: 85000 }))
    expect(result.budgetWarning?.level).toBe('warning')
    expect(result.budgetWarning?.categoryName).toBe('餐饮')
  })

  it('越过 100% 时提醒 over', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    const result = store.addTransaction(expenseInput(store, { amount: 120000 }))
    expect(result.budgetWarning?.level).toBe('over')
  })

  it('已在超支状态继续记账不再重复提醒（跨线才提示）', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    store.addTransaction(expenseInput(store, { amount: 120000 }))
    const second = store.addTransaction(expenseInput(store, { amount: 10000 }))
    expect(second.budgetWarning).toBeUndefined()
  })

  it('已有 70% 再记一笔刚好越过 80% 时提醒', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    store.addTransaction(expenseInput(store, { amount: 70000 }))
    const second = store.addTransaction(expenseInput(store, { amount: 15000 }))
    expect(second.budgetWarning?.level).toBe('warning')
  })

  it('收入不触发预算提醒', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    const result = store.addTransaction(
      expenseInput(store, { type: 'income', amount: 500000, categoryId: categoryIdOf(store, '工资') }),
    )
    expect(result.budgetWarning).toBeUndefined()
  })

  it('只统计同月支出', () => {
    const store = setup()
    const id = categoryIdOf(store, '餐饮')
    store.setBudget(id, '2026-09', 100000)
    store.addTransaction(expenseInput(store, { amount: 90000, occurredAt: '2026-08-15' }))
    const result = store.addTransaction(expenseInput(store, { amount: 10000 }))
    expect(result.budgetWarning).toBeUndefined()
  })
})

// ---------------- 设置 ----------------

describe('汇率与重置', () => {
  it('设置与清除汇率', () => {
    const store = setup()
    store.setExchangeRate('USD', 7.2)
    expect(store.exchangeRates()['USD']).toBe(7.2)

    store.setExchangeRate('USD', null)
    expect(store.exchangeRates()['USD']).toBeUndefined()
  })

  it('重置回到种子状态', () => {
    const store = setup()
    store.addTransaction(expenseInput(store))
    store.addAccount({ name: '招行卡', currency: 'CNY', initialBalance: 0, icon: '💳', color: '#2a78d6' })

    store.resetAll()
    expect(store.accounts).toHaveLength(1)
    expect(store.accounts[0]?.name).toBe('现金')
    expect(store.db.transactions).toHaveLength(0)
    expect(store.db.budgets).toHaveLength(0)
  })

  it('重置后账户与分类 id 是全新的', () => {
    const store = setup()
    const before = cashIdOf(store)
    store.resetAll()
    expect(cashIdOf(store)).not.toBe(before)
  })
})

// ---------------- 派生数据 ----------------

describe('派生数据', () => {
  it('分类按类型拆分', () => {
    const store = setup()
    expect(store.categoriesByType.expense).toHaveLength(8)
    expect(store.categoriesByType.income).toHaveLength(4)
    expect(store.categoriesByType.expense.every((c) => c.type === 'expense')).toBe(true)
  })

  it('statsCtx 带上账户币种表', () => {
    const store = setup()
    const usd = store.addAccount({
      name: '美元账户',
      currency: 'USD',
      initialBalance: 0,
      icon: '💵',
      color: '#1baf7a',
    })
    expect(store.statsCtx.accountCurrency[usd.id]).toBe('USD')
  })

  it('currencyOfAccount 未知账户兜底为 CNY', () => {
    const store = setup()
    expect(store.currencyOfAccount('不存在')).toBe('CNY')
  })

  it('categoryOf(null) 返回 undefined 而非报错', () => {
    const store = setup()
    expect(store.categoryOf(null)).toBeUndefined()
  })
})
