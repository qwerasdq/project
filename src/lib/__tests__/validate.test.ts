import { describe, expect, it } from 'vitest'

import {
  MAX_AMOUNT_CENTS,
  parseAmountText,
  parseRateText,
  parseSignedAmountText,
  validateDate,
  validateName,
  validateNote,
  validateRequired,
  validateTransferAccounts,
} from '../validate'

describe('parseAmountText', () => {
  it('解析整数金额', () => {
    expect(parseAmountText('100')).toEqual({ ok: true, value: 10000 })
  })

  it('解析一位小数', () => {
    expect(parseAmountText('12.5')).toEqual({ ok: true, value: 1250 })
  })

  it('解析两位小数', () => {
    expect(parseAmountText('12.34')).toEqual({ ok: true, value: 1234 })
  })

  it('去除首尾空白', () => {
    expect(parseAmountText('  12.34  ')).toEqual({ ok: true, value: 1234 })
  })

  it('用字符串拼接避免浮点误差', () => {
    // 19.99 用 parseFloat * 100 会得到 1998.9999...
    expect(parseAmountText('19.99')).toEqual({ ok: true, value: 1999 })
    expect(parseAmountText('0.07')).toEqual({ ok: true, value: 7 })
    expect(parseAmountText('1.1')).toEqual({ ok: true, value: 110 })
  })

  it('兼容全角数字与全角句点', () => {
    expect(parseAmountText('１２．３４')).toEqual({ ok: true, value: 1234 })
  })

  it('空输入报错', () => {
    expect(parseAmountText('')).toEqual({ ok: false, error: '请输入金额' })
    expect(parseAmountText('   ')).toEqual({ ok: false, error: '请输入金额' })
  })

  it('零金额报错', () => {
    expect(parseAmountText('0')).toEqual({ ok: false, error: '金额必须大于 0' })
    expect(parseAmountText('0.00')).toEqual({ ok: false, error: '金额必须大于 0' })
  })

  it('负数报错', () => {
    expect(parseAmountText('-5')).toEqual({ ok: false, error: '金额必须大于 0' })
  })

  it('超过两位小数报错', () => {
    expect(parseAmountText('1.234')).toEqual({
      ok: false,
      error: '金额格式不正确，最多两位小数',
    })
  })

  it('非数字报错', () => {
    expect(parseAmountText('abc').ok).toBe(false)
    expect(parseAmountText('1.2.3').ok).toBe(false)
    expect(parseAmountText('1e3').ok).toBe(false)
    expect(parseAmountText('.5').ok).toBe(false)
  })

  it('金额超过上限报错', () => {
    expect(parseAmountText('99999999.99')).toEqual({ ok: true, value: 9999999999 })
    expect(parseAmountText('100000000')).toEqual({ ok: false, error: '金额过大' })
  })

  it('上限常量与边界一致', () => {
    expect(MAX_AMOUNT_CENTS).toBe(9999999999)
  })
})

describe('parseSignedAmountText', () => {
  it('允许正数与零', () => {
    expect(parseSignedAmountText('1234.56')).toEqual({ ok: true, value: 123456 })
    expect(parseSignedAmountText('0')).toEqual({ ok: true, value: 0 })
    expect(parseSignedAmountText('0.00')).toEqual({ ok: true, value: 0 })
  })

  it('允许负数（信用卡欠款、透支账户）', () => {
    expect(parseSignedAmountText('-1234.56')).toEqual({ ok: true, value: -123456 })
    expect(parseSignedAmountText('-0.01')).toEqual({ ok: true, value: -1 })
  })

  it('容忍显式正号与全角减号', () => {
    expect(parseSignedAmountText('+50')).toEqual({ ok: true, value: 5000 })
    expect(parseSignedAmountText('－５０')).toEqual({ ok: true, value: -5000 })
    expect(parseSignedAmountText('−50')).toEqual({ ok: true, value: -5000 })
  })

  it('与 parseAmountText 一样拒绝零以外之外的非法输入', () => {
    expect(parseSignedAmountText('')).toEqual({ ok: false, error: '请输入金额' })
    expect(parseSignedAmountText('abc')).toEqual({
      ok: false,
      error: '金额格式不正确，最多两位小数',
    })
    expect(parseSignedAmountText('1.234')).toEqual({
      ok: false,
      error: '金额格式不正确，最多两位小数',
    })
    expect(parseSignedAmountText('-')).toEqual({
      ok: false,
      error: '金额格式不正确，最多两位小数',
    })
  })

  it('负数同样受上限约束', () => {
    expect(parseSignedAmountText('-100000000')).toEqual({ ok: false, error: '金额过大' })
    expect(parseSignedAmountText('-99999999.99')).toEqual({ ok: true, value: -9999999999 })
  })
})

