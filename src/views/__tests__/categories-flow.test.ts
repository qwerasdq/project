/**
 * 分类管理集成测试。
 *
 * 删除的两种情况都要走到：有账目引用（拒绝 + 说明原因）和没人引用（真删掉）。
 * 只测「能删」会漏掉最有价值的那条 —— 用户点了删除、界面却什么都没发生，
 * 那是最让人恼火的一种失败。
 */

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import CategoryManager from '@/features/categories/CategoryManager.vue'
import { useToast } from '@/composables/useToast'
import { useDbStore } from '@/stores/db'

type Wrapper = ReturnType<typeof mount>

let store: ReturnType<typeof useDbStore>
let wrapper: Wrapper | null = null

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  useToast().items.value.splice(0)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountManager(): Wrapper {
  return mount(CategoryManager, { attachTo: document.body })
}

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

function buttonByText(w: Wrapper, text: string) {
  const button = w.findAll('button').find((b) => b.text().trim() === text)
  if (!button) throw new Error(`界面上找不到按钮：${text}`)
  return button
}

/** 列表行：按分类名定位那一行 */
function rowOf(w: Wrapper, name: string): DOMWrapper<Element> {
  const button = w.findAll('button').find((b) => b.text().includes(name))
  if (!button) throw new Error(`分类列表里找不到：${name}`)
  const row = button.element.closest('div')
  if (!row) throw new Error(`分类行结构异常：${name}`)
  return new DOMWrapper(row)
}

function modal() {
  const dialog = document.body.querySelector('[role="dialog"]')
  if (!dialog) throw new Error('弹层没有打开')
  return new DOMWrapper(dialog)
}

function modalButtonByText(text: string) {
  const button = [...modal().element.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )
  if (!button) throw new Error(`弹层里找不到按钮：${text}`)
  return new DOMWrapper(button)
}

function lastToast(): string {
  const items = useToast().items.value
  return items[items.length - 1]?.message ?? ''
}

describe('列表', () => {
  it('默认看支出分类，每个分类底下写着被引用了多少笔', () => {
    spend('餐饮')
    spend('餐饮')
    wrapper = mountManager()

    expect(wrapper.text()).toContain('餐饮')
    expect(rowOf(wrapper, '餐饮').text()).toContain('2 笔账目')
    expect(rowOf(wrapper, '购物').text()).toContain('还没用过')
  })

  it('页签上带数量，切到收入看收入分类', async () => {
    wrapper = mountManager()

    expect(buttonByText(wrapper, '支出 8').attributes('aria-pressed')).toBe('true')
    expect(buttonByText(wrapper, '收入 4').attributes('aria-pressed')).toBe('false')

    await buttonByText(wrapper, '收入 4').trigger('click')
    expect(wrapper.text()).toContain('工资')
    expect(wrapper.text()).not.toContain('餐饮')
  })
})

describe('新增', () => {
  it('新增按钮跟着当前页签走，保存后出现在列表里', async () => {
    wrapper = mountManager()

    await buttonByText(wrapper, '新增支出分类').trigger('click')
    await flushPromises()

    const input = modal().find('input')
    await input.setValue('宠物')
    await modalButtonByText('保存').trigger('click')
    await flushPromises()

    expect(store.categories.some((c) => c.name === '宠物')).toBe(true)
    expect(wrapper.text()).toContain('宠物')
    expect(store.categories.find((c) => c.name === '宠物')?.type).toBe('expense')
  })

  it('空名不进库，错误标在输入框上', async () => {
    wrapper = mountManager()

    await buttonByText(wrapper, '新增支出分类').trigger('click')
    await flushPromises()
    await modalButtonByText('保存').trigger('click')
    await flushPromises()

    expect(modal().text()).toContain('请输入分类名')
    expect(store.categories).toHaveLength(12)
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })
})

describe('编辑', () => {
  it('点行打开弹层，改名后列表与账目一起看到新名字', async () => {
    spend('餐饮')
    wrapper = mountManager()

    await rowOf(wrapper, '餐饮').find('button').trigger('click')
    await flushPromises()

    const input = modal().find('input')
    await input.setValue('吃喝')
    await modalButtonByText('保存').trigger('click')
    await flushPromises()

    expect(store.categoryOf(categoryIdOf('吃喝'))?.name).toBe('吃喝')
    expect(wrapper.text()).toContain('吃喝')
    // 账目引用的是 id，改名不该让引用数归零
    expect(rowOf(wrapper, '吃喝').text()).toContain('1 笔账目')
  })

  it('编辑已有分类时不给改收支类型，并说明原因', async () => {
    wrapper = mountManager()

    await rowOf(wrapper, '餐饮').find('button').trigger('click')
    await flushPromises()

    expect(modal().text()).toContain('已有分类不能改收支类型')

    // 类型开关整个不出现，而不是出现后被禁用
    const typeToggles = [...modal().element.querySelectorAll('button')].filter((b) =>
      ['支出', '收入'].includes(b.textContent?.trim() ?? ''),
    )
    expect(typeToggles).toHaveLength(0)
  })
})

describe('删除', () => {
  it('有账目引用时拒绝删除，并说清为什么', async () => {
    spend('餐饮')
    wrapper = mountManager()

    await rowOf(wrapper, '餐饮').find('button[aria-label="删除分类 餐饮"]').trigger('click')
    await flushPromises()

    expect(lastToast()).toBe('该分类下已有账目，无法删除')
    expect(store.categories.some((c) => c.name === '餐饮')).toBe(true)
    expect(wrapper.text()).toContain('餐饮')
  })

  it('设过预算时也拒绝删除', async () => {
    store.setBudget(categoryIdOf('娱乐'), '2026-09', 50000)
    wrapper = mountManager()

    await rowOf(wrapper, '娱乐').find('button[aria-label="删除分类 娱乐"]').trigger('click')
    await flushPromises()

    expect(lastToast()).toBe('该分类已设置预算，请先删除预算')
    expect(store.categories.some((c) => c.name === '娱乐')).toBe(true)
  })

  it('没人引用的分类点一下就删掉，列表同步消失', async () => {
    wrapper = mountManager()

    await rowOf(wrapper, '娱乐').find('button[aria-label="删除分类 娱乐"]').trigger('click')
    await flushPromises()

    expect(lastToast()).toContain('已删除「娱乐」')
    expect(store.categories.some((c) => c.name === '娱乐')).toBe(false)
    expect(wrapper.text()).not.toContain('娱乐')
  })
})
