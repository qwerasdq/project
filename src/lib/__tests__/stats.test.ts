import { describe, expect, it } from 'vitest'

import type { Account, Budget, Category, Transaction } from '@/types'
import {
  accountBalance,
  budgetLevel,
  budgetProgress,
  budgetRows,
  categoryBreakdown,
  isTransfer,
  makeStatsCtx,
  monthTotals,
  spentByCategory,
  summarizeByMonth,
  totalBalanceMain,
  totalsOf,
} from '../stats'

// ---------- 测试夹具 ----------

function account(id: string, currency: Account['currency'], initialBalance = 0): Account {
  return {
    id,
    name: id,
    currency,
    initialBalance,
    icon: '💰',
    color: '#2a78d6',
    archived: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function tx(partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount'>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    accountId: 'cny',
    categoryId: 'food',
    occurredAt: '2026-09-15',
    createdAt: '2026-09-15T00:00:00.000Z',
    ...partial,
  }
}

function category(id: string, type: Category['type'] = 'expense'): Category {
  return {
    id,
    name: id,
    type,
    icon: '🍜',
    color: '#eb6834',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function budget(categoryId: string, month: string, limitAmount: number): Budget {
  return {
    id: `b-${categoryId}`,
    categoryId,
    month,
    limitAmount,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const ACCOUNTS = [account('cny', 'CNY'), account('usd', 'USD')]
const RATES = { USD: 7.2 }
const ctx = makeStatsCtx(ACCOUNTS, RATES)

// ---------- isTransfer ----------

describe('isTransfer', () => {
  it('有 transferId 即为转账', () => {
    expect(isTransfer(tx({ type: 'expense', amount: 100, transferId: 't1' }))).toBe(true)
  })

  it('没有 transferId 不是转账', () => {
    expect(isTransfer(tx({ type: 'expense', amount: 100 }))).toBe(false)
  })

  it('空字符串 transferId 不算转账', () => {
    expect(isTransfer(tx({ type: 'expense', amount: 100, transferId: '' }))).toBe(false)
  })
})

// ---------- monthTotals ----------

describe('monthTotals', () => {
  it('汇总当月收入与支出', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000 }),
      tx({ type: 'income', amount: 1000000 }),
      tx({ type: 'expense', amount: 3000 }),
    ]
    expect(monthTotals(txs, '2026-09', ctx)).toEqual({
      income: 1000000,
      expense: 8000,
      balance: 992000,
    })
  })

  it('只统计目标月份', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000, occurredAt: '2026-09-15' }),
      tx({ type: 'expense', amount: 9999, occurredAt: '2026-08-31' }),
      tx({ type: 'expense', amount: 8888, occurredAt: '2026-10-01' }),
    ]
    expect(monthTotals(txs, '2026-09', ctx).expense).toBe(5000)
  })

  it('排除转账记录', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000 }),
      tx({ type: 'expense', amount: 20000, transferId: 't1', categoryId: null }),
      tx({ type: 'income', amount: 20000, transferId: 't1', categoryId: null, accountId: 'usd' }),
    ]
    expect(monthTotals(txs, '2026-09', ctx)).toEqual({
      income: 0,
      expense: 5000,
      balance: -5000,
    })
  })

  it('外币账目按汇率折算到主币种', () => {
    const txs = [
      // 100 美元 = 10000 百分位，汇率 7.2 → 72000 分人民币
      tx({ type: 'expense', amount: 10000, accountId: 'usd' }),
    ]
    expect(monthTotals(txs, '2026-09', ctx).expense).toBe(72000)
  })

  it('混合币种求和', () => {
    const txs = [
      tx({ type: 'expense', amount: 10000, accountId: 'cny' }),
      tx({ type: 'expense', amount: 10000, accountId: 'usd' }),
    ]
    expect(monthTotals(txs, '2026-09', ctx).expense).toBe(10000 + 72000)
  })

  it('无数据时全为 0', () => {
    expect(monthTotals([], '2026-09', ctx)).toEqual({ income: 0, expense: 0, balance: 0 })
  })

  it('支出大于收入时结余为负', () => {
    const txs = [tx({ type: 'expense', amount: 9000 }), tx({ type: 'income', amount: 1000 })]
    expect(monthTotals(txs, '2026-09', ctx).balance).toBe(-8000)
  })
})

// ---------- summarizeByMonth ----------

