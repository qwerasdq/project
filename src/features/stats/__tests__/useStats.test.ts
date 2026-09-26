/**
 * 统计页的数据装配。重点在两处容易出错的地方：
 * 1. **对账** —— 占比条各段之和必须等于本月支出，且与账单页/预算页同一个口径（排除转账、折汇率）。
 * 2. **颜色跟实体走** —— 换个月份、金额排名颠倒后，同一个分类必须还是同一个槽位色。
 */

import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useStats } from '../useStats'
import { useMonth } from '@/composables/useMonth'
import { currentMonth, shiftMonth } from '@/lib/date'
import { monthTotals } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>

let current: Store | null = null
let store: Store

// 跟着当前日期走，不写死月份
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
  useMonth().goTo(MONTH)
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

function spend(name: string, amount: number, occurredAt: string): void {
  store.addTransaction({
    type: 'expense',
    accountId: cashId(),
    categoryId: categoryIdOf(name),
    amount,
    occurredAt,
  })
}

function earn(name: string, amount: number, occurredAt: string): void {
  store.addTransaction({
    type: 'income',
    accountId: cashId(),
    categoryId: categoryIdOf(name),
    amount,
    occurredAt,
  })
}

describe('趋势区间', () => {
  it('默认近 6 个月，以浏览月份为终点', () => {
    const { trend, range } = useStats()

    expect(range.value).toBe(6)
    expect(trend.value).toHaveLength(6)
    expect(trend.value[0]?.month).toBe(shiftMonth(MONTH, -5))
    expect(trend.value[5]?.month).toBe(MONTH)
  })

  it('切到 12 个月后区间随之变长', () => {
    const { trend, range, rangeLabel } = useStats()

    range.value = 12

    expect(trend.value).toHaveLength(12)
    expect(trend.value[0]?.month).toBe(shiftMonth(MONTH, -11))
    // 区间文案的两端就是首尾两点，图上看到的就是标题写的
    const [from, to] = rangeLabel.value.split('–')
    expect(from?.trim()).toBe(trend.value[0]?.label)
    expect(to?.trim()).toBe(trend.value[11]?.label)
  })

  it('没有账目时 hasTrendData 为假', () => {
    expect(useStats().hasTrendData.value).toBe(false)
  })

  it('区间外的月份不计入', () => {
    // 13 个月前的那笔落在近 12 个月之外
    spend('餐饮', 99900, `${shiftMonth(MONTH, -13)}-10`)
    const { trend, hasTrendData } = useStats()

    expect(hasTrendData.value).toBe(false)
    expect(trend.value.every((p) => p.expense === 0)).toBe(true)
  })

  it('每月的收入、支出、结余各自成列', () => {
    earn('工资', 500000, `${MONTH}-05`)
    spend('餐饮', 120000, `${MONTH}-10`)
    spend('餐饮', 30000, `${PREV}-10`)

    const { trend } = useStats()
    const thisMonth = trend.value[5]
    const lastMonth = trend.value[4]

    expect(thisMonth).toMatchObject({ income: 500000, expense: 120000, balance: 380000 })
    expect(lastMonth).toMatchObject({ income: 0, expense: 30000, balance: -30000 })
  })

  it('转账不计入收支', () => {
    store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    const target = store.activeAccounts.find((a) => a.name === '美元卡')
    if (!target) throw new Error('测试夹具缺少账户')
    store.addTransfer({
      fromAccountId: cashId(),
      toAccountId: target.id,
      amount: 100000,
      rate: 0.14,
      occurredAt: `${MONTH}-10`,
    })

    const { trend, hasTrendData } = useStats()

    expect(hasTrendData.value).toBe(false)
    expect(trend.value[5]?.expense).toBe(0)
    expect(trend.value[5]?.income).toBe(0)
  })
})

