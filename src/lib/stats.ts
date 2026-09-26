/**
 * 统计聚合。全部为纯函数，是「月度汇总 / 分类占比 / 预算进度 / 账户余额」的唯一事实来源。
 *
 * 两条贯穿全文件的规则：
 * 1. **转账不计入收支统计**（`isTransfer` 为真则跳过）——账户间挪钱不是真实收支。
 * 2. **账户余额包含转账**——转账确实改变余额。见 `accountBalance`。
 */

import type {
  Account,
  Budget,
  Category,
  CurrencyCode,
  ExchangeRates,
  Transaction,
  TransactionType,
} from '@/types'
import { MAIN_CURRENCY, convertCents } from './money'
import { toMonth } from './date'

export interface StatsCtx {
  rates: ExchangeRates
  /** accountId → 该账户币种 */
  accountCurrency: Record<string, CurrencyCode>
}

export function makeStatsCtx(accounts: Account[], rates: ExchangeRates): StatsCtx {
  const accountCurrency: Record<string, CurrencyCode> = {}
  for (const a of accounts) accountCurrency[a.id] = a.currency
  return { rates, accountCurrency }
}

/** 是否为转账记录 */
export function isTransfer(tx: Transaction): boolean {
  return typeof tx.transferId === 'string' && tx.transferId !== ''
}

/**
 * 账目金额折算到主币种（分）。
 * 账户查找不到时按主币种处理——账户不可删除，正常不会出现孤儿账目。
 */
function toMainCents(tx: Transaction, ctx: StatsCtx): number {
  const currency = ctx.accountCurrency[tx.accountId] ?? MAIN_CURRENCY
  return convertCents(tx.amount, currency, MAIN_CURRENCY, ctx.rates)
}

export interface MonthTotals {
  income: number
  expense: number
  /** 结余 = 收入 - 支出，可为负 */
  balance: number
}

const EMPTY_TOTALS: MonthTotals = { income: 0, expense: 0, balance: 0 }

/** 某个月的收入 / 支出 / 结余（主币种，分），排除转账 */
export function monthTotals(txs: Transaction[], month: string, ctx: StatsCtx): MonthTotals {
  let income = 0
  let expense = 0
  for (const tx of txs) {
    if (isTransfer(tx)) continue
    if (toMonth(tx.occurredAt) !== month) continue
    const value = toMainCents(tx, ctx)
    if (tx.type === 'income') income += value
    else expense += value
  }
  return { income, expense, balance: income - expense }
}

/**
 * 批量汇总若干个月，用于趋势图。months 之外的账目会被忽略。
 * 返回的每个月份都保证存在（无数据时为 0），便于图表直接取值。
 */
export function summarizeByMonth(
  txs: Transaction[],
  months: readonly string[],
  ctx: StatsCtx,
): Record<string, MonthTotals> {
  const out: Record<string, MonthTotals> = {}
  for (const month of months) out[month] = { income: 0, expense: 0, balance: 0 }

  for (const tx of txs) {
    if (isTransfer(tx)) continue
    const bucket = out[toMonth(tx.occurredAt)]
    if (!bucket) continue
    const value = toMainCents(tx, ctx)
    if (tx.type === 'income') bucket.income += value
    else bucket.expense += value
  }

  for (const month of months) {
    const bucket = out[month]
    if (bucket) bucket.balance = bucket.income - bucket.expense
  }
  return out
}

/** 取某月收支，缺失月份返回全 0 */
export function totalsOf(summary: Record<string, MonthTotals>, month: string): MonthTotals {
  return summary[month] ?? EMPTY_TOTALS
}

export interface CategorySlice {
  /** null 表示折叠出来的「其他」 */
  categoryId: string | null
  /** 主币种，分 */
  amount: number
  /** 占该月该类总额的比例，0~1 */
  percent: number
  /**
   * 这一段由几个分类合并而来：未折叠的分类恒为 1，折叠段为被折叠的分类个数
   * （未分类账目没有分类，不计入）。界面用「其余 N 类」如实说明折叠了什么 ——
   * 种子数据里本来就有一个叫「其他」的分类，不能也叫「其他」。
   */
  count: number
}

