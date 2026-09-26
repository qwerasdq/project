import { describe, expect, it } from 'vitest'

import {
  SERIES_OTHER_VAR,
  SERIES_SLOT_COUNT,
  assignSeriesSlots,
  inlinePercentFits,
  seriesColorVar,
} from '../viz'

describe('inlinePercentFits', () => {
  it('段够宽时标注放得下', () => {
    expect(inlinePercentFits(1)).toBe(true)
    expect(inlinePercentFits(0.34)).toBe(true)
    expect(inlinePercentFits(0.2)).toBe(true)
  })

  it('段太窄时不标 —— 宁可交给明细表，也不让标注被裁掉', () => {
    expect(inlinePercentFits(0.02)).toBe(false)
    expect(inlinePercentFits(0.05)).toBe(false)
    expect(inlinePercentFits(0.08)).toBe(false)
  })

  it('3 个字符的百分比在约 12% 处跨过阈值', () => {
    // 「11%」需要 29px，最窄的条只有 250px，11% 时只够 27.5px
    expect(inlinePercentFits(0.11)).toBe(false)
    expect(inlinePercentFits(0.12)).toBe(true)
  })
})

describe('seriesColorVar', () => {
  it('槽位从 0 开始映射到 --series-1', () => {
    expect(seriesColorVar(0)).toBe('var(--series-1)')
    expect(seriesColorVar(7)).toBe('var(--series-8)')
  })

  it('超出槽位数时回绕，不生成不存在的变量名', () => {
    expect(seriesColorVar(8)).toBe('var(--series-1)')
    expect(seriesColorVar(9)).toBe('var(--series-2)')
  })
})

describe('SERIES_OTHER_VAR', () => {
  it('指向折叠项的中性色变量', () => {
    expect(SERIES_OTHER_VAR).toBe('var(--series-other)')
  })
})

describe('assignSeriesSlots', () => {
  it('按稳定顺序依次占用槽位', () => {
    const slots = assignSeriesSlots(['b', 'a'], ['a', 'b', 'c'])
    expect(slots.get('a')).toBe(0)
    expect(slots.get('b')).toBe(1)
  })

  it('颜色跟随实体而非传入顺序', () => {
    const order = ['a', 'b', 'c']
    const first = assignSeriesSlots(['a', 'b'], order)
    const second = assignSeriesSlots(['b', 'a'], order)
    expect(second.get('a')).toBe(first.get('a'))
    expect(second.get('b')).toBe(first.get('b'))
  })

  it('换个月份（可见集合变化）时幸存分类尽量保持原槽位', () => {
    const order = ['a', 'b', 'c', 'd']
    const sept = assignSeriesSlots(['a', 'b', 'c'], order)
    // 十月 b 掉出榜单，a 与 c 的槽位不应改变
    const oct = assignSeriesSlots(['a', 'c', 'd'], order)
    expect(oct.get('a')).toBe(sept.get('a'))
    expect(oct.get('c')).toBe(sept.get('c'))
  })

  it('重复 id 去重', () => {
    const slots = assignSeriesSlots(['a', 'a', 'b'], ['a', 'b'])
    expect(slots.size).toBe(2)
  })

  it('可见分类超过槽位数时不产生越界下标', () => {
    const order = Array.from({ length: 12 }, (_, i) => `c${i}`)
    const slots = assignSeriesSlots(order, order)
    expect(slots.size).toBe(12)
    for (const slot of slots.values()) {
      expect(slot).toBeGreaterThanOrEqual(0)
      expect(slot).toBeLessThan(SERIES_SLOT_COUNT)
    }
  })

  it('稳定顺序中不存在的 id 排到最后，不抛错', () => {
    const slots = assignSeriesSlots(['unknown', 'a'], ['a', 'b'])
    expect(slots.get('a')).toBe(0)
    expect(slots.get('unknown')).toBe(1)
  })

  it('空输入返回空映射', () => {
    expect(assignSeriesSlots([], ['a']).size).toBe(0)
  })
})
