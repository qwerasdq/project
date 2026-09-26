/**
 * 账户与转账主流程集成测试。
 * 阶段 5 的验收标准「CNY/USD 两账户同币种 + 跨币种转账各一笔，余额正确、
 * 成对删除、统计排除转账」由这里兜住。
 */

import type { Component } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { CurrencyCode } from '@/types'
import TransferForm from '@/features/accounts/TransferForm.vue'
import AccountsView from '@/views/AccountsView.vue'
import { accountBalance, isTransfer, monthTotals } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

type Wrapper = ReturnType<typeof mount>

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/accounts', component: { template: '<div />' } },
    { path: '/settings', component: { template: '<div />' } },
    { path: '/transfers/new', component: { template: '<div />' } },
  ],
})

let store: ReturnType<typeof useDbStore>
let wrapper: Wrapper | null = null

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  await router.push('/accounts')
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

function buttonByText(w: Wrapper, text: string) {
  const button = w.findAll('button').find((b) => b.text().trim() === text)
  if (!button) throw new Error(`界面上找不到按钮：${text}`)
  return button
}

function addAccount(name: string, currency: CurrencyCode, initialBalance = 0): string {
  return store.addAccount({ name, currency, initialBalance, icon: '💳', color: '#2a78d6' }).id
}

function cashId(): string {
  const a = store.activeAccounts.find((x) => x.name === '现金')
  if (!a) throw new Error('测试夹具缺少「现金」账户')
  return a.id
}

function balanceOf(accountId: string): number {
  const account = store.accountOf(accountId)
  if (!account) throw new Error(`账户不存在：${accountId}`)
  return accountBalance(account, store.db.transactions)
}

/** 在转账表单上选好账户并填金额 */
async function fillTransfer(w: Wrapper, from: string, to: string, amount: string): Promise<void> {
  const selects = w.findAll('select')
  await selects[0]?.setValue(from)
  await selects[1]?.setValue(to)
  await flushPromises()
  await w.get('#transfer-amount').setValue(amount)
  await flushPromises()
}

describe('账户列表', () => {
  it('展示账户名、币种与余额', async () => {
    addAccount('美元卡', 'USD', 12345)
    wrapper = await mountAt(AccountsView)

    expect(wrapper.text()).toContain('现金')
    expect(wrapper.text()).toContain('美元卡')
    expect(wrapper.text()).toContain('美元')
    expect(wrapper.text()).toContain('123.45')
  })

  it('已归档账户默认折叠在分组里', async () => {
    const id = addAccount('旧卡', 'CNY')
    store.setAccountArchived(id, true)
    wrapper = await mountAt(AccountsView)

    expect(wrapper.text()).toContain('已归档（1）')
    expect(wrapper.text()).toContain('在用账户')

    await wrapper.get('button[aria-expanded]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('旧卡')
  })

  it('总资产折算主币种，缺汇率时给出提示', async () => {
    addAccount('美元卡', 'USD', 10000) // 100 美元
    store.updateAccount(cashId(), { initialBalance: 10000 }) // 100 元
    wrapper = await mountAt(AccountsView)

    // 未设置汇率 → 按 1:1 折算，200 元；但必须显式提示
    expect(wrapper.text()).toContain('200.00')
    expect(wrapper.text()).toContain('未设置 USD 的汇率')

    store.setExchangeRate('USD', 7)
    await flushPromises()

    expect(wrapper.text()).toContain('800.00')
  })

  it('点账户卡片打开编辑弹层', async () => {
    wrapper = await mountAt(AccountsView)

    const card = wrapper.findAll('button').find((b) => b.text().includes('现金'))
    if (!card) throw new Error('找不到账户卡片按钮')
    await card.trigger('click')
    await flushPromises()

    // BaseModal 被 Teleport 到 body，只能在 document 上查
    expect(document.body.textContent).toContain('编辑账户')
  })
})

describe('同币种转账', () => {
  it('生成两条成对记录，两侧余额正确', async () => {
    const target = addAccount('招行', 'CNY')
    store.updateAccount(cashId(), { initialBalance: 100000 }) // 1000 元

    wrapper = await mountAt(TransferForm)
    await fillTransfer(wrapper, cashId(), target, '300')
    await buttonByText(wrapper, '确认转账').trigger('click')
    await flushPromises()

    expect(store.db.transactions).toHaveLength(2)
    expect(store.db.transactions.every(isTransfer)).toBe(true)

    expect(balanceOf(cashId())).toBe(70000)
    expect(balanceOf(target)).toBe(30000)
  })

  it('余额不足只提示，仍可提交', async () => {
    const target = addAccount('招行', 'CNY')
    wrapper = await mountAt(TransferForm)
    await fillTransfer(wrapper, cashId(), target, '100')

    expect(wrapper.text()).toContain('超过该账户余额')

    await buttonByText(wrapper, '确认转账').trigger('click')
    await flushPromises()

    expect(store.db.transactions).toHaveLength(2)
    expect(balanceOf(cashId())).toBe(-10000)
  })
})

describe('跨币种转账', () => {
  it('按设置里的汇率换算到账金额', async () => {
    const usd = addAccount('美元卡', 'USD')
    store.setExchangeRate('USD', 7.14)
    store.updateAccount(cashId(), { initialBalance: 100000 }) // 1000 元

    wrapper = await mountAt(TransferForm)
    await fillTransfer(wrapper, cashId(), usd, '714')

    // 714 元 ÷ 7.14 = 100 美元
    expect(wrapper.text()).toContain('100.00')

    await buttonByText(wrapper, '确认转账').trigger('click')
    await flushPromises()

    expect(balanceOf(cashId())).toBe(100000 - 71400)
    expect(balanceOf(usd)).toBe(10000)
  })

  it('未设置汇率时提示按 1:1 预填', async () => {
    const hkd = addAccount('港币卡', 'HKD')
    wrapper = await mountAt(TransferForm)
    await fillTransfer(wrapper, cashId(), hkd, '100')

    expect(wrapper.text()).toContain('汇率还没设置')
  })
})

describe('转账与统计的关系', () => {
  it('转账不计入收支统计，但计入账户余额', async () => {
    const target = addAccount('招行', 'CNY')
    wrapper = await mountAt(TransferForm)
    await fillTransfer(wrapper, cashId(), target, '300')
    await buttonByText(wrapper, '确认转账').trigger('click')
    await flushPromises()

    const month = (store.db.transactions[0]?.occurredAt ?? '').slice(0, 7)
    expect(monthTotals(store.db.transactions, month, store.statsCtx)).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
    })

    expect(balanceOf(cashId())).toBe(-30000)
    expect(balanceOf(target)).toBe(30000)
  })

  it('删除任意一条腿，配对记录一并消失，余额复原', async () => {
    const target = addAccount('招行', 'CNY')
    store.updateAccount(cashId(), { initialBalance: 100000 })
    wrapper = await mountAt(TransferForm)
    await fillTransfer(wrapper, cashId(), target, '300')
    await buttonByText(wrapper, '确认转账').trigger('click')
    await flushPromises()

    const leg = store.db.transactions[0]
    if (!leg) throw new Error('转账没有写进 store')
    store.deleteTransaction(leg.id)

    expect(store.db.transactions).toHaveLength(0)
    expect(balanceOf(cashId())).toBe(100000)
    expect(balanceOf(target)).toBe(0)
  })
})