/**
 * 分类占比：按金额降序取前 maxSlices 个，其余折叠为「其他」（categoryId 为 null）。
 * 传入 maxSlices = 8 时最多返回 9 项，图表侧按槽位数再决定折叠点。
 */
export function categoryBreakdown(
  txs: Transaction[],
  month: string,
  type: TransactionType,
  ctx: StatsCtx,
  maxSlices = 7,
): CategorySlice[] {
  const byCategory = new Map<string, number>()
  let uncategorized = 0
  let total = 0

  for (const tx of txs) {
    if (isTransfer(tx)) continue
    if (tx.type !== type) continue
    if (toMonth(tx.occurredAt) !== month) continue

    const value = toMainCents(tx, ctx)
    total += value
    if (tx.categoryId === null) {
      uncategorized += value
      continue
    }
    byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + value)
  }

  if (total === 0) return []

  const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  const slices: CategorySlice[] = sorted.slice(0, maxSlices).map(([categoryId, amount]) => ({
    categoryId,
    amount,
    percent: amount / total,
    count: 1,
  }))

  const tail = sorted.slice(maxSlices)
  const folded = tail.reduce((sum, [, amount]) => sum + amount, 0)
  const other = folded + uncategorized
  if (other > 0) {
    slices.push({ categoryId: null, amount: other, percent: other / total, count: tail.length })
  }

  return slices
}

/** 某分类在某月已花金额（主币种，分），排除转账 */
export function spentByCategory(
  txs: Transaction[],
  month: string,
  categoryId: string,
  ctx: StatsCtx,
): number {
  let spent = 0
  for (const tx of txs) {
    if (isTransfer(tx)) continue
    if (tx.type !== 'expense') continue
    if (tx.categoryId !== categoryId) continue
    if (toMonth(tx.occurredAt) !== month) continue
    spent += toMainCents(tx, ctx)
  }
  return spent
}

export interface BudgetProgress {
  /** 已花（主币种，分） */
  spent: number
  /** 限额（主币种，分） */
  limit: number
  /** spent / limit；limit 为 0 时返回 0 */
  ratio: number
}

export function budgetProgress(
  txs: Transaction[],
  budget: Budget,
  ctx: StatsCtx,
): BudgetProgress {
  const spent = spentByCategory(txs, budget.month, budget.categoryId, ctx)
  const limit = budget.limitAmount
  return { spent, limit, ratio: limit > 0 ? spent / limit : 0 }
}

export interface BudgetRow {
  budget: Budget
  category: Category
  progress: BudgetProgress
}

/** 某月全部预算行，按已花金额降序（超支的排最前，便于首页提醒） */
export function budgetRows(
  txs: Transaction[],
  budgets: readonly Budget[],
  month: string,
  categories: readonly Category[],
  ctx: StatsCtx,
): BudgetRow[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]))
  const rows: BudgetRow[] = []

  for (const budget of budgets) {
    if (budget.month !== month) continue
    const category = categoryById.get(budget.categoryId)
    if (!category) continue
    rows.push({ budget, category, progress: budgetProgress(txs, budget, ctx) })
  }

  return rows.sort((a, b) => b.progress.ratio - a.progress.ratio)
}

export type BudgetLevel = 'normal' | 'warning' | 'over'

/** 预算状态阈值：>= 100% 超支，>= 80% 接近上限 */
export function budgetLevel(ratio: number): BudgetLevel {
  if (ratio >= 1) return 'over'
  if (ratio >= 0.8) return 'warning'
  return 'normal'
}

/**
 * 账户余额（账户本币种，分）。**包含转账**，因为转账确实改变余额。
 * 账户只归档不删除，因此这里不需要处理账户已不存在的情况。
 */
export function accountBalance(account: Account, txs: readonly Transaction[]): number {
  let balance = account.initialBalance
  for (const tx of txs) {
    if (tx.accountId !== account.id) continue
    balance += tx.type === 'income' ? tx.amount : -tx.amount
  }
  return balance
}

/** 全部账户余额折算到主币种后求和（分） */
export function totalBalanceMain(
  accounts: readonly Account[],
  txs: readonly Transaction[],
  ctx: StatsCtx,
): number {
  let total = 0
  for (const account of accounts) {
    if (account.archived) continue
    total += convertCents(accountBalance(account, txs), account.currency, MAIN_CURRENCY, ctx.rates)
  }
  return total
}
