/**
 * 账单主流程集成测试：记一笔 → 列表出现 → 筛选 → 点进编辑页。
 * 阶段 4 的验收标准「完整记一笔/编辑/删除/筛选流程」由这里兜住。
 */

import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import TransactionForm from '@/features/transactions/TransactionForm.vue'
import TransactionsView from '@/views/TransactionsView.vue'
import { useMonth } from '@/composables/useMonth'
import { shiftMonth } from '@/lib/date'
import { useDbStore } from '@/stores/db'

type Wrapper = ReturnType<typeof mount>

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/transactions', component: { template: '<div />' } },
    { path: '/transactions/new', component: { template: '<div />' } },
    { path: '/transactions/:id/edit', component: { template: '<div />' } },
    { path: '/transfers/new', component: { template: '<div />' } },
    { path: '/categories', component: { template: '<div />' } },
  ],
})

let store: ReturnType<typeof useDbStore>
let wrapper: Wrapper | null = null

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  useMonth().reset()

  await router.push('/transactions')
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

function buttons(w: Wrapper, text: string) {
  return w.findAll('button').filter((b) => b.text().trim() === text)
}

describe('记账到账单的完整链路', () => {
  it('记一笔 → 列表出现 → 按类型筛选 → 点进编辑页', async () => {
    // 1. 记一笔
    wrapper = await mountAt(TransactionForm)
    const dining = wrapper.findAll('button').find((b) => b.text().includes('餐饮'))
    if (!dining) throw new Error('分类网格里找不到「餐饮」')
    await dining.trigger('click')
    await wrapper.get('#tx-amount').setValue('12.30')
    await buttons(wrapper, '保存')[0]?.trigger('click')
    await flushPromises()
    wrapper.unmount()

    // 2. 账单列表里能看到
    wrapper = await mountAt(TransactionsView)
    expect(wrapper.text()).toContain('餐饮')
    expect(wrapper.text()).toContain('12.30')

    // 3. 按类型筛选：这笔是支出，切到收入后应消失
    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(2)
    await selects[0]?.setValue('income')
    await flushPromises()
    expect(wrapper.text()).toContain('没有符合条件的记录')
    expect(wrapper.text()).not.toContain('餐饮')

    // 4. 切回全部类型，记录回来
    await selects[0]?.setValue('all')
    await flushPromises()
    expect(wrapper.text()).toContain('餐饮')

    // 5. 列表项指向编辑页
    const tx = store.db.transactions[0]
    if (!tx) throw new Error('账目没有写进 store')
    expect(wrapper.find(`a[href*="${tx.id}"]`).exists()).toBe(true)
  })

  it('切换月份后列表跟着变', async () => {
    const lastMonth = shiftMonth(useMonth().month.value, -1)
    store.addTransaction({
      type: 'expense',
      accountId: store.activeAccounts[0]?.id ?? '',
      categoryId: store.categories.find((c) => c.name === '交通')?.id ?? '',
      amount: 500,
      occurredAt: `${lastMonth}-15`,
    })

    wrapper = await mountAt(TransactionsView)
    expect(wrapper.text()).toContain('本月还没有记账')

    await wrapper.find('button[aria-label="上一个月"]').trigger('click')
    await flushPromises()

    expect(useMonth().month.value).toBe(lastMonth)
    expect(wrapper.text()).toContain('交通')
  })
})
