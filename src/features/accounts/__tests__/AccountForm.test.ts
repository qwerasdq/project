import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import AccountForm from '../AccountForm.vue'
import { accountBalance } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>
type Wrapper = ReturnType<typeof mount>

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

let store: Store
let wrapper: Wrapper | null = null

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountForm(accountId?: string): Wrapper {
  return mount(AccountForm, {
    props: accountId ? { accountId } : {},
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

/** 表单里只有「账户名」和「初始余额」两个输入框，一前一后 */
function inputs(w: Wrapper) {
  return w.findAll('input')
}

function buttonByText(w: Wrapper, text: string) {
  const button = w.findAll('button').find((b) => b.text().trim() === text)
  if (!button) throw new Error(`界面上找不到按钮：${text}`)
  return button
}

function accountByName(name: string) {
  const account = store.accounts.find((a) => a.name === name)
  if (!account) throw new Error(`store 里没有账户：${name}`)
  return account
}

describe('新建账户', () => {
  it('填名字与初始余额即可创建', async () => {
    wrapper = mountForm()

    await inputs(wrapper)[0]?.setValue('招行储蓄卡')
    await inputs(wrapper)[1]?.setValue('2500.00')
    await buttonByText(wrapper, '创建账户').trigger('click')
    await flushPromises()

    expect(accountByName('招行储蓄卡')).toMatchObject({ currency: 'CNY', initialBalance: 250000 })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('初始余额可留空为 0，也可填负数', async () => {
    wrapper = mountForm()

    await inputs(wrapper)[0]?.setValue('信用卡')
    await inputs(wrapper)[1]?.setValue('-800.50')
    await buttonByText(wrapper, '创建账户').trigger('click')
    await flushPromises()

    expect(accountByName('信用卡').initialBalance).toBe(-80050)
  })

  it('名字为空时报错且不创建', async () => {
    wrapper = mountForm()

    await buttonByText(wrapper, '创建账户').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('请输入账户名')
    expect(store.accounts).toHaveLength(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('切换币种后按该币种创建', async () => {
    wrapper = mountForm()

    await inputs(wrapper)[0]?.setValue('美元卡')
    await wrapper.get('select').setValue('USD')
    await buttonByText(wrapper, '创建账户').trigger('click')
    await flushPromises()

    expect(accountByName('美元卡').currency).toBe('USD')
  })
})

describe('编辑账户', () => {
  it('载入后展示当前余额与账目数', async () => {
    const cash = accountByName('现金')
    store.updateAccount(cash.id, { initialBalance: 50000 })
    store.addTransaction({
      type: 'expense',
      accountId: cash.id,
      categoryId: store.categories[0]?.id ?? '',
      amount: 12300,
      occurredAt: '2026-09-05',
    })

    wrapper = mountForm(cash.id)

    expect(accountBalance(accountByName('现金'), store.db.transactions)).toBe(37700)
    expect(wrapper.text()).toContain('377.00')
    expect(wrapper.text()).toContain('1 笔账目')
  })

  it('有账目时币种下拉被禁用', async () => {
    const cash = accountByName('现金')
    store.addTransaction({
      type: 'expense',
      accountId: cash.id,
      categoryId: store.categories[0]?.id ?? '',
      amount: 100,
      occurredAt: '2026-09-05',
    })

    wrapper = mountForm(cash.id)

    expect(wrapper.get('select').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('改币种会让历史金额整体变味')
  })

  it('唯一在用的账户不能归档', async () => {
    wrapper = mountForm(accountByName('现金').id)

    expect(buttonByText(wrapper, '归档账户').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('这是唯一在用的账户')
  })

  it('有多个账户时可以归档，按钮文案随之切换', async () => {
    store.addAccount({
      name: '招行',
      currency: 'CNY',
      initialBalance: 0,
      icon: '💳',
      color: '#1baf7a',
    })
    wrapper = mountForm(accountByName('现金').id)

    await buttonByText(wrapper, '归档账户').trigger('click')
    await flushPromises()

    expect(accountByName('现金').archived).toBe(true)
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })
})
