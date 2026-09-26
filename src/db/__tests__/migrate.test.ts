import { describe, expect, it } from 'vitest'

import { CURRENT_SCHEMA_VERSION, migrate } from '../migrate'
import { seedDatabase } from '../seed'

/** 取一份合法的原始对象（模拟从 localStorage 解析出来的结果） */
function rawDb(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(seedDatabase())) as Record<string, unknown>
}

/** 断言迁移成功并返回结果。用 throw 而非条件断言，失败信息更直接。 */
function expectOk(raw: unknown): Extract<ReturnType<typeof migrate>, { ok: true }> {
  const result = migrate(raw)
  if (!result.ok) throw new Error(`预期迁移成功，实际失败：${result.reason}`)
  return result
}

describe('CURRENT_SCHEMA_VERSION', () => {
  it('当前为 v1', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
  })
})

describe('migrate — 正常路径', () => {
  it('当前版本的数据原样通过', () => {
    const result = expectOk(rawDb())
    expect(result.appliedMigrations).toBe(0)
    expect(result.db.schemaVersion).toBe(1)
    expect(result.db.accounts).toHaveLength(1)
    expect(result.db.categories).toHaveLength(12)
  })

  it('保留交易与预算数据', () => {
    const raw = rawDb()
    raw['transactions'] = [{ id: 't1', type: 'expense', amount: 100 }]
    raw['budgets'] = [{ id: 'b1', categoryId: 'c1', month: '2026-09', limitAmount: 1000 }]
    const result = expectOk(raw)
    expect(result.db.transactions).toHaveLength(1)
    expect(result.db.budgets).toHaveLength(1)
  })

  it('无条件把 schemaVersion 归一到当前版本', () => {
    const raw = rawDb()
    raw['schemaVersion'] = 1
    expect(expectOk(raw).db.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
  })
})

describe('migrate — 损坏数据兜底', () => {
  it('非对象输入被拒绝', () => {
    expect(migrate(null)).toEqual({ ok: false, reason: '数据不是有效的对象' })
    expect(migrate('字符串')).toEqual({ ok: false, reason: '数据不是有效的对象' })
    expect(migrate(123)).toEqual({ ok: false, reason: '数据不是有效的对象' })
    expect(migrate([1, 2, 3])).toEqual({ ok: false, reason: '数据不是有效的对象' })
  })

  it('缺少版本号被拒绝', () => {
    const raw = rawDb()
    delete raw['schemaVersion']
    expect(migrate(raw)).toEqual({ ok: false, reason: '缺少有效的版本号' })
  })

  it('版本号非法被拒绝', () => {
    for (const bad of [0, -1, 1.5, 'v1', null]) {
      const raw = rawDb()
      raw['schemaVersion'] = bad
      const result = migrate(raw)
      expect(result.ok).toBe(false)
    }
  })

  it('版本高于当前应用被拒绝（不静默降级丢数据）', () => {
    const raw = rawDb()
    raw['schemaVersion'] = CURRENT_SCHEMA_VERSION + 1
    const result = migrate(raw)
    expect(result).toEqual({
      ok: false,
      reason: `数据版本（v${CURRENT_SCHEMA_VERSION + 1}）高于当前应用支持的版本（v${CURRENT_SCHEMA_VERSION}）`,
    })
  })

  it('结构不完整被拒绝：缺少 transactions 数组', () => {
    const raw = rawDb()
    delete raw['transactions']
    expect(migrate(raw)).toEqual({ ok: false, reason: '数据结构不完整' })
  })

  it('结构不完整被拒绝：accounts 不是数组', () => {
    const raw = rawDb()
    raw['accounts'] = { not: 'an array' }
    expect(migrate(raw)).toEqual({ ok: false, reason: '数据结构不完整' })
  })

  it('结构不完整被拒绝：settings 不是对象', () => {
    const raw = rawDb()
    raw['settings'] = 'oops'
    expect(migrate(raw)).toEqual({ ok: false, reason: '数据结构不完整' })
  })

  it('数组里混入非对象元素被拒绝', () => {
    const raw = rawDb()
    raw['categories'] = [{ id: 'ok' }, 'not-an-object']
    expect(migrate(raw)).toEqual({ ok: false, reason: '数据结构不完整' })
  })

  it('被拒绝时绝不抛异常', () => {
    const weird: unknown[] = [undefined, Symbol('x'), () => {}, new Date(), NaN]
    for (const value of weird) {
      expect(() => migrate(value)).not.toThrow()
    }
  })
})

describe('seedDatabase', () => {
  it('生成结构完整的空库', () => {
    const db = seedDatabase()
    expect(db.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(db.transactions).toEqual([])
    expect(db.budgets).toEqual([])
    expect(db.settings.mainCurrency).toBe('CNY')
    expect(db.settings.exchangeRates).toEqual({})
  })

  it('默认一个现金账户', () => {
    const db = seedDatabase()
    expect(db.accounts).toHaveLength(1)
    expect(db.accounts[0]?.name).toBe('现金')
    expect(db.accounts[0]?.currency).toBe('CNY')
    expect(db.accounts[0]?.initialBalance).toBe(0)
    expect(db.accounts[0]?.archived).toBe(false)
  })

  it('默认分类覆盖常见支出与收入', () => {
    const db = seedDatabase()
    const expense = db.categories.filter((c) => c.type === 'expense')
    const income = db.categories.filter((c) => c.type === 'income')
    expect(expense.map((c) => c.name)).toEqual([
      '餐饮',
      '交通',
      '购物',
      '居住',
      '娱乐',
      '医疗',
      '教育',
      '其他',
    ])
    expect(income.map((c) => c.name)).toEqual(['工资', '奖金', '理财', '其他收入'])
  })

  it('每个分类都有图标与颜色', () => {
    for (const c of seedDatabase().categories) {
      expect(c.icon.length).toBeGreaterThan(0)
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('两次生成的 id 不重复（不是硬编码常量）', () => {
    const a = seedDatabase()
    const b = seedDatabase()
    expect(a.accounts[0]?.id).not.toBe(b.accounts[0]?.id)
    expect(a.categories[0]?.id).not.toBe(b.categories[0]?.id)
  })

  it('sortOrder 在同类内从 0 连续递增', () => {
    const db = seedDatabase()
    const expense = db.categories.filter((c) => c.type === 'expense')
    expect(expense.map((c) => c.sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('生成的库能通过自己的迁移校验', () => {
    const result = migrate(JSON.parse(JSON.stringify(seedDatabase())))
    expect(result.ok).toBe(true)
  })
})
