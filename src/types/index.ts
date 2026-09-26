/**
 * 全局数据类型定义。
 *
 * 约定：
 * - 金额一律为整数，单位「分」。
 * - 日期一律为 ISO 8601 字符串；记账日期精确到天（'YYYY-MM-DD'）。
 * - 账目不存币种，币种由所属账户推导。
 */

export type TransactionType = 'income' | 'expense'

export type CurrencyCode =
  | 'CNY'
  | 'USD'
  | 'EUR'
  | 'JPY'
  | 'HKD'
  | 'GBP'
  | 'KRW'
  | 'AUD'
  | 'CAD'
  | 'SGD'

export interface Account {
  id: string
  name: string
  /** 账户绑定币种，该账户下所有账目均以此币种计价 */
  currency: CurrencyCode
  /** 初始余额（分），记账起点的账户余额 */
  initialBalance: number
  /** emoji 字符 */
  icon: string
  /** hex 色值，仅用于界面标识，图表不采用 */
  color: string
  /** 有账目的账户只归档不删除 */
  archived: boolean
  sortOrder: number
  createdAt: string
}

export interface Category {
  id: string
  name: string
  type: TransactionType
  /** emoji 字符 */
  icon: string
  /** hex 色值，仅用于列表徽标，图表不采用 */
  color: string
  sortOrder: number
  createdAt: string
}

export interface Transaction {
  id: string
  type: TransactionType
  /** 所属账户，币种由该账户推导 */
  accountId: string
  /** 转账记录为 null */
  categoryId: string | null
  /** 恒为正整数（分），收支方向由 type 决定 */
  amount: number
  note?: string
  /** 'YYYY-MM-DD' */
  occurredAt: string
  createdAt: string
  /** 转账成对记录共享的 id，存在即为转账 */
  transferId?: string
  /** 转账对方账户，仅用于展示 */
  transferPeerAccountId?: string
}

export interface Budget {
  id: string
  categoryId: string
  /** 'YYYY-MM' */
  month: string
  /** 限额（分，主币种 CNY） */
  limitAmount: number
  createdAt: string
}

export interface Settings {
  /** 主币种，v1 固定 'CNY' */
  mainCurrency: CurrencyCode
  /** 汇率：1 单位外币 = X 主币种，手工维护 */
  exchangeRates: Partial<Record<CurrencyCode, number>>
  /** 记一笔时默认选中的账户 */
  lastAccountId?: string
}

export interface Database {
  schemaVersion: number
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  settings: Settings
}

/** 汇率表，多处复用 */
export type ExchangeRates = Partial<Record<CurrencyCode, number>>

// ---------------- 表单输入 ----------------

export interface AccountInput {
  name: string
  currency: CurrencyCode
  /** 初始余额（分） */
  initialBalance: number
  icon: string
  color: string
}

export interface CategoryInput {
  name: string
  type: TransactionType
  icon: string
  color: string
}

/** 记一笔 / 编辑账目的输入。amount 为正整数分，方向由 type 决定。 */
export interface TransactionInput {
  type: TransactionType
  accountId: string
  /** 非转账必填 */
  categoryId: string
  amount: number
  note?: string
  occurredAt: string
}

/** 转账输入。rate 语义：1 单位转出币种 = rate 单位转入币种。 */
export interface TransferInput {
  fromAccountId: string
  toAccountId: string
  /** 转出金额（转出账户币种，分） */
  amount: number
  rate: number
  occurredAt: string
  note?: string
}

/** 记账后触发预算提醒时返回 */
export interface BudgetWarning {
  categoryName: string
  ratio: number
  level: 'warning' | 'over'
}
