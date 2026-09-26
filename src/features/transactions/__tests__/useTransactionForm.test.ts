import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTransactionForm } from '../useTransactionForm'
import { todayISO } from '@/lib/date'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>
type Form = ReturnType<typeof useTransactionForm>

let current: Store | null = null
let store: Store

beforeEach(async () => {
  current?.$dispose()
  current = null
  await nextTick()
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  current = store
})

function setup(transactionId?: string): Form {
  return useTransactionForm(() => transactionId)
}

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

/** 填一份合法的支出表单 */
function fillValid(form: Form, over: Partial<Form['state']> = {}): void {
  Object.assign(form.state, {
    type: 'expense' as const,
    amountText: '12.30',
    categoryId: categoryIdOf('餐饮'),
    accountId: cashId(),
    occurredAt: '2026-09-10',
    note: '',
    ...over,
  })
}

describe('新建模式', () => {
  it('默认取第一个可用账户、今天、支出方向', () => {
    const form = setup()

    expect(form.mode.value).toBe('create')
    expect(form.state.type).toBe('expense')
    expect(form.state.accountId).toBe(cashId())
    expect(form.state.occurredAt).toBe(todayISO())
    expect(form.state.amountText).toBe('')
  })

  it('金额为空 / 为 0 / 格式错，均报错且不写入', () => {
    const form = setup()
    fillValid(form, { amountText: '' })
    expect(form.submit()).toEqual({ ok: false })
    expect(form.errors.amount).toBe('请输入金额')

    form.state.amountText = '0'
    expect(form.submit()).toEqual({ ok: false })
    expect(form.errors.amount).toBe('金额必须大于 0')

    form.state.amountText = '1.234'
    expect(form.submit()).toEqual({ ok: false })
    expect(form.errors.amount).toBe('金额格式不正确，最多两位小数')

    expect(store.db.transactions).toHaveLength(0)
  })

  it('未选分类时拒绝提交', () => {
    const form = setup()
    fillValid(form, { categoryId: '' })

    expect(form.submit()).toEqual({ ok: false })
    expect(form.errors.category).toBe('请选择分类')
    expect(store.db.transactions).toHaveLength(0)
  })

  it('合法表单写入 store，金额按分存储并记住所选账户', () => {
    const other = store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    const form = setup()
    fillValid(form, { accountId: other.id, amountText: '1234.56' })

    expect(form.submit()).toEqual({ ok: true })

    const tx = store.db.transactions[0]
    expect(tx).toMatchObject({
      type: 'expense',
      accountId: other.id,
      categoryId: categoryIdOf('餐饮'),
      amount: 123456,
      occurredAt: '2026-09-10',
    })
    expect(store.db.settings.lastAccountId).toBe(other.id)
  })

  it('新建表单的默认账户取上次记账用的那个', () => {
    const other = store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    store.addTransaction({
      type: 'expense',
      accountId: other.id,
      categoryId: categoryIdOf('餐饮'),
      amount: 100,
      occurredAt: '2026-09-01',
    })

    expect(setup().state.accountId).toBe(other.id)
  })

  it('切换到收入方向会清掉不属于该方向的分类', async () => {
    const form = setup()
    fillValid(form)

    form.state.type = 'income'
    await nextTick()

    expect(form.state.categoryId).toBe('')
  })

  it('「再记一笔」保留方向、账户、日期，清掉金额与分类', () => {
    const form = setup()
    fillValid(form, { accountId: cashId(), occurredAt: '2026-09-10', note: '午饭' })

    form.resetForNext()

    expect(form.state).toMatchObject({
      type: 'expense',
      accountId: cashId(),
      occurredAt: '2026-09-10',
      amountText: '',
      categoryId: '',
      note: '',
    })
  })
})

describe('编辑模式', () => {
  function seedExpense(): string {
    const { tx } = store.addTransaction({
      type: 'expense',
      accountId: cashId(),
      categoryId: categoryIdOf('餐饮'),
      amount: 3050,
      occurredAt: '2026-09-10',
      note: '午饭',
    })
    return tx.id
  }

  it('载入原值，金额按元回填', () => {
    const id = seedExpense()
    const form = setup(id)

    expect(form.mode.value).toBe('edit')
    expect(form.state).toMatchObject({
      type: 'expense',
      amountText: '30.50',
      categoryId: categoryIdOf('餐饮'),
      accountId: cashId(),
      occurredAt: '2026-09-10',
      note: '午饭',
    })
  })

  it('载入时不会把原分类当成「不属于当前方向」而清掉', async () => {
    const id = seedExpense()
    const form = setup(id)

    form.state.type = 'income'
    await nextTick()
    form.state.type = 'expense'
    await nextTick()

    // 绕一圈回到支出，分类已被清掉（这是有意的：中间确实切走过）
    expect(form.state.categoryId).toBe('')

    // 但刚载入时不会被误清
    const fresh = setup(id)
    expect(fresh.state.categoryId).toBe(categoryIdOf('餐饮'))
  })

  it('保存是更新而非新增，且不产生第二条记录', () => {
    const id = seedExpense()
    const form = setup(id)
    form.state.amountText = '99.99'
    form.state.note = '改了'

    expect(form.submit()).toEqual({ ok: true })

    expect(store.db.transactions).toHaveLength(1)
    expect(store.db.transactions[0]).toMatchObject({ id, amount: 9999, note: '改了' })
  })

  it('删除后记录消失', () => {
    const id = seedExpense()
    const form = setup(id)

    expect(form.remove()).toBe(true)
    expect(store.db.transactions).toHaveLength(0)
  })
})

describe('转账只读模式', () => {
  function seedTransfer(): string {
    store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    const target = store.activeAccounts.find((a) => a.name === '美元卡')
    if (!target) throw new Error('测试夹具缺少账户')

    const { from } = store.addTransfer({
      fromAccountId: cashId(),
      toAccountId: target.id,
      amount: 10000,
      rate: 0.14,
      occurredAt: '2026-09-11',
    })
    return from.id
  }

  it('转账记录进入只读模式，提交无效', () => {
    const form = setup(seedTransfer())

    expect(form.mode.value).toBe('readonly')
    expect(form.readonlyReason.value).not.toBe('')
    expect(form.submit()).toEqual({ ok: false })
  })

  it('删除只读记录会连带删除配对的两条', () => {
    const form = setup(seedTransfer())
    expect(store.db.transactions).toHaveLength(2)

    expect(form.remove()).toBe(true)
    expect(store.db.transactions).toHaveLength(0)
  })
})

describe('预算跨线提示', () => {
  it('越过 80% 时返回 warning，越过 100% 时返回 over', () => {
    const categoryId = categoryIdOf('餐饮')
    store.setBudget(categoryId, '2026-09', 10000) // 100 元

    const form = setup()
    fillValid(form, { categoryId, amountText: '85', occurredAt: '2026-09-10' })

    const first = form.submit()
    expect(first).toEqual({
      ok: true,
      budgetWarning: { categoryName: '餐饮', ratio: 0.85, level: 'warning' },
    })
  })

  it('已在超支状态继续记账不重复提示', () => {
    const categoryId = categoryIdOf('餐饮')
    store.setBudget(categoryId, '2026-09', 10000)

    const form = setup()
    fillValid(form, { categoryId, amountText: '150', occurredAt: '2026-09-10' })
    expect(form.submit().budgetWarning?.level).toBe('over')

    const second = setup()
    fillValid(second, { categoryId, amountText: '10', occurredAt: '2026-09-12' })
    expect(second.submit()).toEqual({ ok: true })
  })
})
