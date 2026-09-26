/**
 * 分类管理。这里锁定的是两条**保护历史数据**的规则：
 * 被引用时拒绝删除、已有分类不许改收支类型。
 * 它们不是交互偏好，破坏之后账目会变成找不回来的孤儿。
 */

import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCategoryEditor, useCategoryManager } from '../useCategoryManager'
import { EXPENSE_CATEGORY_ICONS, INCOME_CATEGORY_ICONS } from '@/lib/presets'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>

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

function spend(categoryName: string): void {
  store.addTransaction({
    type: 'expense',
    accountId: cashId(),
    categoryId: categoryIdOf(categoryName),
    amount: 1000,
    occurredAt: '2026-09-10',
  })
}

function rowOf(name: string) {
  const row = useCategoryManager().rows.value.find((r) => r.category.name === name)
  if (!row) throw new Error(`分类列表里找不到：${name}`)
  return row
}

describe('列表', () => {
  it('默认看支出分类，切页签后看收入分类', () => {
    const { type, rows, counts } = useCategoryManager()

    expect(type.value).toBe('expense')
    expect(rows.value.every((r) => r.category.type === 'expense')).toBe(true)
    expect(counts.value).toMatchObject({ expense: 8, income: 4 })

    type.value = 'income'
    expect(rows.value.every((r) => r.category.type === 'income')).toBe(true)
  })

  it('引用数按分类统计，没用过的显示 0', () => {
    spend('餐饮')
    spend('餐饮')
    spend('交通')

    expect(rowOf('餐饮').usage).toBe(2)
    expect(rowOf('交通').usage).toBe(1)
    expect(rowOf('购物').usage).toBe(0)
  })

  it('转账不参与分类引用计数 —— 它的 categoryId 是 null', () => {
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
      amount: 10000,
      rate: 0.14,
      occurredAt: '2026-09-10',
    })

    expect(useCategoryManager().rows.value.every((r) => r.usage === 0)).toBe(true)
  })
})

describe('删除', () => {
  it('被账目引用的分类拒绝删除，并说明原因', () => {
    spend('餐饮')
    const { remove } = useCategoryManager()

    expect(remove(categoryIdOf('餐饮'))).toBe('该分类下已有账目，无法删除')
    expect(store.categories.some((c) => c.name === '餐饮')).toBe(true)
  })

  it('被预算引用的分类也拒绝删除', () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-09', 100000)
    const { remove } = useCategoryManager()

    expect(remove(categoryIdOf('餐饮'))).toBe('该分类已设置预算，请先删除预算')
  })

  it('没人引用的分类可以删除', () => {
    const id = categoryIdOf('娱乐')
    const { remove } = useCategoryManager()

    expect(remove(id)).toBeNull()
    expect(store.categories.some((c) => c.name === '娱乐')).toBe(false)
  })
})

describe('新增与编辑', () => {
  it('新增时按当前页签预置类型、图标与默认名', () => {
    const editor = useCategoryEditor()

    editor.startCreate('income')
    expect(editor.state.type).toBe('income')
    expect(editor.mode.value).toBe('create')
    expect(editor.iconOptions.value).toBe(INCOME_CATEGORY_ICONS)

    editor.startCreate('expense')
    expect(editor.iconOptions.value).toBe(EXPENSE_CATEGORY_ICONS)
  })

  it('保存后落库，并记住图标与颜色', () => {
    const editor = useCategoryEditor()
    editor.startCreate('expense')
    editor.state.name = '宠物'
    editor.state.icon = '🐾'
    editor.state.color = '#1baf7a'

    expect(editor.save()).toBe(true)

    const created = store.categories.find((c) => c.name === '宠物')
    expect(created).toMatchObject({ type: 'expense', icon: '🐾', color: '#1baf7a' })
  })

  it('分类名去空白后必填，空名与超长都拦下', () => {
    const editor = useCategoryEditor()
    editor.startCreate('expense')

    editor.state.name = '   '
    expect(editor.save()).toBe(false)
    expect(editor.nameError.value).toBe('请输入分类名')

    editor.state.name = '一二三四五六七八九'
    expect(editor.save()).toBe(false)
    expect(editor.nameError.value).toBe('分类名不能超过 8 个字')
  })

  it('同类型下重名拦下，不同类型同名放过', () => {
    const editor = useCategoryEditor()

    editor.startCreate('expense')
    editor.state.name = '餐饮'
    expect(editor.save()).toBe(false)
    expect(editor.nameError.value).toBe('同类型下已有同名分类')

    editor.startCreate('income')
    editor.state.name = '餐饮'
    expect(editor.save()).toBe(true)
  })

  it('改自己的名字不算重名 —— 否则原样保存都会被拦', () => {
    const editor = useCategoryEditor()
    const food = store.categories.find((c) => c.name === '餐饮')
    if (!food) throw new Error('测试夹具缺少分类')

    editor.startEdit(food)
    editor.state.name = '吃喝'

    expect(editor.save()).toBe(true)
    expect(store.categoryOf(food.id)?.name).toBe('吃喝')
  })

  it('编辑已有分类时锁定收支类型', () => {
    const editor = useCategoryEditor()
    const food = store.categories.find((c) => c.name === '餐饮')
    if (!food) throw new Error('测试夹具缺少分类')

    editor.startEdit(food)
    expect(editor.mode.value).toBe('edit')
    expect(editor.typeLocked.value).toBe(true)

    editor.startCreate('expense')
    expect(editor.typeLocked.value).toBe(false)
  })

  it('编辑时把现值填进表单', () => {
    const editor = useCategoryEditor()
    const food = store.categories.find((c) => c.name === '餐饮')
    if (!food) throw new Error('测试夹具缺少分类')

    editor.startEdit(food)

    expect(editor.state.name).toBe('餐饮')
    expect(editor.state.icon).toBe(food.icon)
    expect(editor.state.color).toBe(food.color)
  })
})
