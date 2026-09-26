/**
 * 数据结构版本迁移与损坏兜底。
 *
 * 纯函数，不碰 localStorage —— 备份与重建由 `db/index.ts` 负责，这样迁移逻辑可以单测。
 */

import type { Database } from '@/types'

/** 当前数据结构版本。改动 src/types 中的持久化结构时必须 +1 并追加迁移。 */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * 单个迁移步骤：把版本 i+1 的原始对象升到版本 i+2。
 * 入参是未经校验的普通对象，实现里要自行容错。
 */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>

/**
 * 迁移表。索引 0 表示 v1 → v2，索引 1 表示 v2 → v3，依此类推。
 * v1 是基线版本，暂无迁移。
 */
export const migrations: Migration[] = []

export type MigrateResult =
  | { ok: true; db: Database; appliedMigrations: number }
  | { ok: false; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isArrayOf(value: unknown, check: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(check)
}

/** 结构校验：只检查形状，不逐字段深挖，避免过度耦合 */
function looksLikeDatabase(raw: Record<string, unknown>): boolean {
  return (
    isArrayOf(raw['accounts'], isRecord) &&
    isArrayOf(raw['categories'], isRecord) &&
    isArrayOf(raw['transactions'], isRecord) &&
    isArrayOf(raw['budgets'], isRecord) &&
    isRecord(raw['settings'])
  )
}

/**
 * 把从 localStorage 读到的任意值迁移为当前版本的 Database。
 *
 * 失败时返回 `{ ok: false, reason }`，由调用方决定备份与重建 ——
 * 这里**绝不**抛异常，也**绝不**静默丢弃用户数据。
 */
export function migrate(raw: unknown): MigrateResult {
  if (!isRecord(raw)) {
    return { ok: false, reason: '数据不是有效的对象' }
  }

  const version = raw['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: '缺少有效的版本号' }
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `数据版本（v${version}）高于当前应用支持的版本（v${CURRENT_SCHEMA_VERSION}）`,
    }
  }

  let work = raw
  const from = version
  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = migrations[v - 1]
    if (!step) return { ok: false, reason: `缺少 v${v} 到 v${v + 1} 的迁移步骤` }
    try {
      work = step(work)
    } catch {
      return { ok: false, reason: `升级到 v${v + 1} 失败` }
    }
  }

  if (!looksLikeDatabase(work)) {
    return { ok: false, reason: '数据结构不完整' }
  }

  return {
    ok: true,
    db: { ...(work as unknown as Database), schemaVersion: CURRENT_SCHEMA_VERSION },
    appliedMigrations: CURRENT_SCHEMA_VERSION - from,
  }
}
