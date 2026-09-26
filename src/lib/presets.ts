/**
 * 图标与徽标配色预设。
 *
 * 这里的颜色**只用于列表徽标**（账户/分类的圆形底色），图表一律走 lib/viz.ts 的
 * 固定槽位色板 —— 两套色板职责不同，不要混用。
 *
 * 色值取自 dataviz 参考调色板（已经过 CVD 校验），且徽标旁始终有 emoji + 名称，
 * 颜色从来不是身份的唯一载体。
 */

export const ACCOUNT_ICONS: readonly string[] = [
  '💵',
  '💳',
  '🏦',
  '📱',
  '🐷',
  '📈',
  '🏧',
  '🪙',
]

export const EXPENSE_CATEGORY_ICONS: readonly string[] = [
  '🍜',
  '🚌',
  '🛍️',
  '🏠',
  '🎮',
  '💊',
  '📚',
  '📦',
  '☕',
  '✈️',
  '🐾',
  '🎬',
]

export const INCOME_CATEGORY_ICONS: readonly string[] = [
  '💰',
  '🎁',
  '📈',
  '💵',
  '🧧',
  '🏆',
  '🤝',
  '🪙',
]

export const BADGE_COLORS: readonly string[] = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
  '#898781',
]

export const DEFAULT_ACCOUNT_ICON = '💵'
export const DEFAULT_ACCOUNT_COLOR = '#2a78d6'
export const DEFAULT_CATEGORY_ICON = '🏷️'
export const DEFAULT_CATEGORY_COLOR = '#2a78d6'

/**
 * 图标徽标的底色：把实体色兑成 12% 的浅底。
 *
 * 色值来自用户数据而不是常量（localStorage 可能被改坏，迁移也只保证结构），
 * 所以先验格式再拼透明通道；非法时退回分隔线色，绝不渲成一块看不见的透明。
 */
export function badgeStyle(color: string | undefined): { backgroundColor: string } {
  const valid = typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)
  return { backgroundColor: valid ? `${color}1f` : 'var(--hairline)' }
}
