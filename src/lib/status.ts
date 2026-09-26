/**
 * 状态色与「图标 + 文案」的绑定表。
 *
 * 状态色**永远不能单独出现**：浅色模式下 warning 对表面色只有 1.79:1 对比度，
 * 红绿色觉障碍用户也分辨不出 warning 与 critical。图标 + 文案不是装饰，是这套配色
 * 可读的必要组成部分，所以三者绑在一条记录里，用的人一起拿走，不给漏掉的机会。
 */

import type { BudgetLevel } from './stats'

export interface StatusStyle {
  /** 状态图标，空字符串表示无需强调 */
  icon: string
  /** 状态文案 */
  text: string
  /** 填充色（CSS 变量） */
  fill: string
  /** 文字色（Tailwind 类） */
  tone: string
}

export const BUDGET_LEVEL_STYLE: Record<BudgetLevel, StatusStyle> = {
  normal: { icon: '', text: '', fill: 'var(--meter-fill)', tone: 'text-ink-secondary' },
  warning: { icon: '⚠️', text: '接近上限', fill: 'var(--status-warning)', tone: 'text-ink' },
  over: { icon: '🔴', text: '已超支', fill: 'var(--status-critical)', tone: 'text-critical' },
}
