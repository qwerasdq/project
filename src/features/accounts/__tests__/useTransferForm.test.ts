import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTransferForm } from '../useTransferForm'
import type { CurrencyCode } from '@/types'
import { accountBalance, isTransfer, monthTotals } from '@/lib/stats'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>
type Form = ReturnType<typeof useTransferForm>

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

/** 建一个账户并返回 id */
function addAccount(name: string, currency: CurrencyCode = 'CNY', initialBalance = 0): string {
  return store.addAccount({
    name,
    currency,
    initialBalance,
    icon: '💳',
    color: '#2a78d6',
  }).id
}

function cashId(): string {
  const a = store.activeAccounts.find((x) => x.name === '现金')
  if (!a) throw new Error('测试夹具缺少「现金」账户')
  return a.id
}

function idOf(name: string): string {
  const a = store.activeAccounts.find((x) => x.name === name)
  if (!a) throw new Error(`测试夹具缺少账户：${name}`)
  return a.id
}

/**
 * 表单的默认转出账户来自 immediate watcher，因此必须等一次 flush。
 * 这里统一在 setup 之后 await，避免每个用例各写一遍。
 */
async function setup(): Promise<Form> {
  const form = useTransferForm()
  await nextTick()
  return form
}

/**
 * 选定转出/转入账户。默认汇率由 watcher 预填，改完账户必须等一次 flush
 * 才能读到，否则看到的还是上一次的 '1'。
 */
async function pick(form: Form, from: string, to: string): Promise<void> {
  form.state.fromAccountId = from
  form.state.toAccountId = to
  await nextTick()
}

describe('账户选择', () => {
  it('默认转出账户取上次记账用的那个', async () => {
    const usd = addAccount('美元卡', 'USD')
    store.addTransaction({
      type: 'expense',
      accountId: usd,
      categoryId: store.categories[0]?.id ?? '',
      amount: 100,
      occurredAt: '2026-09-05',
    })

    const form = await setup()

    expect(form.state.fromAccountId).toBe(usd)
  })

  it('转入账户的候选里不含转出账户', async () => {
    const usd = addAccount('美元卡', 'USD')
    const form = await setup()

    expect(form.state.fromAccountId).toBe(cashId())
    expect(form.toAccountOptions.value.map((o) => o.value)).not.toContain(cashId())
    expect(form.toAccountOptions.value.map((o) => o.value)).toContain(usd)
  })

  it('转出账户改成与转入相同时，转入自动挪到别的账户', async () => {
    const usd = addAccount('美元卡', 'USD')
    const form = await setup()
    form.state.toAccountId = usd

    form.state.fromAccountId = usd
    await nextTick()

    expect(form.state.toAccountId).not.toBe(usd)
    expect(form.state.toAccountId).toBe(cashId())
  })

  it('只有一个账户时转入为空，校验拦住提交', async () => {
    const form = await setup()

    expect(form.state.toAccountId).toBe('')
    expect(form.submit()).toBe(false)
    expect(form.errors.accounts).toBe('请选择转入账户')
  })

  it('交换按钮把两个账户对调，并按新币种重算汇率', async () => {
    addAccount('美元卡', 'USD')
    store.setExchangeRate('USD', 7.14)
    const form = await setup()
    await pick(form, idOf('美元卡'), cashId())
    expect(form.state.rateText).toBe('7.14')

    form.swapAccounts()

    expect(form.state.fromAccountId).toBe(cashId())
    expect(form.state.toAccountId).toBe(idOf('美元卡'))
    expect(form.state.rateText).toBe(String(1 / 7.14))
  })
})

describe('汇率', () => {
  it('同币种不算跨币种，汇率恒为 1', async () => {
    addAccount('招行', 'CNY')
    const form = await setup()
    await pick(form, cashId(), idOf('招行'))

    expect(form.crossCurrency.value).toBe(false)
    expect(form.state.rateText).toBe('1')
    expect(form.rateUnset.value).toBe(false)
  })

  it('跨币种时按当前汇率预填', async () => {
    addAccount('美元卡', 'USD')
    store.setExchangeRate('USD', 7.14)
    const form = await setup()
    await pick(form, idOf('美元卡'), cashId())

    expect(form.crossCurrency.value).toBe(true)
    expect(form.state.rateText).toBe('7.14')
  })

  it('未设置汇率时给出提示', async () => {
    addAccount('美元卡', 'USD')
    const form = await setup()
    await pick(form, idOf('美元卡'), cashId())

    expect(form.rateUnset.value).toBe(true)
  })

  it('用户改过汇率后，换账户不再覆盖', async () => {
    addAccount('美元卡', 'USD')
    addAccount('港币卡', 'HKD')
    store.setExchangeRate('USD', 7.14)
    store.setExchangeRate('HKD', 0.92)
    const form = await setup()
    await pick(form, idOf('美元卡'), idOf('港币卡'))

    form.state.rateText = '0.9'
    form.markRateTouched()
    form.state.toAccountId = cashId()
    await nextTick()

    expect(form.state.rateText).toBe('0.9')
  })

  it('汇率非法时报错', async () => {
    addAccount('美元卡', 'USD')
    const form = await setup()
    await pick(form, idOf('美元卡'), cashId())
    form.state.amountText = '100'
    form.state.rateText = '0'

    expect(form.submit()).toBe(false)
    expect(form.errors.rate).toBe('汇率必须大于 0')
  })
})

