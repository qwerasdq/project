/**
 * 徽标底色。色值来自用户数据（localStorage 里存的可能是任何东西），
 * 所以这里重点验**非法输入不会渲成一块透明**。等宽与边距由 Tailwind 类负责，
 * 这个函数只该管颜色。
 */

import { describe, expect, it } from 'vitest'

import { BADGE_COLORS, badgeStyle } from '../presets'

describe('badgeStyle', () => {
  it('六位十六进制色兑成浅底，保留原色相', () => {
    expect(badgeStyle('#2a78d6')).toEqual({ backgroundColor: '#2a78d61f' })
  })

  it('大小写都认', () => {
    expect(badgeStyle('#2A78D6')).toEqual({ backgroundColor: '#2A78D61f' })
  })

  it('缺失色值退回分隔线色，不返回 undefined', () => {
    expect(badgeStyle(undefined)).toEqual({ backgroundColor: 'var(--hairline)' })
  })

  it('格式不对的色值同样退回分隔线色', () => {
    for (const bad of ['', 'red', '#fff', '#12345', '#gggggg', 'rgb(1,2,3)']) {
      expect(badgeStyle(bad)).toEqual({ backgroundColor: 'var(--hairline)' })
    }
  })

  it('预设徽标色全部能通过校验', () => {
    for (const color of BADGE_COLORS) {
      expect(badgeStyle(color).backgroundColor).toBe(`${color}1f`)
    }
  })
})
