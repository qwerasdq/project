import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import TransactionForm from '../TransactionForm.vue'
import { useToast } from '@/composables/useToast'
import { currentMonth } from '@/lib/date'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>
type Wrapper = ReturnType<typeof mount>

// 组件里用了 RouterLink（「管理分类」），挂载时必须给路由
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/categories', component: { template: '<div />' } },
  ],
})

let store: Store
let wrapper: Wrapper | null = null

beforeEach(async () => {
  localStorage.clear()
  const pinia = createPinia()
  setActivePinia(pinia)
  store = useDbStore()

  await router.push('/')
  await router.isReady()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function mountForm(transactionId?: string): Wrapper {
  return mount(TransactionForm, {
    props: transactionId ? { transactionId } : {},
    global: { plugins: [router] },
    attachTo: document.body,
  })
}

/** 按可见文案精确定位按钮：'保存' 与 '保存并再记一笔' 不能混淆 */
function buttonByText(w: Wrapper, text: string) {
  const button = w.findAll('button').find((b) => b.text().trim() === text)
  if (!button) throw new Error(`界面上找不到按钮：${text}`)
  return button
}

/**
 * BaseModal 的内容被 Teleport 到 body，wrapper.findAll 的范围里没有它，
 * 只能直接在 document 上找。这是 Teleport 组件的通用测试姿势。
 */
function modalButtonByText(text: string): DOMWrapper<Element> {
  const button = [...document.body.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )
  if (!button) throw new Error(`弹层里找不到按钮：${text}`)
  return new DOMWrapper(button)
}

function categoryButton(w: Wrapper, name: string) {
  const button = w.findAll('button').find((b) => b.text().includes(name))
  if (!button) throw new Error(`分类网格里找不到：${name}`)
  return button
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

describe('记一笔', () => {
  it('选分类 + 填金额 + 保存 → 写入 store', async () => {
    wrapper = mountForm()

    await categoryButton(wrapper, '餐饮').trigger('click')
    await wrapper.get('#tx-amount').setValue('12.30')
    await buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(store.db.transactions).toHaveLength(1)
    expect(store.db.transactions[0]).toMatchObject({
      type: 'expense',
      categoryId: categoryIdOf('餐饮'),
      accountId: cashId(),
      amount: 1230,
    })
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('没选分类就保存 → 提示且不写入', async () => {
    wrapper = mountForm()

    await wrapper.get('#tx-amount').setValue('12.30')
    await buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('请选择分类')
    expect(store.db.transactions).toHaveLength(0)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })

  it('金额格式非法时提示，失焦即校验', async () => {
    wrapper = mountForm()

    const input = wrapper.get('#tx-amount')
    await input.setValue('1.234')
    await input.trigger('blur')

    expect(wrapper.text()).toContain('金额格式不正确，最多两位小数')
  })

  it('切到收入方向后选收入分类，存下来的是收入', async () => {
    wrapper = mountForm()

    await buttonByText(wrapper, '收入').trigger('click')
    await categoryButton(wrapper, '工资').trigger('click')
    await wrapper.get('#tx-amount').setValue('8000')
    await buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(store.db.transactions[0]).toMatchObject({ type: 'income', amount: 800000 })
  })

  it('「保存并再记一笔」清空金额与分类，但保留方向', async () => {
    wrapper = mountForm()

    await categoryButton(wrapper, '餐饮').trigger('click')
    await wrapper.get('#tx-amount').setValue('12.30')
    await buttonByText(wrapper, '保存并再记一笔').trigger('click')
    await flushPromises()

    expect(store.db.transactions).toHaveLength(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect((wrapper.get('#tx-amount').element as HTMLInputElement).value).toBe('')
    expect(wrapper.get('#tx-amount').attributes('aria-invalid')).toBeUndefined()
  })
})

describe('编辑账目', () => {
  function seed(): string {
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

  it('回填原值：金额按元显示，分类已选中', () => {
    wrapper = mountForm(seed())

    expect((wrapper.get('#tx-amount').element as HTMLInputElement).value).toBe('30.50')
    expect(categoryButton(wrapper, '餐饮').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
  })

  it('改金额后保存 → 是更新，不新增记录', async () => {
    const id = seed()
    wrapper = mountForm(id)

    await wrapper.get('#tx-amount').setValue('99.99')
    await buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()

    expect(store.db.transactions).toHaveLength(1)
    expect(store.db.transactions[0]).toMatchObject({ id, amount: 9999 })
  })

  it('删除需二次确认，确认后记录消失', async () => {
    const id = seed()
    wrapper = mountForm(id)

    await buttonByText(wrapper, '删除这笔账').trigger('click')
    expect(store.db.transactions).toHaveLength(1) // 还没确认

    await modalButtonByText('删除').trigger('click')
    await flushPromises()

    expect(store.db.transactions).toHaveLength(0)
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })
})

describe('预算跨线 toast', () => {
  /** Toast 是模块级单例，断言前先清空，避免用例之间互相干扰 */
  function toasts() {
    return useToast().items.value
  }

  async function record(w: Wrapper, amount: string): Promise<void> {
    await categoryButton(w, '餐饮').trigger('click')
    await w.get('#tx-amount').setValue(amount)
    await buttonByText(w, '保存').trigger('click')
    await flushPromises()
  }

  it('越过 80% 时弹一次 warning toast', async () => {
    toasts().splice(0)
    store.setBudget(categoryIdOf('餐饮'), currentMonth(), 10000) // 100 元
    wrapper = mountForm()

    await record(wrapper, '85')

    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]).toMatchObject({ level: 'warning' })
    expect(toasts()[0]?.message).toContain('85%')
  })

  it('越过 100% 时弹 over toast', async () => {
    toasts().splice(0)
    store.setBudget(categoryIdOf('餐饮'), currentMonth(), 10000)
    wrapper = mountForm()

    await record(wrapper, '120')

    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]).toMatchObject({ level: 'over' })
    expect(toasts()[0]?.message).toContain('已超支')
  })

  it('已在超支状态继续记账不再重复警告，只提示保存成功', async () => {
    toasts().splice(0)
    store.setBudget(categoryIdOf('餐饮'), currentMonth(), 10000)
    wrapper = mountForm()

    await record(wrapper, '120')
    toasts().splice(0)

    await record(wrapper, '5')

    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]).toMatchObject({ level: 'success' })
  })

  it('没设预算时只提示保存成功', async () => {
    toasts().splice(0)
    wrapper = mountForm()

    await record(wrapper, '85')

    expect(toasts()).toHaveLength(1)
    expect(toasts()[0]).toMatchObject({ level: 'success' })
  })
})

describe('转账记录', () => {
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

  it('只读展示，不出现金额输入框与保存按钮', () => {
    wrapper = mountForm(seedTransfer())

    expect(wrapper.find('#tx-amount').exists()).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text().trim() === '保存')).toBe(false)
    expect(wrapper.text()).toContain('转账记录不可直接编辑')
  })

  it('删除转账会一并删掉两条配对记录', async () => {
    wrapper = mountForm(seedTransfer())
    expect(store.db.transactions).toHaveLength(2)

    await buttonByText(wrapper, '删除转账记录').trigger('click')
    await modalButtonByText('删除').trigger('click')
    await flushPromises()

    expect(store.db.transactions).toHaveLength(0)
  })
})
