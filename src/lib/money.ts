import type { CurrencyCode, ExchangeRates } from '@/types'

/**
 * 主币种。v1 固定为人民币，所有统计与预算均折算到该币种。
 */
export const MAIN_CURRENCY: CurrencyCode = 'CNY'

export interface CurrencyMeta {
  code: CurrencyCode
  name: string
}

export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: 'CNY', name: '人民币' },
  { code: 'USD', name: '美元' },
  { code: 'EUR', name: '欧元' },
  { code: 'JPY', name: '日元' },
  { code: 'HKD', name: '港币' },
  { code: 'GBP', name: '英镑' },
  { code: 'KRW', name: '韩元' },
  { code: 'AUD', name: '澳元' },
  { code: 'CAD', name: '加元' },
  { code: 'SGD', name: '新加坡元' },
]

/** 返回币种中文名，未知币种回退为代码本身 */
export function currencyName(code: CurrencyCode): string {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code
}

/**
 * 金额存储约定：**所有币种一律存「主单位的百分之一」**，即 100 = 1 元 / 1 美元 /
 * 1 日元。日元、韩元在主单位下没有小数，展示时由 Intl 自动取整（1500 日元存 150000，
 * 显示「JP¥1,500」）。统一百分位让换算逻辑无需维护各币种指数表。
 */
const formatterCache = new Map<CurrencyCode, Intl.NumberFormat>()

function formatterOf(code: CurrencyCode): Intl.NumberFormat {
  let f = formatterCache.get(code)
  if (!f) {
    f = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: code })
    formatterCache.set(code, f)
  }
  return f
}

/** 格式化为带币种符号的金额，如「¥1,234.56」「JP¥1,500」 */
export function formatMoney(cents: number, code: CurrencyCode): string {
  return formatterOf(code).format(cents / 100)
}

/**
 * 紧凑金额（元），用于图表坐标轴刻度：100000 分 → 「1,000」，1200000 分 → 「1.2万」。
 * 刻度文字要短才不挤压绘图区；精确值由悬浮读数和数据表给出。
 */
export function formatCompactYuan(cents: number): string {
  const yuan = cents / 100
  if (Math.abs(yuan) >= 10000) {
    const wan = yuan / 10000
    return `${Number.isInteger(wan) ? wan : wan.toFixed(1)}万`
  }
  return Math.round(yuan).toLocaleString('zh-CN')
}

/** 格式化为纯数字，用于输入框回填，如「1234.56」 */
export function formatAmount(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const frac = abs % 100
  return `${sign}${Math.floor(abs / 100)}.${String(frac).padStart(2, '0')}`
}

/**
 * 取「1 单位该币种 = X 主币种」的汇率。主币种恒为 1；未设置汇率的币种按 1:1 兜底，
 * 通过 missingRates 单独提示用户。
 */
export function rateToMain(code: CurrencyCode, rates: ExchangeRates): number {
  if (code === MAIN_CURRENCY) return 1
  const rate = rates[code]
  return typeof rate === 'number' && rate > 0 ? rate : 1
}

/** 折算金额，非主币种之间经主币种中转，就近取整到分 */
export function convertCents(
  cents: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: ExchangeRates,
): number {
  if (from === to) return cents
  return Math.round((cents * rateToMain(from, rates)) / rateToMain(to, rates))
}

/** 两种币种之间的直接汇率：1 单位 from = ? 单位 to。用于转账表单预填。 */
export function crossRate(from: CurrencyCode, to: CurrencyCode, rates: ExchangeRates): number {
  if (from === to) return 1
  return rateToMain(from, rates) / rateToMain(to, rates)
}

/** 找出缺少汇率的外币（不含主币种），用于在界面提示「未设置汇率，暂按 1:1 折算」 */
export function missingRates(codes: Iterable<CurrencyCode>, rates: ExchangeRates): CurrencyCode[] {
  const missing = new Set<CurrencyCode>()
  for (const code of codes) {
    if (code === MAIN_CURRENCY) continue
    const rate = rates[code]
    if (typeof rate !== 'number' || rate <= 0) missing.add(code)
  }
  return [...missing]
}
