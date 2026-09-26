/**
 * localStorage 读写。
 *
 * 组件**绝不**直接调用这里 —— 一律走 `stores/db.ts`。本模块只负责：
 * 读 → 迁移 → 兜底重建，以及写入与配额异常处理。
 */

import type { Database } from '@/types'
import { migrate } from './migrate'
import { seedDatabase } from './seed'

export const DB_KEY = 'moneytracker:db'
export const BACKUP_KEY = 'moneytracker:db:backup'

/**
 * localStorage 在隐私模式、禁用 Cookie、配额写满等情况下会抛异常。
 * 这里统一兜住，失败时退化为内存存储，保证应用仍可用（只是刷新后丢失）。
 */
const memoryFallback = new Map<string, string>()

function safeGet(key: string): string | null {
  try {
    const ls = globalThis.localStorage
    // localStorage 可用时它是唯一权威来源：返回 null 就是真的没有数据，
    // 此时**不能**回退到内存副本，否则会读到已被清空的陈旧内容。
    if (ls) return ls.getItem(key)
  } catch {
    // 存储被禁用（隐私模式等），退回内存副本
  }
  return memoryFallback.get(key) ?? null
}

function safeSet(key: string, value: string): boolean {
  memoryFallback.set(key, value)
  try {
    globalThis.localStorage?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** 上次加载是否发生了「数据损坏 → 已备份并重建」，供界面提示用户 */
let lastRecoveryReason: string | null = null

export function recoveryReason(): string | null {
  return lastRecoveryReason
}

function recover(reason: string): Database {
  lastRecoveryReason = reason
  const fresh = seedDatabase()
  saveDatabase(fresh)
  return fresh
}

/**
 * 读取数据库。任何一步失败都不会让应用崩掉：
 * 原始内容先备份到 BACKUP_KEY，再用种子数据重建。
 */
export function loadDatabase(): Database {
  lastRecoveryReason = null

  const rawText = safeGet(DB_KEY)
  if (rawText === null) {
    const fresh = seedDatabase()
    saveDatabase(fresh)
    return fresh
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    // 原文先留档，再重建 —— 用户数据不至于直接消失
    safeSet(BACKUP_KEY, rawText)
    return recover('本地数据无法解析')
  }

  const result = migrate(parsed)
  if (!result.ok) {
    safeSet(BACKUP_KEY, rawText)
    return recover(result.reason)
  }

  return result.db
}

/** 写入数据库。返回 false 表示写入失败（配额满或存储被禁用）。 */
export function saveDatabase(db: Database): boolean {
  try {
    return safeSet(DB_KEY, JSON.stringify(db))
  } catch {
    // JSON.stringify 理论上不会抛（数据来自内部），兜住以防循环引用
    return false
  }
}

/** 清空并回到种子状态 */
export function resetDatabase(): Database {
  const fresh = seedDatabase()
  saveDatabase(fresh)
  return fresh
}

/** 是否存在损坏数据的备份 */
export function hasBackup(): boolean {
  return safeGet(BACKUP_KEY) !== null
}