describe('summarizeByMonth', () => {
  const months = ['2026-07', '2026-08', '2026-09']

  it('返回每个请求月份的分桶，缺失月份补 0', () => {
    const summary = summarizeByMonth([], months, ctx)
    expect(Object.keys(summary)).toEqual(months)
    expect(summary['2026-07']).toEqual({ income: 0, expense: 0, balance: 0 })
  })

  it('按月份分桶', () => {
    const txs = [
      tx({ type: 'expense', amount: 1000, occurredAt: '2026-07-10' }),
      tx({ type: 'expense', amount: 2000, occurredAt: '2026-08-10' }),
      tx({ type: 'income', amount: 5000, occurredAt: '2026-09-10' }),
    ]
    const summary = summarizeByMonth(txs, months, ctx)
    expect(summary['2026-07']?.expense).toBe(1000)
    expect(summary['2026-08']?.expense).toBe(2000)
    expect(summary['2026-09']?.income).toBe(5000)
  })

  it('忽略 months 之外的账目', () => {
    const txs = [tx({ type: 'expense', amount: 9999, occurredAt: '2026-06-10' })]
    const summary = summarizeByMonth(txs, months, ctx)
    expect(Object.values(summary).every((t) => t.expense === 0)).toBe(true)
  })

  it('结余 = 收入 - 支出', () => {
    const txs = [
      tx({ type: 'income', amount: 10000, occurredAt: '2026-08-01' }),
      tx({ type: 'expense', amount: 4000, occurredAt: '2026-08-02' }),
    ]
    expect(summarizeByMonth(txs, months, ctx)['2026-08']?.balance).toBe(6000)
  })

  it('排除转账', () => {
    const txs = [
      tx({ type: 'expense', amount: 20000, occurredAt: '2026-08-01', transferId: 't1' }),
    ]
    expect(summarizeByMonth(txs, months, ctx)['2026-08']?.expense).toBe(0)
  })

  it('totalsOf 取缺失月份返回全 0', () => {
    const summary = summarizeByMonth([], months, ctx)
    expect(totalsOf(summary, '2020-01')).toEqual({ income: 0, expense: 0, balance: 0 })
  })
})

// ---------- categoryBreakdown ----------

describe('categoryBreakdown', () => {
  it('按金额降序返回分类占比', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000, categoryId: 'food' }),
      tx({ type: 'expense', amount: 3000, categoryId: 'transport' }),
      tx({ type: 'expense', amount: 2000, categoryId: 'shopping' }),
    ]
    const slices = categoryBreakdown(txs, '2026-09', 'expense', ctx)
    expect(slices.map((s) => s.categoryId)).toEqual(['food', 'transport', 'shopping'])
    expect(slices.map((s) => s.amount)).toEqual([5000, 3000, 2000])
    expect(slices[0]?.percent).toBeCloseTo(0.5, 10)
    expect(slices[1]?.percent).toBeCloseTo(0.3, 10)
    expect(slices[2]?.percent).toBeCloseTo(0.2, 10)
  })

  it('百分比之和为 1', () => {
    const txs = [
      tx({ type: 'expense', amount: 3333, categoryId: 'a' }),
      tx({ type: 'expense', amount: 3333, categoryId: 'b' }),
      tx({ type: 'expense', amount: 3334, categoryId: 'c' }),
    ]
    const total = categoryBreakdown(txs, '2026-09', 'expense', ctx).reduce(
      (s, x) => s + x.percent,
      0,
    )
    expect(total).toBeCloseTo(1, 10)
  })

  it('同一分类的多笔账目合并', () => {
    const txs = [
      tx({ type: 'expense', amount: 1000, categoryId: 'food' }),
      tx({ type: 'expense', amount: 2000, categoryId: 'food' }),
    ]
    const slices = categoryBreakdown(txs, '2026-09', 'expense', ctx)
    expect(slices).toHaveLength(1)
    expect(slices[0]?.amount).toBe(3000)
  })

  it('只统计指定收支方向', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000, categoryId: 'food' }),
      tx({ type: 'income', amount: 9000, categoryId: 'salary' }),
    ]
    const slices = categoryBreakdown(txs, '2026-09', 'expense', ctx)
    expect(slices.map((s) => s.categoryId)).toEqual(['food'])
  })

  it('只统计指定月份', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000, categoryId: 'food', occurredAt: '2026-09-15' }),
      tx({ type: 'expense', amount: 9000, categoryId: 'food', occurredAt: '2026-08-15' }),
    ]
    expect(categoryBreakdown(txs, '2026-09', 'expense', ctx)[0]?.amount).toBe(5000)
  })

  it('排除转账', () => {
    const txs = [tx({ type: 'expense', amount: 5000, transferId: 't1', categoryId: null })]
    expect(categoryBreakdown(txs, '2026-09', 'expense', ctx)).toEqual([])
  })

  it('超出 maxSlices 的部分折叠为「其他」（categoryId 为 null）', () => {
    const txs = ['a', 'b', 'c', 'd'].map((c, i) =>
      tx({ type: 'expense', amount: (4 - i) * 1000, categoryId: c }),
    )
    const slices = categoryBreakdown(txs, '2026-09', 'expense', ctx, 2)
    expect(slices).toHaveLength(3)
    expect(slices[0]?.categoryId).toBe('a')
    expect(slices[1]?.categoryId).toBe('b')
    expect(slices[2]?.categoryId).toBeNull()
    // c(2000) + d(1000) 折叠为 3000
    expect(slices[2]?.amount).toBe(3000)
    expect(slices[2]?.percent).toBeCloseTo(0.3, 10)
    // 折叠了几个分类要如实报出来，界面上写「其余 2 类」
    expect(slices.map((s) => s.count)).toEqual([1, 1, 2])
  })

  it('恰好等于 maxSlices 时不产生「其他」', () => {
    const txs = ['a', 'b'].map((c, i) => tx({ type: 'expense', amount: (2 - i) * 1000, categoryId: c }))
    const slices = categoryBreakdown(txs, '2026-09', 'expense', ctx, 2)
    expect(slices).toHaveLength(2)
    expect(slices.every((s) => s.categoryId !== null)).toBe(true)
  })

  it('未分类账目（categoryId 为 null 且非转账）并入「其他」', () => {
    const txs = [
      tx({ type: 'expense', amount: 5000, categoryId: 'food' }),
      tx({ type: 'expense', amount: 1000, categoryId: null }),
    ]
    const slices = categoryBreakdown(txs, '2026-09', 'expense', ctx)
    expect(slices).toHaveLength(2)
    expect(slices[1]?.categoryId).toBeNull()
    expect(slices[1]?.amount).toBe(1000)
    // 总额含未分类，占比分母正确
    expect(slices[0]?.percent).toBeCloseTo(5000 / 6000, 10)
    // 未分类不是「分类」，不参与折叠计数 —— 界面上写「未分类」而不是「其余 0 类」
    expect(slices[1]?.count).toBe(0)
  })

  it('无数据时返回空数组', () => {
    expect(categoryBreakdown([], '2026-09', 'expense', ctx)).toEqual([])
  })

  it('外币账目折算后再比较大小', () => {
    const txs = [
      // 100 美元 → 72000 分人民币
      tx({ type: 'expense', amount: 10000, categoryId: 'travel', accountId: 'usd' }),
      tx({ type: 'expense', amount: 50000, categoryId: 'food', accountId: 'cny' }),
    ]
    const slices = categoryBreakdown(txs, '2026-09', 'expense', ctx)
    expect(slices[0]?.categoryId).toBe('travel')
    expect(slices[0]?.amount).toBe(72000)
  })
})

