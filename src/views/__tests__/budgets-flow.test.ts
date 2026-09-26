/**
 * 预算主流程集成测试：预算页（按月）与首页预算提醒的联动。
 * 阶段 6 的验收标准「80%/100% 临界状态色与文案切换」由 BudgetManager 组件测试兜住，
 * 这里补充跨页面的口径一致性——首页只看当前月、只显示越线的分类。
 */

import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import BudgetsView from '@/views/BudgetsView.vue'
import DashboardView from '@/views/DashboardView.vue'
import { useMonth } from '@/composables/useMonth'
import { currentMonth } from '@/lib/date'
import { useDbStore } from '@/stores/db'

type Wrapper = ReturnType<typeof mount>

const MONTH = currentMonth()

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/budgets', component: { template: '<div />' } },
    { path: '/transactions', component: { template: '<div />' } },
    { path: '/settings', component: { template: '<div />' } },
    { path: '/transactions/:id/edit', component: { template: '<div />' } },
  ],
})

let store: ReturnType<typeof useDbStore>
let wrapper: Wrapper | null = null

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  useMonth().reset()
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

async function mountAt(component: Component): Promise<Wrapper> {
  const w = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}

/**
 * 预算提醒区块。首页同时还有「最近记录」，两者都会出现分类名，
 * 断言必须限定在提醒区块内，否则会被最近记录里的同名分类带偏。
 */
function alertSection(w: Wrapper) {
  const section = w.findAll('section').find((s) => s.text().includes('预算提醒'))
  if (!section) throw new Error('首页没有渲染预算提醒区块')
  return section
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

/** 设预算 + 造一笔当月支出 */
function setupBudget(name: string, limitCents: number, spentCents: number): void {
  const categoryId = categoryIdOf(name)
  store.setBudget(categoryId, MONTH, limitCents)
  if (spentCents === 0) return
  store.addTransaction({
    type: 'expense',
    accountId: cashId(),
    categoryId,
    amount: spentCents,
    occurredAt: `${MONTH}-10`,
  })
}

describe('预算页', () => {
  it('展示当前月预算与月份选择器', async () => {
    setupBudget('餐饮', 100000, 50000)
    wrapper = await mountAt(BudgetsView)

    expect(wrapper.text()).toContain('餐饮')
    expect(wrapper.text()).toContain('50%')
    expect(wrapper.text()).toContain('预算')
    expect(wrapper.find('button[aria-label="上一个月"]').exists()).toBe(true)
  })

  it('翻到上个月看到的是上个月的预算，不是本月的', async () => {
    setupBudget('餐饮', 100000, 50000)
    store.setBudget(categoryIdOf('交通'), '2026-08', 30000)

    wrapper = await mountAt(BudgetsView)
    // 当前月没有交通预算
    expect(wrapper.text()).not.toContain('交通')

    useMonth().goTo('2026-08')
    await flushPromises()

    expect(wrapper.text()).toContain('交通')
    expect(wrapper.text()).not.toContain('餐饮')
  })
})

describe('首页预算提醒', () => {
  it('只列出越线的分类', async () => {
    setupBudget('餐饮', 100000, 85000) // 85% → 提醒
    setupBudget('交通', 100000, 30000) // 30% → 不提醒
    setupBudget('购物', 100000, 120000) // 120% → 提醒

    wrapper = await mountAt(DashboardView)

    const alerts = alertSection(wrapper).text()
    expect(alerts).toContain('餐饮')
    expect(alerts).toContain('接近上限')
    expect(alerts).toContain('85%')
    expect(alerts).toContain('购物')
    expect(alerts).toContain('已超支')
    expect(alerts).not.toContain('交通')
  })

  it('没有越线预算时整个区块不渲染', async () => {
    setupBudget('餐饮', 100000, 30000)
    wrapper = await mountAt(DashboardView)

    expect(wrapper.text()).not.toContain('预算提醒')
  })

  it('首页只看当前月，翻到别的月份不影响首页', async () => {
    // 上月超支，本月正常
    const categoryId = categoryIdOf('餐饮')
    store.setBudget(categoryId, '2026-08', 10000)
    store.addTransaction({
      type: 'expense',
      accountId: cashId(),
      categoryId,
      amount: 50000,
      occurredAt: '2026-08-10',
    })
    setupBudget('交通', 100000, 30000)

    useMonth().goTo('2026-08')
    wrapper = await mountAt(DashboardView)

    // 账单页翻到 8 月，首页仍是当前月的口径：8 月的超支不该出现在首页
    expect(useMonth().month.value).toBe('2026-08')
    expect(wrapper.text()).not.toContain('预算提醒')
  })
})

describe('首页本月概览', () => {
  it('显示结余与收支', async () => {
    store.addTransaction({
      type: 'income',
      accountId: cashId(),
      categoryId: categoryIdOf('工资'),
      amount: 500000,
      occurredAt: `${MONTH}-05`,
    })
    setupBudget('餐饮', 100000, 120000)

    wrapper = await mountAt(DashboardView)

    expect(wrapper.text()).toContain('3,800.00') // 5000 - 1200
    expect(wrapper.text()).toContain('1,200.00')
    expect(wrapper.text()).toContain('5,000.00')
  })

  it('没有任何账目时给出空状态', async () => {
    wrapper = await mountAt(DashboardView)

    expect(wrapper.text()).toContain('还没有记账')
    expect(wrapper.text()).not.toContain('最近记录')
  })
})
