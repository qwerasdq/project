import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useAccountForm } from '../useAccountForm'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>
type Form = ReturnType<typeof useAccountForm>

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

function setup(accountId?: string): Form {
  return useAccountForm(() => accountId)
}

function accountIdOf(name: string): string {
  const a = store.accounts.find((x) => x.name === name)
  if (!a) throw new Error(`测试夹具缺少账户：${name}`)
  return a.id
}

describe('新建账户', () => {
  it('默认人民币、0 余额、预设图标与颜色', () => {
    const form = setup()

    expect(form.mode.value).toBe('create')
    expect(form.state).toMatchObject({
      name: '',
      currency: 'CNY',
      initialBalanceText: '0.00',
      icon: '💵',
      color: '#2a78d6',
    })
  })

  it('账户名必填、限长', () => {
    const form = setup()

    expect(form.submit()).toBe(false)
    expect(form.errors.name).toBe('请输入账户名')

    form.state.name = '一二三四五六七八九十一二三'
    expect(form.submit()).toBe(false)
    expect(form.errors.name).toBe('账户名不能超过 12 个字')
    expect(store.db.accounts).toHaveLength(1)
  })

  it('初始余额允许为负（信用卡欠款）', () => {
    const form = setup()
    form.state.name = '信用卡'
    form.state.initialBalanceText = '-1234.56'

    expect(form.submit()).toBe(true)

    const created = store.accounts.find((a) => a.name === '信用卡')
    expect(created).toMatchObject({ currency: 'CNY', initialBalance: -123456 })
  })

  it('初始余额格式错时报错且不写入', () => {
    const form = setup()
    form.state.name = '测试'
    form.state.initialBalanceText = 'abc'

    expect(form.submit()).toBe(false)
    expect(form.errors.initialBalance).toBe('金额格式不正确，最多两位小数')
    expect(store.db.accounts).toHaveLength(1)
  })

  it('外币账户按所选币种保存', () => {
    const form = setup()
    form.state.name = '美元卡'
    form.state.currency = 'USD'
    form.state.initialBalanceText = '100'

    expect(form.submit()).toBe(true)
    expect(store.accounts.find((a) => a.name === '美元卡')?.currency).toBe('USD')
  })
})

describe('编辑账户', () => {
  it('载入原值，初始余额按元回填', () => {
    store.addAccount({
      name: '招行',
      currency: 'USD',
      initialBalance: -5000,
      icon: '💳',
      color: '#1baf7a',
    })

    const form = setup(accountIdOf('招行'))

    expect(form.mode.value).toBe('edit')
    expect(form.state).toMatchObject({
      name: '招行',
      currency: 'USD',
      initialBalanceText: '-50.00',
      icon: '💳',
      color: '#1baf7a',
    })
  })

  it('保存是更新而非新增', () => {
    const id = accountIdOf('现金')
    const form = setup(id)
    form.state.name = '零钱'
    form.state.initialBalanceText = '200'

    expect(form.submit()).toBe(true)

    expect(store.accounts).toHaveLength(1)
    expect(store.accounts[0]).toMatchObject({ id, name: '零钱', initialBalance: 20000 })
  })

  it('账户已有账目时锁定币种，且提交时不会偷偷改掉', () => {
    const id = accountIdOf('现金')
    store.addTransaction({
      type: 'expense',
      accountId: id,
      categoryId: store.categories[0]?.id ?? '',
      amount: 1000,
      occurredAt: '2026-09-05',
    })

    const form = setup(id)
    expect(form.currencyLocked.value).toBe(true)

    form.state.currency = 'USD' // 绕过界面上的禁用态直接改
    form.state.name = '现金'
    expect(form.submit()).toBe(true)

    expect(store.accountOf(id)?.currency).toBe('CNY')
  })

  it('没有账目时不锁币种', () => {
    store.addAccount({
      name: '空账户',
      currency: 'CNY',
      initialBalance: 0,
      icon: '💵',
      color: '#2a78d6',
    })

    expect(setup(accountIdOf('空账户')).currencyLocked.value).toBe(false)
  })

  it('归档与恢复', () => {
    const form = setup(accountIdOf('现金'))

    form.setArchived(true)
    expect(store.accountOf(accountIdOf('现金'))?.archived).toBe(true)

    form.setArchived(false)
    expect(store.accountOf(accountIdOf('现金'))?.archived).toBe(false)
  })

  it('余额包含该账户下的全部收支', () => {
    const id = accountIdOf('现金')
    store.updateAccount(id, { initialBalance: 10000 })
    const categoryId = store.categories[0]?.id ?? ''
    store.addTransaction({ type: 'expense', accountId: id, categoryId, amount: 3000, occurredAt: '2026-09-05' })
    store.addTransaction({ type: 'income', accountId: id, categoryId, amount: 500, occurredAt: '2026-09-06' })

    expect(setup(id).balance.value).toBe(7500)
    expect(setup(id).transactionCount.value).toBe(2)
  })
})
