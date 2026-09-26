/**
 * 设置页集成测试。
 *
 * 重点在最后一条：**改完汇率，首页的金额必须跟着变**。汇率是手工维护的，
 * 如果它没有真正进入统计口径，用户会以为「填了没用」，然后开始怀疑所有数字。
 * 这里跨两个页面走一遍：设置页输入 → store → 首页渲染。
 */

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import SettingsView from '@/views/SettingsView.vue'
import { useToast } from '@/composables/useToast'
import { currentMonth } from '@/lib/date'
import { useDbStore } from '@/stores/db'

type Wrapper = ReturnType<typeof mount>

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/settings', component: { template: '<div />' } },
    { path: '/transactions', component: { template: '<div />' } },
  ],
})

let store: ReturnType<typeof useDbStore>
const mounted: Wrapper[] = []

beforeEach(async () => {
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  useToast().items.value.splice(0)
  await router.push('/settings')
  await router.isReady()
})

afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

async function mountView(component: Parameters<typeof mount>[0]): Promise<Wrapper> {
  const w = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  mounted.push(w)
  await flushPromises()
  return w
}

function addUsdAccount(): string {
  const account = store.addAccount({
    name: '美元卡',
    currency: 'USD',
    initialBalance: 0,
    icon: '💳',
    color: '#2a78d6',
  })
  return account.id
}

function firstExpenseCategoryId(): string {
  const category = store.categoriesByType.expense[0]
  if (!category) throw new Error('测试夹具缺少支出分类')
  return category.id
}

function buttonByText(w: Wrapper, text: string) {
  const button = w.findAll('button').find((b) => b.text().trim() === text)
  if (!button) throw new Error(`找不到按钮：${text}`)
  return button
}

/** BaseModal 被 Teleport 到 body，只能在 document 上找 */
function modalButtonByText(text: string) {
  const dialog = document.body.querySelector('[role="dialog"]')
  if (!dialog) throw new Error('弹层没有打开')
  const button = [...dialog.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )
  if (!button) throw new Error(`弹层里找不到按钮：${text}`)
  return button as HTMLButtonElement
}

describe('页面内容', () => {
  it('写明主币种固定为人民币', async () => {
    const wrapper = await mountView(SettingsView)

    expect(wrapper.text()).toContain('主币种')
    expect(wrapper.text()).toContain('人民币（CNY）')
    expect(wrapper.text()).toContain('当前版本固定为人民币')
  })

  it('没有外币账户时汇率区给出引导，不列空输入框', async () => {
    const wrapper = await mountView(SettingsView)

    expect(wrapper.text()).toContain('还没有外币账户')
    expect(wrapper.findAll('input')).toHaveLength(0)
  })

  it('有外币账户时列出该币种，标签写明换算方向', async () => {
    addUsdAccount()
    const wrapper = await mountView(SettingsView)

    expect(wrapper.text()).toContain('1 美元 = ? 人民币')
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('把要销毁的数据先数清楚', async () => {
    const usd = addUsdAccount()
    store.addTransaction({
      type: 'expense',
      accountId: usd,
      categoryId: firstExpenseCategoryId(),
      amount: 1000,
      occurredAt: `${currentMonth()}-05`,
    })
    const wrapper = await mountView(SettingsView)

    expect(wrapper.text()).toContain('所有数据只保存在这台设备的浏览器里')
    expect(wrapper.text()).toContain('账目')
    expect(wrapper.text()).toContain('账户')
  })
})

describe('汇率维护', () => {
  it('失焦提交后写入 store，界面回填归一化后的值', async () => {
    addUsdAccount()
    const wrapper = await mountView(SettingsView)

    const input = wrapper.find('input')
    await input.setValue('7.10')
    await flushPromises()
    // 打字过程中不提交：中间态「7.」会被判成非法，用户还没输完就被标红
    expect(store.db.settings.exchangeRates.USD).toBeUndefined()

    await input.trigger('blur')
    expect(store.db.settings.exchangeRates.USD).toBe(7.1)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('7.1')
  })

  it('非法输入标错且不写入，原文留在框里', async () => {
    addUsdAccount()
    const wrapper = await mountView(SettingsView)

    const input = wrapper.find('input')
    await input.setValue('abc')
    await input.trigger('blur')

    expect(store.db.settings.exchangeRates.USD).toBeUndefined()
    expect(wrapper.text()).toContain('汇率格式不正确')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('abc')
  })

  it('清空输入即撤销汇率，不报错', async () => {
    addUsdAccount()
    store.setExchangeRate('USD', 7.1)
    const wrapper = await mountView(SettingsView)

    const input = wrapper.find('input')
    expect((input.element as HTMLInputElement).value).toBe('7.1')

    await input.setValue('')
    await input.trigger('blur')
    await flushPromises()

    expect(store.db.settings.exchangeRates.USD).toBeUndefined()
    expect(wrapper.text()).not.toContain('汇率格式不正确')
  })

  it('改汇率后首页金额实时变化 —— 新值真的进了统计口径', async () => {
    const usd = addUsdAccount()
    store.addTransaction({
      type: 'expense',
      accountId: usd,
      categoryId: firstExpenseCategoryId(),
      amount: 1000, // 10 美元
      occurredAt: `${currentMonth()}-05`,
    })

    const { default: DashboardView } = await import('@/views/DashboardView.vue')

    // 未设汇率：按 1:1 兜底，10 美元当 10 元
    const before = await mountView(DashboardView)
    expect(before.text()).toContain('¥10.00')
    before.unmount()
    mounted.pop()

    const settings = await mountView(SettingsView)
    const input = settings.find('input')
    await input.setValue('7.1')
    await input.trigger('blur')
    await flushPromises()

    const after = await mountView(DashboardView)
    expect(after.text()).toContain('¥71.00')
    expect(after.text()).not.toContain('¥10.00')
  })
})

describe('清空数据', () => {
  it('点按钮只是打开二次确认，数据一条不动', async () => {
    addUsdAccount()
    const wrapper = await mountView(SettingsView)

    await buttonByText(wrapper, '清空所有数据').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(store.db.accounts).toHaveLength(2)
  })

  it('确认后回到种子状态：账户、账目、预算、汇率一起清掉', async () => {
    const usd = addUsdAccount()
    store.setExchangeRate('USD', 7.1)
    const categoryId = firstExpenseCategoryId()
    store.addTransaction({
      type: 'expense',
      accountId: usd,
      categoryId,
      amount: 1000,
      occurredAt: `${currentMonth()}-05`,
    })
    store.setBudget(categoryId, currentMonth(), 100000)

    const wrapper = await mountView(SettingsView)
    await buttonByText(wrapper, '清空所有数据').trigger('click')
    await flushPromises()
    modalButtonByText('清空').click()
    await flushPromises()

    expect(store.db.transactions).toHaveLength(0)
    expect(store.db.budgets).toHaveLength(0)
    expect(store.db.accounts).toHaveLength(1)
    expect(store.db.accounts[0]?.currency).toBe('CNY')
    expect(store.db.settings.exchangeRates.USD).toBeUndefined()

    const toasts = useToast().items.value
    expect(toasts[toasts.length - 1]?.message).toContain('已清空')
  })

  it('取消不动数据', async () => {
    addUsdAccount()
    const wrapper = await mountView(SettingsView)

    await buttonByText(wrapper, '清空所有数据').trigger('click')
    await flushPromises()
    modalButtonByText('取消').click()
    await flushPromises()

    expect(store.db.accounts).toHaveLength(2)
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})