describe('parseRateText', () => {
  it('解析常规汇率', () => {
    expect(parseRateText('7.2')).toEqual({ ok: true, value: 7.2 })
    expect(parseRateText('1')).toEqual({ ok: true, value: 1 })
  })

  it('空输入报错', () => {
    expect(parseRateText('')).toEqual({ ok: false, error: '请输入汇率' })
  })

  it('零与负数报错', () => {
    expect(parseRateText('0').ok).toBe(false)
    expect(parseRateText('-1').ok).toBe(false)
  })

  it('非数字报错', () => {
    expect(parseRateText('abc').ok).toBe(false)
  })

  it('过大报错', () => {
    expect(parseRateText('2000000').ok).toBe(false)
  })

  it('兼容全角输入', () => {
    expect(parseRateText('７．２')).toEqual({ ok: true, value: 7.2 })
  })
})

describe('validateRequired', () => {
  it('非空通过', () => {
    expect(validateRequired('现金', '账户名')).toBeNull()
  })

  it('空与纯空白不通过', () => {
    expect(validateRequired('', '账户名')).toBe('请输入账户名')
    expect(validateRequired('   ', '账户名')).toBe('请输入账户名')
  })
})

describe('validateName', () => {
  it('常规名称通过', () => {
    expect(validateName('餐饮', '分类名')).toBeNull()
  })

  it('空报错', () => {
    expect(validateName('  ', '分类名')).toBe('请输入分类名')
  })

  it('超长报错', () => {
    expect(validateName('一'.repeat(13), '分类名')).toBe('分类名不能超过 12 个字')
  })

  it('边界长度通过', () => {
    expect(validateName('一'.repeat(12), '分类名')).toBeNull()
  })

  it('按字符数而非字节数计算', () => {
    expect(validateName('abcdefghijkl', '账户名')).toBeNull()
  })
})

describe('validateNote', () => {
  it('空通过（备注非必填）', () => {
    expect(validateNote('')).toBeNull()
  })

  it('超长报错', () => {
    expect(validateNote('一'.repeat(51))).toBe('备注不能超过 50 个字')
  })

  it('边界长度通过', () => {
    expect(validateNote('一'.repeat(50))).toBeNull()
  })
})

describe('validateDate', () => {
  it('合法日期通过', () => {
    expect(validateDate('2026-09-27')).toBeNull()
    expect(validateDate('2026-01-01')).toBeNull()
    expect(validateDate('2026-12-31')).toBeNull()
  })

  it('闰年 2 月 29 日通过', () => {
    expect(validateDate('2028-02-29')).toBeNull()
  })

  it('平年 2 月 29 日不通过', () => {
    expect(validateDate('2026-02-29')).toBe('日期不存在')
  })

  it('不存在的月份不通过', () => {
    expect(validateDate('2026-13-01')).toBe('月份不存在')
    expect(validateDate('2026-00-01')).toBe('月份不存在')
  })

  it('不存在的日期不通过', () => {
    expect(validateDate('2026-04-31')).toBe('日期不存在')
    expect(validateDate('2026-09-00')).toBe('日期不存在')
    expect(validateDate('2026-09-31')).toBe('日期不存在')
  })

  it('格式错误不通过', () => {
    expect(validateDate('2026/09/27')).toBe('日期格式不正确')
    expect(validateDate('26-09-27')).toBe('日期格式不正确')
    expect(validateDate('')).toBe('日期格式不正确')
  })

  it('超出可记账范围不通过', () => {
    expect(validateDate('1899-12-31')).toBe('日期超出可记账范围')
    expect(validateDate('2101-01-01')).toBe('日期超出可记账范围')
  })
})

describe('validateTransferAccounts', () => {
  it('两个账户都填且不同则通过', () => {
    expect(validateTransferAccounts('a', 'b')).toBeNull()
  })

  it('未选转出账户', () => {
    expect(validateTransferAccounts('', 'b')).toBe('请选择转出账户')
  })

  it('未选转入账户', () => {
    expect(validateTransferAccounts('a', '')).toBe('请选择转入账户')
  })

  it('同一账户报错', () => {
    expect(validateTransferAccounts('a', 'a')).toBe('转出与转入账户不能相同')
  })
})