describe('支出构成', () => {
  it('与月度汇总对账：各段之和等于本月支出', () => {
    spend('餐饮', 120000, `${MONTH}-05`)
    spend('交通', 30000, `${MONTH}-06`)
    spend('购物', 50000, `${MONTH}-07`)
    spend('餐饮', 99900, `${PREV}-05`) // 上月，不该进来

    const { share } = useStats()
    const total = share.value.reduce((sum, item) => sum + item.amount, 0)
    const expected = monthTotals(store.db.transactions, MONTH, store.statsCtx).expense

    expect(total).toBe(expected)
    expect(total).toBe(200000)
  })

  it('占比之和为 1，且按金额降序排列', () => {
    spend('餐饮', 120000, `${MONTH}-05`)
    spend('交通', 30000, `${MONTH}-06`)
    spend('购物', 50000, `${MONTH}-07`)

    const { share } = useStats()

    expect(share.value.map((s) => s.name)).toEqual(['餐饮', '购物', '交通'])
    expect(share.value.reduce((sum, s) => sum + s.percent, 0)).toBeCloseTo(1, 10)
  })

  it('超过 7 个分类时折叠为「其余 N 类」，并用中性色', () => {
    const categories = store.categoriesByType.expense
    expect(categories.length).toBeGreaterThan(7)
    // 每个分类都造一笔，金额递减，让排名完全由金额决定
    categories.forEach((c, i) => {
      store.addTransaction({
        type: 'expense',
        accountId: cashId(),
        categoryId: c.id,
        amount: (categories.length - i) * 1000,
        occurredAt: `${MONTH}-05`,
      })
    })

    const { share } = useStats()
    const folded = share.value[share.value.length - 1]

    expect(share.value).toHaveLength(8)
    expect(folded?.name).toBe('其余 1 类')
    expect(folded?.color).toBe('var(--series-other)')
  })

  it('真实分类名叫「其他」时保留原名，不写成「其余 1 类」', () => {
    spend('其他', 10000, `${MONTH}-05`)

    const { share } = useStats()

    expect(share.value).toHaveLength(1)
    expect(share.value[0]?.name).toBe('其他')
  })

  it('挪到别的月份后各段颜色不变 —— 颜色跟分类实体，不跟金额排名', () => {
    spend('餐饮', 10000, `${MONTH}-05`)
    spend('交通', 90000, `${MONTH}-06`)
    const before = useStats().share.value
    const beforeFood = before.find((s) => s.name === '餐饮')?.color
    const beforeTransport = before.find((s) => s.name === '交通')?.color

    // 把金额排名整个颠倒过来
    store.db.transactions.splice(0)
    spend('餐饮', 90000, `${MONTH}-05`)
    spend('交通', 10000, `${MONTH}-06`)

    const after = useStats().share.value

    expect(after.map((s) => s.name)).toEqual(['餐饮', '交通']) // 排名确实反了
    expect(after.find((s) => s.name === '餐饮')?.color).toBe(beforeFood)
    expect(after.find((s) => s.name === '交通')?.color).toBe(beforeTransport)
  })

  it('段够宽才带百分比标注', () => {
    spend('餐饮', 95000, `${MONTH}-05`)
    spend('交通', 3000, `${MONTH}-06`)
    spend('购物', 2000, `${MONTH}-07`)

    const { share } = useStats()

    expect(share.value.map((s) => s.showPercent)).toEqual([true, false, false])
  })

  it('没有支出的月份返回空数组', () => {
    earn('工资', 500000, `${MONTH}-05`)

    expect(useStats().share.value).toEqual([])
  })

  it('外币支出按汇率折算后计入占比', () => {
    store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    const usd = store.activeAccounts.find((a) => a.name === '美元卡')
    if (!usd) throw new Error('测试夹具缺少账户')
    store.setExchangeRate('USD', 7)
    store.addTransaction({
      type: 'expense',
      accountId: usd.id,
      categoryId: categoryIdOf('餐饮'),
      amount: 1000, // 10 美元
      occurredAt: `${MONTH}-05`,
    })

    const { share } = useStats()

    expect(share.value[0]?.amount).toBe(7000)
  })
})
