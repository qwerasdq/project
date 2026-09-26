/**
 * 阶段 6 的验收标准由这里兜住：80% / 100% 两处临界的状态色与文案同步切换。
 * 颜色断言直接打在填充条的 style 上（--status-warning / --status-critical），
 * 避免只验文案不验颜色、或反过来。
 */

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import BudgetManager from '../BudgetManager.vue'
import { useMonth } from '@/composables/useMonth'
import { useToast } from '@/composables/useToast'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>
type Wrapper = ReturnType<typeof mount>

let store: Store
let wrapper: Wrapper | null = null

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  // useMonth 是模块级单例，用例之间必须显式回位
  useMonth().goTo('2026-09')
  useToast().items.value.splice(0)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountManager(): Wrapper {
  return mount(BudgetManager, { attachTo: document.body })
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

function spend(name: string, amount: number): void {
  store.addTransaction({
    type: 'expense',
    accountId: cashId(),
    categoryId: categoryIdOf(name),
    amount,
    occurredAt: '2026-09-10',
  })
}

/** 给某分类设限额并按已花比例造一笔支出 */
function setupBudget(name: string, limitCents: number, spentCents: number): void {
  store.setBudget(categoryIdOf(name), '2026-09', limitCents)
  if (spentCents > 0) spend(name, spentCents)
}

function buttonByText(w: Wrapper, text: string) {
  const button = w.findAll('button').find((b) => b.text().trim() === text)
  if (!button) throw new Error(`界面上找不到按钮：${text}`)
  return button
}

function rowOf(w: Wrapper, name: string) {
  const button = w.findAll('button').find((b) => b.text().includes(name))
  if (!button) throw new Error(`预算列表里找不到：${name}`)
  return button
}

/** BaseModal 的内容被 Teleport 到 body，只能按 role 在 document 上找 */
function modal(): DOMWrapper<Element> {
  const el = document.body.querySelector('[role="dialog"]')
  if (!el) throw new Error('弹层没有打开')
  return new DOMWrapper(el)
}

function modalButtonByText(text: string) {
  const button = [...modal().element.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )
  if (!button) throw new Error(`弹层里找不到按钮：${text}`)
  return new DOMWrapper(button)
}

/** 填充条的配色，用于断言状态色确实跟着切换了 */
function fillStyle(row: DOMWrapper<Element> | ReturnType<typeof rowOf>): string {
  return row.get('[role="progressbar"] > div').attributes('style') ?? ''
}

describe('空状态', () => {
  it('没有任何预算时给出引导，不显示分类列表', () => {
    wrapper = mountManager()

    expect(wrapper.text()).toContain('本月还没有预算')
    expect(wrapper.text()).not.toContain('分类预算')
  })

  it('上月设过预算时提供沿用入口', async () => {
    store.setBudget(categoryIdOf('餐饮'), '2026-08', 120000)
    store.setBudget(categoryIdOf('交通'), '2026-08', 30000)
    wrapper = mountManager()

    await buttonByText(wrapper, '沿用 2026年8月 的预算').trigger('click')
    await flushPromises()

    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')?.limitAmount).toBe(120000)
    expect(store.budgetOf(categoryIdOf('交通'), '2026-09')?.limitAmount).toBe(30000)

    const toasts = useToast().items.value
    expect(toasts[toasts.length - 1]?.message).toContain('已沿用')
  })
})

describe('进度状态切换', () => {
  it('低于 80% 不显示状态文案，填充用普通色', () => {
    setupBudget('餐饮', 100000, 50000)
    wrapper = mountManager()

    const row = rowOf(wrapper, '餐饮')
    expect(row.text()).toContain('50%')
    expect(row.text()).not.toContain('接近上限')
    expect(row.text()).not.toContain('已超支')
    expect(fillStyle(row)).toContain('--meter-fill')
  })

  it('恰好 80% 起切换到「接近上限」+ ⚠️ + warning 色', () => {
    setupBudget('餐饮', 100000, 80000)
    wrapper = mountManager()

    const row = rowOf(wrapper, '餐饮')
    expect(row.text()).toContain('80%')
    expect(row.text()).toContain('⚠️')
    expect(row.text()).toContain('接近上限')
    expect(fillStyle(row)).toContain('--status-warning')
  })

  it('略低于 80% 仍是普通态（79%）', () => {
    setupBudget('餐饮', 100000, 79000)
    wrapper = mountManager()

    const row = rowOf(wrapper, '餐饮')
    expect(row.text()).toContain('79%')
    expect(row.text()).not.toContain('接近上限')
    expect(fillStyle(row)).toContain('--meter-fill')
  })

  it('恰好 100% 切换到「已超支」+ 🔴 + critical 色', () => {
    setupBudget('餐饮', 100000, 100000)
    wrapper = mountManager()

    const row = rowOf(wrapper, '餐饮')
    expect(row.text()).toContain('100%')
    expect(row.text()).toContain('🔴')
    expect(row.text()).toContain('已超支')
    expect(fillStyle(row)).toContain('--status-critical')
  })

  it('超支后进度条最多铺满 100%，超出部分由文案表达', () => {
    setupBudget('餐饮', 100000, 250000)
    wrapper = mountManager()

    const row = rowOf(wrapper, '餐饮')
    expect(row.text()).toContain('250%')
    expect(row.text()).toContain('已超支')
    expect(fillStyle(row)).toContain('width: 100%')
  })

  it('进度条带可读的无障碍属性', () => {
    setupBudget('餐饮', 100000, 85000)
    wrapper = mountManager()

    const bar = rowOf(wrapper, '餐饮').get('[role="progressbar"]')
    expect(bar.attributes('aria-valuenow')).toBe('85')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(bar.attributes('aria-label')).toContain('餐饮')
  })
})

describe('汇总卡片', () => {
  it('显示总限额、已花与剩余', () => {
    setupBudget('餐饮', 100000, 30000)
    setupBudget('交通', 100000, 20000)
    wrapper = mountManager()

    expect(wrapper.text()).toContain('1,000.00') // 总限额
    expect(wrapper.text()).toContain('500.00') // 已花
    expect(wrapper.text()).toContain('剩余')
  })

  it('总支出超过总限额时说「超支」而不是负数剩余', () => {
    setupBudget('餐饮', 100000, 300000)
    wrapper = mountManager()

    expect(wrapper.text()).toContain('超支')
    expect(wrapper.text()).not.toContain('剩余 -')
  })
})

describe('编辑预算', () => {
  it('点某一行打开弹层并回填限额', async () => {
    setupBudget('餐饮', 123400, 10000)
    wrapper = mountManager()

    await rowOf(wrapper, '餐饮').trigger('click')
    await flushPromises()

    expect(modal().text()).toContain('修改预算')
    expect((modal().get('input').element as HTMLInputElement).value).toBe('1234.00')
    expect((modal().get('select').element as HTMLSelectElement).disabled).toBe(true)
  })

  it('改限额后保存，列表随之更新', async () => {
    setupBudget('餐饮', 100000, 10000)
    wrapper = mountManager()

    await rowOf(wrapper, '餐饮').trigger('click')
    await flushPromises()
    await modal().get('input').setValue('800')
    await modalButtonByText('保存').trigger('click')
    await flushPromises()

    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')?.limitAmount).toBe(80000)
    // 100 / 800 = 12.5%，展示时四舍五入到 13%
    expect(rowOf(wrapper, '餐饮').text()).toContain('13%')
  })

  it('删除预算后该行消失', async () => {
    setupBudget('餐饮', 100000, 10000)
    wrapper = mountManager()

    await rowOf(wrapper, '餐饮').trigger('click')
    await flushPromises()
    await modalButtonByText('删除预算').trigger('click')
    await flushPromises()

    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')).toBeUndefined()
    expect(wrapper.text()).toContain('本月还没有预算')
  })
})

describe('新增预算', () => {
  it('选分类 + 填限额 → 写入并出现在列表里', async () => {
    wrapper = mountManager()

    await buttonByText(wrapper, '添加预算').trigger('click')
    await flushPromises()
    await modal().get('select').setValue(categoryIdOf('餐饮'))
    await modal().get('input').setValue('500')
    await modalButtonByText('保存').trigger('click')
    await flushPromises()

    expect(store.budgetOf(categoryIdOf('餐饮'), '2026-09')?.limitAmount).toBe(50000)
    expect(rowOf(wrapper, '餐饮').text()).toContain('0%')
  })

  it('金额非法时在弹层内提示且不写入', async () => {
    wrapper = mountManager()

    await buttonByText(wrapper, '添加预算').trigger('click')
    await flushPromises()
    await modal().get('select').setValue(categoryIdOf('餐饮'))
    await modal().get('input').setValue('0')
    await modalButtonByText('保存').trigger('click')
    await flushPromises()

    expect(modal().text()).toContain('金额必须大于 0')
    expect(store.db.budgets).toHaveLength(0)
  })

  it('没选分类就保存 → 提示', async () => {
    wrapper = mountManager()

    await buttonByText(wrapper, '添加预算').trigger('click')
    await flushPromises()
    await modal().get('input').setValue('500')
    await modalButtonByText('保存').trigger('click')
    await flushPromises()

    expect(modal().text()).toContain('请选择分类')
    expect(store.db.budgets).toHaveLength(0)
  })
})
