import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTransactionFilters } from '../useTransactionFilters'
import { useMonth } from '@/composables/useMonth'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>
type Filters = ReturnType<typeof useTransactionFilters>

let current: Store | null = null
let store: Store

const MONTH = '2026-09'

beforeEach(async () => {
  current?.$dispose()
  current = null
  await nextTick()
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  current = store
  useMonth().goTo(MONTH)
})

function categoryIdOf(name: string): string {
  const c = store.categories.find((x) => x.name === name)
  if (!c) throw new Error(`测试夹具缺少分类：${name}`)
  return c.id
}

function cashId(): string {
  const a = store.activeAccounts[0]
  if (!a) throw new Error('测试夹具缺少账户')
  return a.id
}

function add(
  type: 'income' | 'expense',
  amount: number,
  occurredAt: string,
  categoryName = '餐饮',
): void {
  store.addTransaction({
    type,
    accountId: cashId(),
    categoryId: categoryIdOf(categoryName),
    amount,
    occurredAt,
  })
}

function setup(): Filters {
  return useTransactionFilters()
}

describe('月份范围', () => {
  it('只取当月账目，跨月的不进列表也不进合计', () => {
    add('expense', 1000, '2026-09-05')
    add('expense', 2000, '2026-08-31')
    add('expense', 4000, '2026-10-01')

    const filters = setup()

    expect(filters.filtered.value).toHaveLength(1)
    expect(filters.totals.value).toEqual({ income: 0, expense: 1000, balance: -1000 })
  })

  it('切月份后列表跟着变', async () => {
    add('expense', 1000, '2026-09-05')
    add('expense', 2000, '2026-08-05')
    const filters = setup()

    useMonth().goTo('2026-08')
    await nextTick()

    expect(filters.filtered.value).toHaveLength(1)
    expect(filters.totals.value.expense).toBe(2000)
  })
})

describe('筛选', () => {
  it('按类型筛选', () => {
    add('expense', 1000, '2026-09-05')
    add('income', 3000, '2026-09-06')
    const filters = setup()

    filters.type.value = 'income'

    expect(filters.filtered.value).toHaveLength(1)
    expect(filters.totals.value).toEqual({ income: 3000, expense: 0, balance: 3000 })
  })

  it('按分类筛选', () => {
    add('expense', 1000, '2026-09-05', '餐饮')
    add('expense', 2000, '2026-09-06', '交通')
    const filters = setup()

    filters.categoryId.value = categoryIdOf('交通')

    expect(filters.filtered.value).toHaveLength(1)
    expect(filters.totals.value.expense).toBe(2000)
  })

  it('切换类型会清空已选分类，避免筛出空结果', async () => {
    const filters = setup()
    filters.categoryId.value = categoryIdOf('餐饮')

    filters.type.value = 'income'
    await nextTick() // 清空是 watcher 干的，pre-flush 异步执行

    expect(filters.categoryId.value).toBe('')
  })

  it('筛选后无结果时 groups 为空但 hasFilter 为真', () => {
    add('expense', 1000, '2026-09-05')
    const filters = setup()

    filters.type.value = 'income'

    expect(filters.groups.value).toEqual([])
    expect(filters.hasFilter.value).toBe(true)
    expect(filters.isEmpty.value).toBe(false)
  })

  it('分类下拉首项是「全部分类」，并随方向收敛', async () => {
    const filters = setup()
    expect(filters.categoryOptions.value[0]).toEqual({ value: '', label: '全部分类' })
    const all = filters.categoryOptions.value.length

    filters.type.value = 'expense'
    await nextTick()

    // 8 个支出分类 + 「全部分类」
    expect(filters.categoryOptions.value).toHaveLength(9)
    expect(all).toBe(13)
  })
})

describe('分组', () => {
  it('按日期倒序分组，每组带当日收支', () => {
    add('expense', 1000, '2026-09-05')
    add('expense', 2000, '2026-09-20')
    add('income', 5000, '2026-09-20')

    const groups = setup().groups.value

    expect(groups.map((g) => g.date)).toEqual(['2026-09-20', '2026-09-05'])
    expect(groups[0]).toMatchObject({
      label: '9月20日 周日',
      income: 5000,
      expense: 2000,
      balance: 3000,
    })
    expect(groups[0]?.txs).toHaveLength(2)
    expect(groups[1]?.txs).toHaveLength(1)
  })
})

describe('转账', () => {
  it('转账进列表，但不计入合计', () => {
    store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    const target = store.activeAccounts.find((a) => a.name === '美元卡')
    if (!target) throw new Error('测试夹具缺少账户')

    add('expense', 1000, '2026-09-05')
    store.addTransfer({
      fromAccountId: cashId(),
      toAccountId: target.id,
      amount: 10000,
      rate: 0.14,
      occurredAt: '2026-09-06',
    })

    const filters = setup()

    expect(filters.filtered.value).toHaveLength(3) // 1 笔支出 + 转账两条
    expect(filters.totals.value).toEqual({ income: 0, expense: 1000, balance: -1000 })
  })
})

describe('空状态', () => {
  it('当月一笔都没有时 isEmpty 为真', () => {
    const filters = setup()

    expect(filters.isEmpty.value).toBe(true)
    expect(filters.groups.value).toEqual([])
    expect(filters.hasFilter.value).toBe(false)
  })

  it('reset 清掉全部筛选条件', () => {
    add('expense', 1000, '2026-09-05')
    const filters = setup()
    filters.type.value = 'expense'
    filters.categoryId.value = categoryIdOf('餐饮')

    filters.reset()

    expect(filters.type.value).toBe('all')
    expect(filters.categoryId.value).toBe('')
    expect(filters.hasFilter.value).toBe(false)
  })
})