describe('金额与到账预览', () => {
  it('同币种到账金额与转出相同', async () => {
    addAccount('招行', 'CNY')
    const form = await setup()
    await pick(form, cashId(), idOf('招行'))
    form.state.amountText = '123.45'

    expect(form.amount.value).toBe(12345)
    expect(form.toAmount.value).toBe(12345)
  })

  it('跨币种按汇率换算到账金额，就近取整到分', async () => {
    addAccount('美元卡', 'USD')
    store.setExchangeRate('USD', 7.14)
    const form = await setup()
    await pick(form, idOf('美元卡'), cashId())
    form.state.amountText = '100'

    // 100 美元 × 7.14 = 714 元
    expect(form.toAmount.value).toBe(71400)
  })

  it('余额不足只警告不拦截', async () => {
    addAccount('招行', 'CNY', 5000) // 50 元
    const form = await setup()
    await pick(form, idOf('招行'), cashId())
    form.state.amountText = '100'

    expect(form.fromBalance.value).toBe(5000)
    expect(form.insufficient.value).toBe(true)
    expect(form.submit()).toBe(true)
  })

  it('金额非法时报错且不写入', async () => {
    addAccount('招行', 'CNY')
    const form = await setup()
    await pick(form, cashId(), idOf('招行'))
    form.state.amountText = '0'

    expect(form.submit()).toBe(false)
    expect(form.errors.amount).toBe('金额必须大于 0')
    expect(store.db.transactions).toHaveLength(0)
  })
})

describe('提交', () => {
  it('同币种转账生成一出一进两条记录，余额正确', async () => {
    const target = addAccount('招行', 'CNY')
    store.updateAccount(cashId(), { initialBalance: 100000 }) // 1000 元
    const form = await setup()
    await pick(form, cashId(), target)
    form.state.amountText = '300'
    form.state.occurredAt = '2026-09-12'

    expect(form.submit()).toBe(true)

    const records = store.db.transactions
    expect(records).toHaveLength(2)
    expect(records.every(isTransfer)).toBe(true)
    expect(records[0]?.transferId).toBe(records[1]?.transferId)

    const out = records.find((t) => t.accountId === cashId())
    const into = records.find((t) => t.accountId === target)
    expect(out).toMatchObject({ type: 'expense', amount: 30000, categoryId: null, occurredAt: '2026-09-12' })
    expect(into).toMatchObject({ type: 'income', amount: 30000, categoryId: null })

    const cash = store.accountOf(cashId())
    const targetAccount = store.accountOf(target)
    if (!cash || !targetAccount) throw new Error('账户丢失')
    expect(accountBalance(cash, records)).toBe(70000)
    expect(accountBalance(targetAccount, records)).toBe(30000)
  })

  it('跨币种转账：转入侧按汇率换算', async () => {
    const usd = addAccount('美元卡', 'USD')
    store.setExchangeRate('USD', 7.14)
    store.updateAccount(cashId(), { initialBalance: 100000 })
    const form = await setup()
    await pick(form, cashId(), usd)
    form.state.amountText = '714'

    expect(form.submit()).toBe(true)

    const into = store.db.transactions.find((t) => t.accountId === usd)
    // 714 元 ÷ 7.14 = 100 美元
    expect(into).toMatchObject({ type: 'income', amount: 10000 })
  })

  it('同币种时忽略汇率框里的残留值', async () => {
    const target = addAccount('招行', 'CNY')
    store.updateAccount(cashId(), { initialBalance: 100000 })
    const form = await setup()
    await pick(form, cashId(), target)
    form.state.amountText = '100'
    form.state.rateText = '7.14' // 上个跨币种场景留下的

    expect(form.submit()).toBe(true)

    const into = store.db.transactions.find((t) => t.accountId === target)
    expect(into?.amount).toBe(10000)
  })

  it('转账不计入收支统计，但计入账户余额', async () => {
    const target = addAccount('招行', 'CNY')
    const form = await setup()
    await pick(form, cashId(), target)
    form.state.amountText = '300'
    form.state.occurredAt = '2026-09-12'
    expect(form.submit()).toBe(true)

    const cash = store.accountOf(cashId())
    const targetAccount = store.accountOf(target)
    if (!cash || !targetAccount) throw new Error('账户丢失')
    expect(accountBalance(cash, store.db.transactions)).toBe(-30000)
    expect(accountBalance(targetAccount, store.db.transactions)).toBe(30000)

    // 统计口径（排除转账）下，这个月没有任何收支
    expect(monthTotals(store.db.transactions, '2026-09', store.statsCtx)).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
    })
  })
})
