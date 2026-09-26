/**
 * 图表层的输入契约。
 *
 * 图表组件只认这里的结构，不认 store / 聚合函数；`features/stats/useStats.ts`
 * 负责把数据库装配成这些形状。这样图表可以脱离数据源单独测。
 * 金额一律是**主币种、整数分**。
 */

export interface TrendPoint {
  month: string
  /** '2026年9月'，悬浮读数与数据表用 */
  label: string
  /** '9月'，坐标轴刻度用 */
  short: string
  income: number
  expense: number
  balance: number
}

export interface ShareItem {
  key: string
  name: string
  icon: string
  amount: number
  /** 0~1 */
  percent: number
  /** CSS 变量名，直接绑到 style 上 */
  color: string
  /** 段够宽才标注百分比，见 lib/viz 的 inlinePercentFits */
  showPercent: boolean
}
