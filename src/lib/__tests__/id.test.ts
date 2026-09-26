import { describe, expect, it } from 'vitest'

import { uid } from '../id'

describe('uid', () => {
  it('返回非空字符串', () => {
    expect(uid()).toBeTypeOf('string')
    expect(uid().length).toBeGreaterThan(0)
  })

  it('每次调用都不同', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uid()))
    expect(ids.size).toBe(1000)
  })

  it('优先使用 crypto.randomUUID，返回标准 UUID 格式', () => {
    expect(uid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
