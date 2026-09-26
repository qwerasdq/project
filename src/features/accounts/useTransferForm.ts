/**
 * 转账表单逻辑。UI 在 TransferForm.vue。
 *
 * 转账**原子生成两条记录**（转出记账为支出、转入记账为收入，共享 transferId），
 * 由 store.addTransfer 完成。跨币种时靠 `rate`（1 单位转出币 = ? 单位转入币）换算。
 */

import { computed, reactive, watch } from 'vue'

import type { CurrencyCode } from '@/types'
import { useCurrency } from '@/composables/useCurrency'
import { todayISO } from '@/lib/date'
import { missingRates } from '@/lib/money'
import { accountBalance } from '@/lib/stats'
import { parseAmountText, parseRateText, validateDate, validateNote, validateTransferAccounts } from '@/lib/validate'
import { useDbStore } from '@/stores/db'

export interface TransferFormErrors {
  accounts: string | null
  amount: string | null
  rate: string | null
  date: string | null
  note: string | null
}

export function useTransferForm() {
  const store = useDbStore()
  const { rateBetween } = useCurrency()

  const state = reactive({
    fromAccountId: '',
    toAccountId: '',
    amountText: '',
    rateText: '1',
    occurredAt: todayISO(),
    note: '',
  })

  const errors = reactive<TransferFormErrors>({
    accounts: null,
    amount: null,
    rate: null,
    date: null,
    note: null,
  })

  /** 用户改过汇率就不再自动覆盖，否则账户一改手动填的值就没了 */
  let rateTouched = false

  const fromAccount = computed(() => store.accountOf(state.fromAccountId))
  const toAccount = computed(() => store.accountOf(state.toAccountId))

  const fromCurrency = computed<CurrencyCode | undefined>(() => fromAccount.value?.currency)
  const toCurrency = computed<CurrencyCode | undefined>(() => toAccount.value?.currency)

  const crossCurrency = computed(
    () => fromCurrency.value !== undefined && toCurrency.value !== undefined && fromCurrency.value !== toCurrency.value,
  )

  /** 跨币种但汇率没配：预填的 1:1 是错的，必须显式提示 */
  const rateUnset = computed(() => {
    if (!crossCurrency.value) return false
    const missing = missingRates(
      [fromCurrency.value as CurrencyCode, toCurrency.value as CurrencyCode],
      store.db.settings.exchangeRates,
    )
    return missing.length > 0
  })

  function syncRate(): void {
    if (rateTouched) return
    if (!fromCurrency.value || !toCurrency.value) {
      state.rateText = '1'
      return
    }
    state.rateText = String(rateBetween(fromCurrency.value, toCurrency.value))
  }

  watch([fromCurrency, toCurrency], syncRate, { immediate: true })

  // 转出账户默认取上次记账用的那个
  watch(
    () => store.activeAccounts,
    (accounts) => {
      if (state.fromAccountId || accounts.length === 0) return
      const preferred = store.db.settings.lastAccountId
      const first = accounts.find((a) => a.id === preferred) ?? accounts[0]
      if (first) state.fromAccountId = first.id
    },
    { immediate: true },
  )

  const accountOptions = computed(() =>
    store.activeAccounts.map((a) => ({ value: a.id, label: `${a.icon} ${a.name} · ${a.currency}` })),
  )

  /**
   * 转入账户里排除转出账户：与其让用户选完再报「不能相同」，不如根本选不到。
   * watch 负责在转出账户变化后把撞车的转入账户挪开，保证下拉的选中项始终有效。
   */
  const toAccountOptions = computed(() =>
    accountOptions.value.filter((o) => o.value !== state.fromAccountId),
  )

  watch(fromAccount, (account) => {
    if (!account) return
    if (state.toAccountId !== account.id) return
    state.toAccountId = toAccountOptions.value[0]?.value ?? ''
  })

  const amount = computed(() => {
    const parsed = parseAmountText(state.amountText)
    return parsed.ok ? parsed.value : null
  })

  const rate = computed(() => {
    const parsed = parseRateText(state.rateText)
    return parsed.ok ? parsed.value : null
  })

  /** 预计到账（转入账户币种，分） */
  const toAmount = computed(() => {
    if (amount.value === null) return null
    return Math.round(amount.value * (crossCurrency.value ? (rate.value ?? 1) : 1))
  })

  /** 转出账户余额（账户币种，分） */
  const fromBalance = computed(() =>
    fromAccount.value ? accountBalance(fromAccount.value, store.db.transactions) : 0,
  )

  /** 余额不足只提示不拦截：允许透支，也允许用户先转账后补记 */
  const insufficient = computed(
    () => amount.value !== null && amount.value > fromBalance.value,
  )

  function markRateTouched(): void {
    rateTouched = true
  }

  /** 交换转出/转入后重新按新币种对预填汇率 */
  function resetRate(): void {
    rateTouched = false
    syncRate()
  }

  function swapAccounts(): void {
    const from = state.fromAccountId
    state.fromAccountId = state.toAccountId
    state.toAccountId = from
    resetRate()
  }

  function clearErrors(): void {
    errors.accounts = null
    errors.amount = null
    errors.rate = null
    errors.date = null
    errors.note = null
  }

  function validate(): boolean {
    clearErrors()

    errors.accounts = validateTransferAccounts(state.fromAccountId, state.toAccountId)

    const amountResult = parseAmountText(state.amountText)
    if (!amountResult.ok) errors.amount = amountResult.error

    if (crossCurrency.value) {
      const rateResult = parseRateText(state.rateText)
      if (!rateResult.ok) errors.rate = rateResult.error
    }

    const dateError = validateDate(state.occurredAt)
    if (dateError) errors.date = dateError

    const noteError = validateNote(state.note)
    if (noteError) errors.note = noteError

    return Object.values(errors).every((e) => e === null)
  }

  function submit(): boolean {
    if (!validate()) return false

    const amountResult = parseAmountText(state.amountText)
    const rateResult = parseRateText(state.rateText)
    if (!amountResult.ok) return false

    store.addTransfer({
      fromAccountId: state.fromAccountId,
      toAccountId: state.toAccountId,
      amount: amountResult.value,
      // 同币种恒为 1，不采信输入框（跨币种切换回来时可能残留旧值）
      rate: crossCurrency.value && rateResult.ok ? rateResult.value : 1,
      occurredAt: state.occurredAt,
      note: state.note,
    })
    return true
  }

  return {
    state,
    errors,
    fromAccount,
    toAccount,
    fromCurrency,
    toCurrency,
    crossCurrency,
    rateUnset,
    accountOptions,
    toAccountOptions,
    amount,
    toAmount,
    fromBalance,
    insufficient,
    markRateTouched,
    resetRate,
    swapAccounts,
    submit,
  }
}
