import { nextTick, ref, type Ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useBudgetEditor, useBudgetManager } from '../useBudgetManager'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>

let current: Store | null = null
let store: Store
let month: Ref<string>

beforeEach(async () => {
  current?.$dispose()
  current = null
  await nextTick()
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  current = store
  month = ref('2026-09')
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

/** 记一笔支出，默认落在 2026-09 */
function spend(categoryId: string, amount: number, occurredAt = '2026-09-10'): void {
  store.addTransaction({ type: 'expense', accountId: cashId(), categoryId, amount, occurredAt })
}

describe('预算行', () => {
  it('按已花比例降序，超支的排最前', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 100000)
    store.setBudget(categoryIdOf('交通'), '2026-09', 10000)
    store.setBudget(categoryIdOf('购物'), '2026-09', 100000)

    spend(categoryIdOf('餐饮'), 50000) // 50%
    spend(categoryIdOf('交通'), 12000) // 120%
    spend(categoryIdOf('购物'), 80000) // 80%

    const { rows } = useBudgetManager(month)

    expect(rows.value.map((r) => r.category.name)).toEqual(['交通', '购物', '餐饮'])
  })

  it('只统计当月支出', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 100000)
    spend(categoryIdOf('餐饮'), 30000, '2026-08-20')
    spend(categoryIdOf('餐饮'), 10000, '2026-09-02')

    const { rows } = useBudgetManager(month)

    expect(rows.value[0]?.progress.spent).toBe(10000)
  })

  it('外币账户的支出按汇率折算到主币种', () => {
    store.setExchangeRate('USD', 7)
    const usd = store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    }).id
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 100000)
    store.addTransaction({
      type: 'expense',
      accountId: usd,
      categoryId: categoryIdOf('餐饮'),
      amount: 10000, // 100 美元
      occurredAt: '2026-09-10',
    })

    const { rows } = useBudgetManager(month)

    expect(rows.value[0]?.progress.spent).toBe(70000)
  })

  it('汇总限额与已花，并给出总比例', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 100000)
    store.setBudget(categoryIdOf('交通'), '2026-09', 100000)
    spend(categoryIdOf('餐饮'), 50000)
    spend(categoryIdOf('交通'), 50000)

    const { totalLimit, totalSpent, totalRatio } = useBudgetManager(month)

    expect(totalLimit.value).toBe(200000)
    expect(totalSpent.value).toBe(100000)
    expect(totalRatio.value).toBe(0.5)
  })

  it('没有任何预算时总比例为 0 而不是 NaN', () => {
    void spend(categoryIdOf('餐饮'), 10000)

    const { totalLimit, totalRatio } = useBudgetManager(month)

    expect(totalLimit.value).toBe(0)
    expect(totalRatio.value).toBe(0)
  })
})

describe('沿用上月预算', () => {
  it('本月为空且上月有预算时可沿用', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-08', 120000)
    store.setBudget(categoryIdOf('交通'), '2026-08', 30000)

    const { canCopyLastMonth, lastMonth, copyLastMonth } = useBudgetManager(month)

    expect(canCopyLastMonth.value).toBe(true)
    expect(lastMonth.value).toBe('2026-08')
    expect(copyLastMonth()).toBe(2)

    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')?.limitAmount).toBe(120000)
    expect(store.budgetOf(categoryIdOf('交通'), '2026-09')?.limitAmount).toBe(30000)
  })

  it('本月已有预算时不再提示沿用', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-08', 120000)
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 50000)

    const { canCopyLastMonth } = useBudgetManager(month)

    expect(canCopyLastMonth.value).toBe(false)
  })

  it('沿用不会覆盖本月已有的限额', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-08', 120000)
    store.setBudget(categoryIdOf('交通'), '2026-08', 30000)
    // 本月已设交通，餐饮还空着 —— 沿用只补空的那些
    store.setBudget(categoryIdOf('交通'), '2026-09', 99900)

    const { copyLastMonth } = useBudgetManager(month)

    // canCopyLastMonth 为 false 时界面不给按钮，这里直接验证写入行为本身
    expect(copyLastMonth()).toBe(1)

    expect(store.budgetOf(categoryIdOf('交通'), '2026-09')?.limitAmount).toBe(99900)
    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')?.limitAmount).toBe(120000)
  })
})

describe('预算编辑', () => {
  it('新增时分类可选，已设预算的分类不出现在候选里', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 100000)

    const editor = useBudgetEditor(month)
    editor.startCreate()

    const values = editor.categoryOptions.value.map((o) => o.value)
    expect(values).not.toContain(categoryIdOf('餐饮'))
    expect(values).toContain(categoryIdOf('交通'))
    expect(editor.categoryLocked.value).toBe(false)
    expect(editor.canCreate.value).toBe(true)
  })

  it('全部支出分类都已设预算时无法再新增', () => {
    for (const c of store.categoriesByType.expense) {
      store.setBudget(c.id, '2026-09', 100000)
    }

    const editor = useBudgetEditor(month)
    editor.startCreate()

    expect(editor.canCreate.value).toBe(false)
    expect(editor.categoryOptions.value).toHaveLength(0)
  })

  it('编辑已有预算时回填限额并锁定分类', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 123400)

    const editor = useBudgetEditor(month)
    editor.startEdit(categoryIdOf('餐饮'))

    expect(editor.limitText.value).toBe('1234.00')
    expect(editor.categoryLocked.value).toBe(true)
    expect(editor.existing.value?.limitAmount).toBe(123400)
  })

  it('未选分类就保存 → 报错且不写入', () => {
    const editor = useBudgetEditor(month)
    editor.startCreate()
    editor.limitText.value = '500'

    expect(editor.save()).toBe(false)
    expect(editor.categoryError.value).toBe('请选择分类')
    expect(store.db.budgets).toHaveLength(0)
  })

  it('限额非法 → 报错且不写入', () => {
    const editor = useBudgetEditor(month)
    editor.startCreate()
    editor.categoryId.value = categoryIdOf('餐饮')
    editor.limitText.value = '0'

    expect(editor.save()).toBe(false)
    expect(editor.limitError.value).toBe('金额必须大于 0')
    expect(store.db.budgets).toHaveLength(0)
  })

  it('保存成功后写入并关闭弹层', () => {
    const editor = useBudgetEditor(month)
    editor.startCreate()
    editor.categoryId.value = categoryIdOf('餐饮')
    editor.limitText.value = '500'

    expect(editor.save()).toBe(true)
    expect(editor.open.value).toBe(false)
    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')?.limitAmount).toBe(50000)
  })

  it('修改限额是更新而非新增', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 50000)

    const editor = useBudgetEditor(month)
    editor.startEdit(categoryIdOf('餐饮'))
    editor.limitText.value = '800'
    editor.save()

    expect(store.db.budgets).toHaveLength(1)
    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')?.limitAmount).toBe(80000)
  })

  it('删除预算后该分类只剩历史月份的数据', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-08', 50000)
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 50000)

    const editor = useBudgetEditor(month)
    editor.startEdit(categoryIdOf('餐饮'))
    editor.remove()

    expect(editor.open.value).toBe(false)
    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')).toBeUndefined()
    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-08')).toBeDefined()
  })
})