// ---------- spentByCategory / budgetProgress ----------

describe('spentByCategory', () => {
  it('汇总该分类该月支出', () => {
    const txs = [
      tx({ type: 'expense', amount: 1000, categoryId: 'food' }),
      tx({ type: 'expense', amount: 2000, categoryId: 'food' }),
      tx({ type: 'expense', amount: 9000, categoryId: 'transport' }),
    ]
    expect(spentByCategory(txs, '2026-09', 'food', ctx)).toBe(3000)
  })

  it('忽略收入', () => {
    const txs = [tx({ type: 'income', amount: 5000, categoryId: 'food' })]
    expect(spentByCategory(txs, '2026-09', 'food', ctx)).toBe(0)
  })

  it('忽略其他月份', () => {
    const txs = [tx({ type: 'expense', amount: 5000, categoryId: 'food', occurredAt: '2026-08-01' })]
    expect(spentByCategory(txs, '2026-09', 'food', ctx)).toBe(0)
  })

  it('忽略转账', () => {
    const txs = [tx({ type: 'expense', amount: 5000, transferId: 't1', categoryId: null })]
    expect(spentByCategory(txs, '2026-09', 'food', ctx)).toBe(0)
  })
})

describe('budgetProgress', () => {
  it('计算已花、限额与比例', () => {
    const txs = [tx({ type: 'expense', amount: 150000, categoryId: 'food' })]
    expect(budgetProgress(txs, budget('food', '2026-09', 300000), ctx)).toEqual({
      spent: 150000,
      limit: 300000,
      ratio: 0.5,
    })
  })

  it('限额为 0 时比例为 0，不产生除零', () => {
    const p = budgetProgress([], budget('food', '2026-09', 0), ctx)
    expect(p.ratio).toBe(0)
  })

  it('超支时比例大于 1', () => {
    const txs = [tx({ type: 'expense', amount: 400000, categoryId: 'food' })]
    expect(budgetProgress(txs, budget('food', '2026-09', 300000), ctx).ratio).toBeCloseTo(4 / 3, 10)
  })

  it('外币支出折算后计入预算（预算以主币种计）', () => {
    const txs = [tx({ type: 'expense', amount: 10000, categoryId: 'food', accountId: 'usd' })]
    expect(budgetProgress(txs, budget('food', '2026-09', 100000), ctx).spent).toBe(72000)
  })
})

