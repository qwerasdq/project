import { describe, expect, it } from 'vitest'

import {
  MAIN_CURRENCY,
  convertCents,
  crossRate,
  currencyName,
  formatAmount,
  formatCompactYuan,
  formatMoney,
  missingRates,
  rateToMain,
} from '../money'

describe('MAIN_CURRENCY', () => {
  it('主币种为人民币', () => {
    expect(MAIN_CURRENCY).toBe('CNY')
  })
})

describe('formatMoney', () => {
  it('格式化人民币', () => {
    expect(formatMoney(123456, 'CNY')).toBe('¥1,234.56')
  })

  it('格式化美元，带 US$ 前缀', () => {
    expect(formatMoney(123456, 'USD')).toBe('US$1,234.56')
  })

  it('负数显示为 -¥ 前缀', () => {
    expect(formatMoney(-5000, 'CNY')).toBe('-¥50.00')
  })

  it('零值正常显示', () => {
    expect(formatMoney(0, 'CNY')).toBe('¥0.00')
  })

  it('日元没有小数位，由 Intl 取整', () => {
    // 150000「百分位」= 1500 日元
    expect(formatMoney(150000, 'JPY')).toBe('JP¥1,500')
  })

  it('韩元同样没有小数位', () => {
    expect(formatMoney(150000, 'KRW')).toBe('₩1,500')
  })
})

describe('formatAmount', () => {
  it('输出不带符号与千分位的纯数字，供输入框回填', () => {
    expect(formatAmount(123456)).toBe('1234.56')
  })

  it('补足两位小数', () => {
    expect(formatAmount(120000)).toBe('1200.00')
    expect(formatAmount(120005)).toBe('1200.05')
    expect(formatAmount(5)).toBe('0.05')
    expect(formatAmount(0)).toBe('0.00')
  })

  it('负值带负号', () => {
    expect(formatAmount(-123456)).toBe('-1234.56')
  })
})

describe('rateToMain', () => {
  it('主币种恒为 1', () => {
    expect(rateToMain('CNY', {})).toBe(1)
  })

  it('读取已设置的汇率', () => {
    expect(rateToMain('USD', { USD: 7.2 })).toBe(7.2)
  })

  it('未设置汇率按 1:1 兜底', () => {
    expect(rateToMain('USD', {})).toBe(1)
  })

  it('非法汇率（0 或负数）也按 1:1 兜底', () => {
    expect(rateToMain('USD', { USD: 0 })).toBe(1)
    expect(rateToMain('USD', { USD: -3 })).toBe(1)
  })
})

describe('convertCents', () => {
  it('同币种原样返回', () => {
    expect(convertCents(12345, 'USD', 'USD', {})).toBe(12345)
  })

  it('人民币转人民币原样返回', () => {
    expect(convertCents(12345, 'CNY', 'CNY', {})).toBe(12345)
  })

  it('外币折算为主币种', () => {
    // 100 美元 = 10000 分（百分位），汇率 7.2 → 72000 分人民币
    expect(convertCents(10000, 'USD', 'CNY', { USD: 7.2 })).toBe(72000)
  })

  it('主币种折算为外币', () => {
    expect(convertCents(72000, 'CNY', 'USD', { USD: 7.2 })).toBe(10000)
  })

  it('两个外币之间经主币种中转', () => {
    // 100 欧元 → 720 人民币 → 100 美元
    expect(convertCents(10000, 'EUR', 'USD', { EUR: 7.2, USD: 7.2 })).toBe(10000)
    // 200 欧元 → 1440 人民币 → 200 美元
    expect(convertCents(20000, 'EUR', 'USD', { EUR: 7.2, USD: 7.2 })).toBe(20000)
  })

  it('折算结果就近取整到分', () => {
    // 100 分美元 × 7.15 = 715 分
    expect(convertCents(100, 'USD', 'CNY', { USD: 7.15 })).toBe(715)
    // 1 分美元 × 0.5 汇率会有小数，验证四舍五入
    expect(convertCents(1, 'USD', 'CNY', { USD: 0.5 })).toBe(1)
    expect(convertCents(1, 'USD', 'CNY', { USD: 0.4 })).toBe(0)
  })

  it('缺失汇率时按 1:1 折算而非崩溃', () => {
    expect(convertCents(10000, 'USD', 'CNY', {})).toBe(10000)
  })
})

describe('crossRate', () => {
  it('同币种为 1', () => {
    expect(crossRate('USD', 'USD', {})).toBe(1)
  })

  it('主币种对外币取倒数', () => {
    expect(crossRate('CNY', 'USD', { USD: 7.2 })).toBeCloseTo(1 / 7.2, 10)
  })

  it('外币对主币种取汇率', () => {
    expect(crossRate('USD', 'CNY', { USD: 7.2 })).toBe(7.2)
  })

  it('外币之间为汇率之比', () => {
    expect(crossRate('EUR', 'USD', { EUR: 7.8, USD: 7.2 })).toBeCloseTo(7.8 / 7.2, 10)
  })
})

describe('missingRates', () => {
  it('找出未设置汇率的外币', () => {
    expect(missingRates(['USD', 'EUR'], { USD: 7.2 }).sort()).toEqual(['EUR'])
  })

  it('忽略主币种', () => {
    expect(missingRates(['CNY'], {})).toEqual([])
  })

  it('全部已设置时返回空数组', () => {
    expect(missingRates(['USD', 'EUR'], { USD: 7.2, EUR: 7.8 })).toEqual([])
  })

  it('去重', () => {
    expect(missingRates(['USD', 'USD', 'EUR'], {})).toEqual(['USD', 'EUR'])
  })
})

describe('currencyName', () => {
  it('返回中文名', () => {
    expect(currencyName('CNY')).toBe('人民币')
    expect(currencyName('JPY')).toBe('日元')
  })
})

describe('formatCompactYuan', () => {
  it('一万元以下按元的整数显示，带千分位', () => {
    expect(formatCompactYuan(0)).toBe('0')
    expect(formatCompactYuan(123456)).toBe('1,235') // 1234.56 元 → 取整
    expect(formatCompactYuan(999900)).toBe('9,999')
  })

  it('一万元起改用「万」，整万不带小数', () => {
    expect(formatCompactYuan(1000000)).toBe('1万')
    expect(formatCompactYuan(1200000)).toBe('1.2万')
    expect(formatCompactYuan(12345600)).toBe('12.3万')
  })

  it('负数保留符号（支出轴不会有，但格式化函数自身要正确）', () => {
    expect(formatCompactYuan(-123456)).toBe('-1,235')
    expect(formatCompactYuan(-1200000)).toBe('-1.2万')
  })
})
