/**
 * 日期工具。
 *
 * 约定：记账日期为本地时区的 'YYYY-MM-DD'；月份为 'YYYY-MM'。
 * 全程避免用 `new Date('2026-09-27')` 这种按 UTC 解析的写法——在负时区会串到前一天，
 * 因此一律用字符串切片或 `new Date(y, m - 1, d)` 的本地构造。
 */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 今天（本地时区），'YYYY-MM-DD' */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 'YYYY-MM-DD' → 'YYYY-MM' */
export function toMonth(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** 当前月份，'YYYY-MM' */
export function currentMonth(): string {
  return todayISO().slice(0, 7)
}

/** 把 'YYYY-MM' 偏移 n 个月，n 可为负 */
export function shiftMonth(month: string, n: number): string {
  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  const total = year * 12 + (mon - 1) + n
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}`
}

/**
 * 截至 endMonth（含）的最近 n 个月，按时间升序返回。
 * 例：lastNMonths(3, '2026-09') → ['2026-07', '2026-08', '2026-09']
 */
export function lastNMonths(n: number, endMonth: string = currentMonth()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(endMonth, -i))
  return out
}

/** '2026-09' → '2026年9月' */
export function monthLabel(month: string): string {
  const year = month.slice(0, 4)
  const mon = Number(month.slice(5, 7))
  return `${year}年${mon}月`
}

/** '2026-09' → '9月'，用于图表轴标签 */
export function monthShortLabel(month: string): string {
  return `${Number(month.slice(5, 7))}月`
}

/** 该月有多少天 */
export function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  return new Date(year, mon, 0).getDate()
}

/** 'YYYY-MM-DD' → '9月27日 周六' */
export function dateLabel(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4))
  const mon = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  const weekday = WEEKDAYS[new Date(year, mon - 1, day).getDay()] ?? ''
  return `${mon}月${day}日 ${weekday}`
}

/** 'YYYY-MM-DD' → '今天' / '昨天' / '9月27日 周六' */
export function relativeDateLabel(isoDate: string): string {
  if (isoDate === todayISO()) return '今天'
  if (isoDate === shiftDay(todayISO(), -1)) return '昨天'
  return dateLabel(isoDate)
}

/** ISO 日期偏移若干天 */
export function shiftDay(isoDate: string, n: number): string {
  const year = Number(isoDate.slice(0, 4))
  const mon = Number(isoDate.slice(5, 7))
  const day = Number(isoDate.slice(8, 10))
  const d = new Date(year, mon - 1, day + n)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
