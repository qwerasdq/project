/**
 * 汇率维护。两处容易出错的地方：
 * 1. **列出哪些币种** —— 少了会导致「缺汇率」的提示点进来却无处可填，
 *    多了会让人以为每个币种都得填。
 * 2. **输入框文字与 store 的同步时机** —— 失焦才提交，但币种集合变化时
 *    不能把用户正在改的、已经报错的原文冲掉。
 */

import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useExchangeRates } from '../useExchangeRates'
import { useDbStore } from '@/stores/db'

type Store = ReturnType<typeof useDbStore>

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

function addAccount(name: string, currency: 'USD' | 'EUR' | 'SGD' | 'JPY'): string {
  const account = store.addAccount({
    name,
    currency,
    initialBalance: 0,
    icon: '💳',
    color: '#2a78d6',
  })
  return account.id
}

function codesOf(rows: { code: string }[]): string[] {
  return rows.map((row) => row.code)
}

describe('列出哪些币种', () => {
  it('没有外币账户时不列任何行', () => {
    const { rows, emptyHint } = useExchangeRates()

    expect(rows).toHaveLength(0)
    expect(emptyHint.value).toContain('还没有外币账户')
  })

  it('外币账户的币种进入列表，标签写明换算方向', () => {
    addAccount('美元卡', 'USD')
    const { rows, emptyHint } = useExchangeRates()

    expect(rows).toHaveLength(1)
    expect(rows[0]?.code).toBe('USD')
    expect(rows[0]?.name).toBe('美元')
    expect(emptyHint.value).toBe('')
  })

  it('已归档账户的币种仍要维护 —— 历史账目还得折算', () => {
    const id = addAccount('美元卡', 'USD')
    store.setAccountArchived(id, true)

    expect(codesOf(useExchangeRates().rows)).toEqual(['USD'])
  })

  it('设过汇率却没有账户的币种也列出来，否则再也清不掉', () => {
    store.setExchangeRate('EUR', 7.8)

    expect(codesOf(useExchangeRates().rows)).toEqual(['EUR'])
  })

  it('主币种永远不出现', () => {
    store.setExchangeRate('CNY', 1)
    addAccount('美元卡', 'USD')

    expect(codesOf(useExchangeRates().rows)).toEqual(['USD'])
  })

  it('多个币种按固定次序排列，与账户创建顺序无关', () => {
    addAccount('新加坡卡', 'SGD')
    addAccount('欧元卡', 'EUR')
    addAccount('美元卡', 'USD')

    expect(codesOf(useExchangeRates().rows)).toEqual(['USD', 'EUR', 'SGD'])
  })

  it('已设过汇率的币种把现值填进输入框', () => {
    store.setExchangeRate('USD', 7.1)
    addAccount('美元卡', 'USD')

    expect(useExchangeRates().rows[0]?.text).toBe('7.1')
  })
})

describe('提交与撤销', () => {
  it('失焦提交合法汇率，文字同时归一化', () => {
    addAccount('美元卡', 'USD')
    const { rows, commit } = useExchangeRates()
    const row = rows[0]
    if (!row) throw new Error('缺少 USD 行')

    row.text = '7.10'
    commit(row)

    expect(store.db.settings.exchangeRates.USD).toBe(7.1)
    expect(row.text).toBe('7.1')
    expect(row.error).toBeNull()
  })

  it('清空输入等于取消设置，不当作错误', () => {
    store.setExchangeRate('USD', 7.1)
    addAccount('美元卡', 'USD')
    const { rows, commit } = useExchangeRates()
    const row = rows[0]
    if (!row) throw new Error('缺少 USD 行')

    row.text = ''
    commit(row)

    expect(store.db.settings.exchangeRates.USD).toBeUndefined()
    expect(row.error).toBeNull()
  })

  it('非法汇率标错、不写入，并留住用户输入的原文', () => {
    addAccount('美元卡', 'USD')
    const { rows, commit } = useExchangeRates()
    const row = rows[0]
    if (!row) throw new Error('缺少 USD 行')

    row.text = 'abc'
    commit(row)

    expect(row.error).toBe('汇率格式不正确')
    expect(row.text).toBe('abc')
    expect(store.db.settings.exchangeRates.USD).toBeUndefined()
  })

  it('负数与 0 都不接受', () => {
    addAccount('美元卡', 'USD')
    const { rows, commit } = useExchangeRates()
    const row = rows[0]
    if (!row) throw new Error('缺少 USD 行')

    row.text = '-7'
    commit(row)
    expect(row.error).toBe('汇率必须大于 0')

    row.text = '0'
    commit(row)
    expect(row.error).toBe('汇率必须大于 0')

    expect(store.db.settings.exchangeRates.USD).toBeUndefined()
  })

  it('中途新增币种时，正在报错的那一行原文不丢', async () => {
    addAccount('美元卡', 'USD')
    const { rows, commit } = useExchangeRates()
    const usd = rows[0]
    if (!usd) throw new Error('缺少 USD 行')

    usd.text = '7..1'
    commit(usd)
    expect(usd.error).toBeTruthy()

    // 行是在 watch 里重建的，要等一个 tick 才看得到
    addAccount('欧元卡', 'EUR')
    await nextTick()
    expect(codesOf(rows)).toEqual(['USD', 'EUR'])

    const usdAgain = rows.find((row) => row.code === 'USD')
    expect(usdAgain?.text).toBe('7..1')
    expect(usdAgain?.error).toBe('汇率格式不正确')
  })

  it('提交成功后重新检查这一行不再报错', () => {
    addAccount('美元卡', 'USD')
    const { rows, commit } = useExchangeRates()
    const row = rows[0]
    if (!row) throw new Error('缺少 USD 行')

    row.text = 'x'
    commit(row)
    expect(row.error).toBeTruthy()

    row.text = '7.1'
    commit(row)
    expect(row.error).toBeNull()
  })
})
