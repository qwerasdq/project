import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  currentMonth,
  dateLabel,
  daysInMonth,
  lastNMonths,
  monthLabel,
  monthShortLabel,
  relativeDateLabel,
  shiftDay,
  shiftMonth,
  toMonth,
  todayISO,
} from '../date'

describe('todayISO', () => {
  it('返回本地时区的 YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 23, 30))
    expect(todayISO()).toBe('2026-09-27')
    vi.useRealTimers()
  })

  it('跨时区不串日期：本地时间的深夜仍是当天', () => {
    vi.useFakeTimers()
    // 本地 00:30，若按 UTC 解析会变成前一天
    vi.setSystemTime(new Date(2026, 8, 27, 0, 30))
    expect(todayISO()).toBe('2026-09-27')
    vi.useRealTimers()
  })
})

describe('toMonth', () => {
  it('截取到月份', () => {
    expect(toMonth('2026-09-27')).toBe('2026-09')
    expect(toMonth('2026-01-01')).toBe('2026-01')
  })
})

describe('currentMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('返回当前月份', () => {
    expect(currentMonth()).toBe('2026-09')
  })
})

describe('shiftMonth', () => {
  it('向后偏移', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-09', 3)).toBe('2026-12')
  })

  it('向前偏移', () => {
    expect(shiftMonth('2026-09', -1)).toBe('2026-08')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('跨年', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-12', 12)).toBe('2027-12')
    expect(shiftMonth('2026-01', -12)).toBe('2025-01')
  })

  it('偏移 0 个月不变', () => {
    expect(shiftMonth('2026-09', 0)).toBe('2026-09')
  })
})

describe('lastNMonths', () => {
  it('返回升序的最近 n 个月，含endMonth', () => {
    expect(lastNMonths(3, '2026-09')).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('跨年正确', () => {
    expect(lastNMonths(4, '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('n 为 1 时只有当月', () => {
    expect(lastNMonths(1, '2026-09')).toEqual(['2026-09'])
  })

  it('n 为 12 时长度正确', () => {
    const months = lastNMonths(12, '2026-09')
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2025-10')
    expect(months[11]).toBe('2026-09')
  })
})

describe('monthLabel', () => {
  it('去掉前导零', () => {
    expect(monthLabel('2026-09')).toBe('2026年9月')
    expect(monthLabel('2026-12')).toBe('2026年12月')
  })
})

describe('monthShortLabel', () => {
  it('仅保留月份', () => {
    expect(monthShortLabel('2026-09')).toBe('9月')
    expect(monthShortLabel('2026-12')).toBe('12月')
  })
})

describe('daysInMonth', () => {
  it('常规月份', () => {
    expect(daysInMonth('2026-09')).toBe(30)
    expect(daysInMonth('2026-01')).toBe(31)
  })

  it('平年二月', () => {
    expect(daysInMonth('2026-02')).toBe(28)
  })

  it('闰年二月', () => {
    expect(daysInMonth('2028-02')).toBe(29)
  })

  it('逢百不闰，逢四百闰', () => {
    expect(daysInMonth('2100-02')).toBe(28)
    expect(daysInMonth('2000-02')).toBe(29)
  })
})

describe('dateLabel', () => {
  it('输出月日与星期', () => {
    // 2026-09-27 是周日
    expect(dateLabel('2026-09-27')).toBe('9月27日 周日')
    // 2026-09-26 是周六
    expect(dateLabel('2026-09-26')).toBe('9月26日 周六')
  })

  it('不做前导零填充', () => {
    expect(dateLabel('2026-01-05')).toBe('1月5日 周一')
  })
})

describe('shiftDay', () => {
  it('向后偏移', () => {
    expect(shiftDay('2026-09-27', 1)).toBe('2026-09-28')
  })

  it('向前偏移', () => {
    expect(shiftDay('2026-09-27', -1)).toBe('2026-09-26')
  })

  it('跨月', () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01')
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30')
  })

  it('跨年', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('跨闰年二月', () => {
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDay('2028-02-29', 1)).toBe('2028-03-01')
  })
})

describe('relativeDateLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('今天', () => {
    expect(relativeDateLabel('2026-09-27')).toBe('今天')
  })

  it('昨天', () => {
    expect(relativeDateLabel('2026-09-26')).toBe('昨天')
  })

  it('更早的日期用完整标签', () => {
    expect(relativeDateLabel('2026-09-25')).toBe('9月25日 周五')
  })

  it('明天的日期也用完整标签', () => {
    expect(relativeDateLabel('2026-09-28')).toBe('9月28日 周一')
  })
})
