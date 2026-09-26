/**
 * 币种格式化的便捷封装。组件里不要直接调 lib/money，
 * 走这里可以统一拿到 store 里的汇率与主币种。
 */

import { computed } from 'vue'

import type { CurrencyCode } from '@/types'
import { MAIN_CURRENCY, convertCents, crossRate, formatMoney, missingRates } from '@/lib/money'
import { useDbStore } from '@/stores/db'

export function useCurrency() {
  const store = useDbStore()

  const rates = computed(() => store.db.settings.exchangeRates)

  /** 折算到主币种并格式化 */
  function formatMain(cents: number, from: CurrencyCode = MAIN_CURRENCY): string {
    return formatMoney(convertCents(cents, from, MAIN_CURRENCY, rates.value), MAIN_CURRENCY)
  }

  /** 按原币种格式化，不做折算 */
  function formatIn(cents: number, code: CurrencyCode): string {
    return formatMoney(cents, code)
  }

  /** 折算为数字（分），用于求和后再格式化 */
  function toMain(cents: number, from: CurrencyCode): number {
    return convertCents(cents, from, MAIN_CURRENCY, rates.value)
  }

  /** 转账表单用的两币种间汇率 */
  function rateBetween(from: CurrencyCode, to: CurrencyCode): number {
    return crossRate(from, to, rates.value)
  }

  /** 用到的币种中缺少汇率的那些，用于界面提示 */
  const missingRateCurrencies = computed(() =>
    missingRates(
      store.accounts.filter((a) => !a.archived).map((a) => a.currency),
      rates.value,
    ),
  )

  return {
    MAIN_CURRENCY,
    rates,
    formatMain,
    formatIn,
    toMain,
    rateBetween,
    missingRateCurrencies,
  }
}
