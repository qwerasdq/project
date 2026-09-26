/**
 * 账户表单逻辑。UI 在 AccountForm.vue。
 *
 * 账户**只归档不删除**：删掉账户会让历史账目失去币种依据，余额也再也算不出来。
 */

import { computed, reactive, watch } from 'vue'

import type { Account, AccountInput, CurrencyCode } from '@/types'
import { useDbStore } from '@/stores/db'
import { MAIN_CURRENCY, formatAmount } from '@/lib/money'
import { DEFAULT_ACCOUNT_COLOR, DEFAULT_ACCOUNT_ICON } from '@/lib/presets'
import { accountBalance } from '@/lib/stats'
import { parseSignedAmountText, validateName } from '@/lib/validate'

export interface AccountFormErrors {
  name: string | null
  initialBalance: string | null
}

export function useAccountForm(accountId: () => string | undefined) {
  const store = useDbStore()

  const existing = computed<Account | undefined>(() => {
    const id = accountId()
    return id ? store.accounts.find((a) => a.id === id) : undefined
  })

  const mode = computed<'create' | 'edit'>(() => (existing.value ? 'edit' : 'create'))

  const state = reactive({
    name: '',
    currency: MAIN_CURRENCY as CurrencyCode,
    initialBalanceText: '0.00',
    icon: DEFAULT_ACCOUNT_ICON,
    color: DEFAULT_ACCOUNT_COLOR,
  })

  const errors = reactive<AccountFormErrors>({ name: null, initialBalance: null })

  /** 该账户下的账目条数 */
  const transactionCount = computed(() => {
    const account = existing.value
    if (!account) return 0
    return store.db.transactions.filter((t) => t.accountId === account.id).length
  })

  /**
   * 已有账目的账户不允许改币种：改了等于把历史金额整体重新解释成另一种货币，
   * 余额和统计会凭空变化，且无法撤销。
   */
  const currencyLocked = computed(() => mode.value === 'edit' && transactionCount.value > 0)

  /** 当前余额（账户本币种，分）。新建时没有意义，返回 0。 */
  const balance = computed(() => {
    const account = existing.value
    return account ? accountBalance(account, store.db.transactions) : 0
  })

  const archived = computed(() => existing.value?.archived ?? false)

  function clearErrors(): void {
    errors.name = null
    errors.initialBalance = null
  }

  watch(
    existing,
    (account) => {
      if (account) {
        state.name = account.name
        state.currency = account.currency
        state.initialBalanceText = formatAmount(account.initialBalance)
        state.icon = account.icon
        state.color = account.color
      } else {
        state.name = ''
        state.currency = MAIN_CURRENCY
        state.initialBalanceText = '0.00'
        state.icon = DEFAULT_ACCOUNT_ICON
        state.color = DEFAULT_ACCOUNT_COLOR
      }
      clearErrors()
    },
    { immediate: true },
  )

  function validate(): { name: string; initialBalance: number } | null {
    clearErrors()

    const nameError = validateName(state.name, '账户名', 12)
    if (nameError) errors.name = nameError

    const balanceResult = parseSignedAmountText(state.initialBalanceText)
    if (!balanceResult.ok) errors.initialBalance = balanceResult.error

    if (nameError || !balanceResult.ok) return null
    return { name: state.name, initialBalance: balanceResult.value }
  }

  function submit(): boolean {
    const valid = validate()
    if (!valid) return false

    const input: AccountInput = {
      name: valid.name,
      currency: state.currency,
      initialBalance: valid.initialBalance,
      icon: state.icon,
      color: state.color,
    }

    const account = existing.value
    if (account) {
      // 币种锁定时不提交 currency，避免绕过界面上的禁用态
      const patch = currencyLocked.value
        ? { name: input.name, initialBalance: input.initialBalance, icon: input.icon, color: input.color }
        : input
      store.updateAccount(account.id, patch)
      return true
    }

    store.addAccount(input)
    return true
  }

  function setArchived(value: boolean): void {
    const account = existing.value
    if (account) store.setAccountArchived(account.id, value)
  }

  return {
    state,
    errors,
    mode,
    existing,
    balance,
    archived,
    transactionCount,
    currencyLocked,
    submit,
    setArchived,
  }
}
