/**
 * 首次使用的种子数据：一个现金账户 + 一套常用分类。
 *
 * 分类颜色取自 dataviz 参考色板，仅用于列表徽标；
 * 图表不使用这些颜色（图表走固定槽位色板，见 lib/viz.ts）。
 */

import type { Account, Category, Database } from '@/types'
import { uid } from '@/lib/id'
import { DEFAULT_ACCOUNT_COLOR, DEFAULT_ACCOUNT_ICON } from '@/lib/presets'
import { CURRENT_SCHEMA_VERSION } from './migrate'

const now = (): string => new Date().toISOString()

interface CategorySeed {
  name: string
  icon: string
  color: string
}

const EXPENSE_CATEGORIES: readonly CategorySeed[] = [
  { name: '餐饮', icon: '🍜', color: '#eb6834' },
  { name: '交通', icon: '🚌', color: '#2a78d6' },
  { name: '购物', icon: '🛍️', color: '#e87ba4' },
  { name: '居住', icon: '🏠', color: '#008300' },
  { name: '娱乐', icon: '🎮', color: '#eda100' },
  { name: '医疗', icon: '💊', color: '#e34948' },
  { name: '教育', icon: '📚', color: '#4a3aa7' },
  { name: '其他', icon: '📦', color: '#898781' },
]

const INCOME_CATEGORIES: readonly CategorySeed[] = [
  { name: '工资', icon: '💰', color: '#1baf7a' },
  { name: '奖金', icon: '🎁', color: '#eda100' },
  { name: '理财', icon: '📈', color: '#2a78d6' },
  { name: '其他收入', icon: '💵', color: '#898781' },
]

export function seedDatabase(): Database {
  const createdAt = now()

  const cashAccount: Account = {
    id: uid(),
    name: '现金',
    currency: 'CNY',
    initialBalance: 0,
    icon: DEFAULT_ACCOUNT_ICON,
    color: DEFAULT_ACCOUNT_COLOR,
    archived: false,
    sortOrder: 0,
    createdAt,
  }

  const toCategory = (seed: CategorySeed, type: Category['type'], index: number): Category => ({
    id: uid(),
    name: seed.name,
    type,
    icon: seed.icon,
    color: seed.color,
    sortOrder: index,
    createdAt,
  })

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    accounts: [cashAccount],
    categories: [
      ...EXPENSE_CATEGORIES.map((s, i) => toCategory(s, 'expense', i)),
      ...INCOME_CATEGORIES.map((s, i) => toCategory(s, 'income', i)),
    ],
    transactions: [],
    budgets: [],
    settings: {
      mainCurrency: 'CNY',
      exchangeRates: {},
    },
  }
}