describe('budgetLevel', () => {
  it('低于 80% 为 normal', () => {
    expect(budgetLevel(0)).toBe('normal')
    expect(budgetLevel(0.79)).toBe('normal')
  })

  it('80% 起为 warning', () => {
    expect(budgetLevel(0.8)).toBe('warning')
    expect(budgetLevel(0.99)).toBe('warning')
  })

  it('100% 起为 over', () => {
    expect(budgetLevel(1)).toBe('over')
    expect(budgetLevel(2.5)).toBe('over')
  })
})

describe('budgetRows', () => {
  const categories = [category('food'), category('transport')]
  const budgets = [budget('food', '2026-09', 100000), budget('transport', '2026-09', 100000)]

  it('只返回目标月份的预算', () => {
    const all = [...budgets, budget('food', '2026-08', 100000)]
    expect(budgetRows([], all, '2026-09', categories, ctx)).toHaveLength(2)
  })

  it('按比例降序，超支排最前', () => {
    const txs = [
      tx({ type: 'expense', amount: 50000, categoryId: 'food' }),
      tx({ type: 'expense', amount: 120000, categoryId: 'transport' }),
    ]
    const rows = budgetRows(txs, budgets, '2026-09', categories, ctx)
    expect(rows[0]?.category.id).toBe('transport')
    expect(rows[1]?.category.id).toBe('food')
  })

  it('跳过分类已不存在的预算', () => {
    const rows = budgetRows([], [budget('ghost', '2026-09', 100000)], '2026-09', categories, ctx)
    expect(rows).toEqual([])
  })
})

// ---------- accountBalance ----------

describe('accountBalance', () => {
  it('无账目时等于初始余额', () => {
    expect(accountBalance(account('cny', 'CNY', 500000), [])).toBe(500000)
  })

  it('收入累加、支出累减', () => {
    const txs = [
      tx({ type: 'income', amount: 100000 }),
      tx({ type: 'expense', amount: 30000 }),
    ]
    expect(accountBalance(account('cny', 'CNY', 0), txs)).toBe(70000)
  })

  it('只统计本账户的账目', () => {
    const txs = [
      tx({ type: 'expense', amount: 30000, accountId: 'cny' }),
      tx({ type: 'expense', amount: 99999, accountId: 'usd' }),
    ]
    expect(accountBalance(account('cny', 'CNY', 0), txs)).toBe(-30000)
  })

  it('**包含转账**（与收支统计不同）', () => {
    const txs = [
      tx({ type: 'expense', amount: 20000, accountId: 'cny', transferId: 't1', categoryId: null }),
      tx({ type: 'income', amount: 20000, accountId: 'usd', transferId: 't1', categoryId: null }),
    ]
    expect(accountBalance(account('cny', 'CNY', 100000), txs)).toBe(80000)
    expect(accountBalance(account('usd', 'USD', 0), txs)).toBe(20000)
  })

  it('余额可为负（个人工具允许透支）', () => {
    const txs = [tx({ type: 'expense', amount: 30000 })]
    expect(accountBalance(account('cny', 'CNY', 10000), txs)).toBe(-20000)
  })

  it('账户本币种计价，不做汇率折算', () => {
    const txs = [tx({ type: 'income', amount: 10000, accountId: 'usd' })]
    expect(accountBalance(account('usd', 'USD', 0), txs)).toBe(10000)
  })
})

describe('totalBalanceMain', () => {
  it('多账户余额折算到主币种求和', () => {
    const txs = [
      tx({ type: 'income', amount: 100000, accountId: 'cny' }),
      tx({ type: 'income', amount: 10000, accountId: 'usd' }),
    ]
    // 1000 元 + 100 美元 × 7.2 = 1000 + 720 = 1720 元
    expect(totalBalanceMain(ACCOUNTS, txs, ctx)).toBe(100000 + 72000)
  })

  it('跳过已归档账户', () => {
    const archived = [{ ...account('old', 'CNY', 999999), archived: true }]
    expect(totalBalanceMain(archived, [], ctx)).toBe(0)
  })

  it('缺汇率时按 1:1 兜底', () => {
    const noRate = makeStatsCtx(ACCOUNTS, {})
    expect(totalBalanceMain([account('usd', 'USD', 10000)], [], noRate)).toBe(10000)
  })
})

// ---------- 边界：账户缺失 ----------

describe('账户查找不到时的兜底', () => {
  it('按主币种处理，不崩溃', () => {
    const txs = [tx({ type: 'expense', amount: 5000, accountId: 'ghost' })]
    expect(monthTotals(txs, '2026-09', ctx).expense).toBe(5000)
  })
})
