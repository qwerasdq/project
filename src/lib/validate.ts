/**
 * 手写表单校验。全部为纯函数，返回中文错误信息或 null（通过）。
 * 规模不大（4 个表单），不引入 VeeValidate / Zod。
 */

import { daysInMonth } from './date'

/** 单笔金额上限：约 1 亿元，远超个人记账场景，用于拦住误输入 */
export const MAX_AMOUNT_CENTS = 9_999_999_999

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** 归一化全角数字、全角句点与各种减号，兼容中文输入法 */
function normalizeNumeric(text: string): string {
  return text
    .trim()
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[。．]/g, '.')
    .replace(/[－−]/g, '-')
}

const AMOUNT_RE = /^(\d+)(?:\.(\d{1,2}))?$/

/** 用字符串拼接换算成整数分，避免 `12.34 * 100` 的浮点误差 */
function centsOf(yuanText: string, fracText: string): number {
  return Number(yuanText) * 100 + Number(fracText.padEnd(2, '0'))
}

/**
 * 解析金额输入（单位：元）为整数分。
 * 最多两位小数，必须为正数。用字符串拼接做换算，避免浮点误差。
 */
export function parseAmountText(text: string): ParseResult<number> {
  const s = normalizeNumeric(text)
  if (s === '') return { ok: false, error: '请输入金额' }
  if (s.startsWith('-')) return { ok: false, error: '金额必须大于 0' }

  const m = AMOUNT_RE.exec(s)
  if (!m) return { ok: false, error: '金额格式不正确，最多两位小数' }

  const cents = centsOf(m[1] ?? '0', m[2] ?? '')
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) {
    return { ok: false, error: '金额过大' }
  }
  if (cents === 0) return { ok: false, error: '金额必须大于 0' }
  return { ok: true, value: cents }
}

/**
 * 解析可正可负的金额（单位：元）为整数分，**允许为 0**。
 * 用于账户初始余额：信用卡欠款、透支账户的初始余额本就该是负数。
 */
export function parseSignedAmountText(text: string): ParseResult<number> {
  let s = normalizeNumeric(text)
  if (s === '') return { ok: false, error: '请输入金额' }

  let negative = false
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  const m = AMOUNT_RE.exec(s)
  if (!m) return { ok: false, error: '金额格式不正确，最多两位小数' }

  const cents = centsOf(m[1] ?? '0', m[2] ?? '')
  if (!Number.isSafeInteger(cents) || cents > MAX_AMOUNT_CENTS) {
    return { ok: false, error: '金额过大' }
  }
  return { ok: true, value: negative ? -cents : cents }
}

/**
 * 解析汇率输入。汇率是小数，这里用浮点即可（不参与金额的整数分存储）。
 */
export function parseRateText(text: string): ParseResult<number> {
  const s = normalizeNumeric(text)
  if (s === '') return { ok: false, error: '请输入汇率' }
  const n = Number(s)
  if (!Number.isFinite(n)) return { ok: false, error: '汇率格式不正确' }
  if (n <= 0) return { ok: false, error: '汇率必须大于 0' }
  if (n > 1_000_000) return { ok: false, error: '汇率过大' }
  return { ok: true, value: n }
}

/** 必填校验 */
export function validateRequired(text: string, label: string): string | null {
  return text.trim() === '' ? `请输入${label}` : null
}

/** 名称校验：必填、长度上限、不含首尾空白造成的前后不一致 */
export function validateName(text: string, label: string, max = 12): string | null {
  const s = text.trim()
  if (s === '') return `请输入${label}`
  if (s.length > max) return `${label}不能超过 ${max} 个字`
  return null
}

/** 备注为非必填，仅限制长度 */
export function validateNote(text: string, max = 50): string | null {
  return text.trim().length > max ? `备注不能超过 ${max} 个字` : null
}

/** 日期校验：格式、真实性、合理范围 */
export function validateDate(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return '日期格式不正确'

  const year = Number(m[1])
  const mon = Number(m[2])
  const day = Number(m[3])

  if (mon < 1 || mon > 12) return '月份不存在'
  if (day < 1 || day > daysInMonth(`${m[1]}-${m[2]}`)) return '日期不存在'
  if (year < 1900 || year > 2100) return '日期超出可记账范围'
  return null
}

/** 转账：转出与转入账户不能相同 */
export function validateTransferAccounts(fromAccountId: string, toAccountId: string): string | null {
  if (!fromAccountId) return '请选择转出账户'
  if (!toAccountId) return '请选择转入账户'
  if (fromAccountId === toAccountId) return '转出与转入账户不能相同'
  return null
}
