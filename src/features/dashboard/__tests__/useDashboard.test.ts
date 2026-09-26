import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useDashboard } from '../useDashboard'
import { currentMonth, shiftMonth } from '@/lib/date'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>

let current: Store | null = null
let store: Store

// 首页看的是自然月，用例跟着当前日期走，不写死月份
const MONTH = currentMonth()
const PREV = shiftMonth(MONTH, -1)

beforeEach(async () => {
  current?.$dispose()
  current = null
  await nextTick()
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  current = store
})

function cashId(): string {
  const a = store.activeAccounts[0]
  if (!a) throw new Error('测试夹具缺少账户')
  return a.id
}

function categoryIdOf(name: string): string {
  const c = store.categories.find((x) => x.name === name)
  if (!c) throw new Error(`测试夹具缺少分类：${name}`)
  return c.id
}

function record(
  type: 'income' | 'expense',
  amount: number,
  occurredAt: string,
): string {
  const categoryName = type === 'expense' ? '餐饮' : '工资'
  const { tx } = store.addTransaction({
    type,
    accountId: cashId(),
    categoryId: categoryIdOf(categoryName),
    amount,
    occurredAt,
  })
  return tx.id
}

describe('本月汇总', () => {
  it('只看当前月，上月数据不混进来', () => {
    record('expense', 10000, `${MONTH}-05`)
    record('expense', 99900, `${PREV}-05`)

    const { totals } = useDashboard()

    expect(totals.value.expense).toBe(10000)
  })

  it('结余 = 收入 - 支出', () => {
    record('income', 500000, `${MONTH}-10`)
    record('expense', 120000, `${MONTH}-11`)

    const { totals } = useDashboard()

    expect(totals.value).toEqual({ income: 500000, expense: 120000, balance: 380000 })
  })
})

describe('较上月环比', () => {
  it('上月没有支出时无从比较，返回 null', () => {
    record('expense', 10000, `${MONTH}-05`)

    const { expenseDelta } = useDashboard()

    expect(expenseDelta.value).toBeNull()
  })

  it('支出变多时为正', () => {
    record('expense', 10000, `${PREV}-05`)
    record('expense', 15000, `${MONTH}-05`)

    const { expenseDelta } = useDashboard()

    expect(expenseDelta.value).toBeCloseTo(0.5)
  })

  it('支出变少时为负', () => {
    record('expense', 20000, `${PREV}-05`)
    record('expense', 10000, `${MONTH}-05`)

    const { expenseDelta } = useDashboard()

    expect(expenseDelta.value).toBeCloseTo(-0.5)
  })
})

describe('最近记录', () => {
  it('按发生日期倒序', () => {
    record('expense', 100, `${MONTH}-01`)
    record('expense', 200, `${MONTH}-20`)
    record('expense', 300, `${MONTH}-10`)

    const { recent } = useDashboard()

    expect(recent.value.map((t) => t.amount)).toEqual([200, 300, 100])
  })

  it('同一天按记录时间倒序', () => {
    const first = record('expense', 100, `${MONTH}-10`)
    const second = record('expense', 200, `${MONTH}-10`)

    // 同一毫秒内写入会让排序退化，这里显式拉开时间戳
    const a = store.db.transactions.find((t) => t.id === first)
    const b = store.db.transactions.find((t) => t.id === second)
    if (!a || !b) throw new Error('记录没有写入 store')
    a.createdAt = `${MONTH}-10T01:00:00.000Z`
    b.createdAt = `${MONTH}-10T02:00:00.000Z`

    const { recent } = useDashboard()

    expect(recent.value.map((t) => t.amount)).toEqual([200, 100])
  })

  it('默认只取 5 笔', () => {
    for (let i = 1; i <= 8; i++) {
      record('expense', i * 100, `${MONTH}-0${i}`)
    }

    const { recent } = useDashboard()

    expect(recent.value).toHaveLength(5)
    expect(recent.value[0]?.amount).toBe(800)
  })

  it('没有任何账目时为空', () => {
    const { recent, hasAnyTransaction } = useDashboard()

    expect(recent.value).toEqual([])
    expect(hasAnyTransaction.value).toBe(false)
  })
})
