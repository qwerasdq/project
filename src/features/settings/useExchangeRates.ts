/**
 * 汇率维护。UI 在 ExchangeRateList.vue。
 *
 * 汇率的语义只有一种：**1 单位外币 = X 人民币**。方向写反是这里最容易犯的错，
 * 所以界面上每个输入框都把方向写进标签（「1 美元 = ? 人民币」），不靠用户记。
 *
 * 哪些币种需要维护？**用到的**（任何账户的币种，含已归档 —— 归档账户的历史账目
 * 仍要折算）**加上已经设过汇率的**（否则设完再归档就再也看不到、清不掉）。
 * 十个币种全列出来只会让人以为每个都得填。
 *
 * 输入框里的文字是**本地状态**，失焦才提交：边打字边解析会把「7.」这种中间状态
 * 判成非法，用户还没输完就被标红。
 */

import { computed, reactive, watch } from 'vue'

import type { CurrencyCode } from '@/types'
import { useDbStore } from '@/stores/db'
import { CURRENCIES, MAIN_CURRENCY, currencyName } from '@/lib/money'
import { parseRateText } from '@/lib/validate'

export interface RateRow {
  code: CurrencyCode
  name: string
  /** 输入框里的原文，未提交前只存在这里 */
  text: string
  /** 提交失败的原因，非空时输入框描边转 critical */
  error: string | null
}

export function useExchangeRates() {
  const store = useDbStore()

  /** 需要用到的币种，按 lib/money 里的固定次序排列 */
  const codes = computed<CurrencyCode[]>(() => {
    const needed = new Set<CurrencyCode>()
    for (const account of store.accounts) {
      if (account.currency !== MAIN_CURRENCY) needed.add(account.currency)
    }
    for (const code of Object.keys(store.db.settings.exchangeRates)) {
      needed.add(code as CurrencyCode)
    }
    needed.delete(MAIN_CURRENCY)
    return CURRENCIES.filter((c) => needed.has(c.code)).map((c) => c.code)
  })

  const rows = reactive<RateRow[]>([])

  /**
   * 重建行。币种集合变化时才发生，所以正在编辑的文字不会被打断；
   * 但如果那一行还留着报错，就把用户的原文一并带回来。
   */
  function sync(): void {
    const previous = new Map(rows.map((row) => [row.code, row]))
    const next = codes.value.map((code): RateRow => {
      const rate = store.db.settings.exchangeRates[code]
      const before = previous.get(code)
      const set = typeof rate === 'number' && rate > 0
      return {
        code,
        name: currencyName(code),
        text: before?.error ? before.text : set ? String(rate) : '',
        error: before?.error ?? null,
      }
    })
    rows.splice(0, rows.length, ...next)
  }

  watch(codes, sync, { immediate: true })

  /**
   * 失焦提交。**清空输入框等于取消设置**（回到 1:1 兜底），不当作错误 ——
   * 否则用户没有办法把一个设过的汇率撤销掉。
   */
  function commit(row: RateRow): void {
    const text = row.text.trim()

    if (text === '') {
      store.setExchangeRate(row.code, null)
      row.text = ''
      row.error = null
      return
    }

    const parsed = parseRateText(text)
    if (!parsed.ok) {
      row.error = parsed.error
      return
    }

    store.setExchangeRate(row.code, parsed.value)
    row.text = String(parsed.value) // 归一化：「7.10」→「7.1」
    row.error = null
  }

  /** 完全没有外币账户时的提示语 */
  const emptyHint = computed(() =>
    rows.length === 0 ? '还没有外币账户。新建外币账户后，这里会列出需要维护的汇率。' : '',
  )

  return { rows, commit, emptyHint }
}
