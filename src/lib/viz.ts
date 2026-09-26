/**
 * 图表配色槽位分配。
 *
 * 图表一律使用固定槽位色板（CSS 变量 --series-1..8），**不采用分类的自定义颜色** ——
 * 用户自选色的相邻可区分度无法保证，而槽位顺序是经过色盲可辨性校验的。
 *
 * 分配规则：**颜色跟随分类实体，不跟随金额排名**。槽位 = 该分类在稳定顺序中的序号，
 * 因此同一分类在任何月份、任何筛选下都拿到同一个颜色 —— 换个月份不会整片换色。
 * 仅当可见分类数超过槽位数、两个分类撞到同一槽位时，后一个顺延到空槽，避免同图同色。
 */

/** 槽位数量，与 main.css 中的 --series-1..8 对应 */
export const SERIES_SLOT_COUNT = 8

/** 槽位 → CSS 变量。slot 从 0 开始。 */
export function seriesColorVar(slot: number): string {
  return `var(--series-${(slot % SERIES_SLOT_COUNT) + 1})`
}

/** 折叠项「其他」的颜色变量 */
export const SERIES_OTHER_VAR = 'var(--series-other)'

/**
 * 最窄情形下的堆叠条宽度（px）。按 320px 视口估算：
 * 320 − 页面左右各 16 − 卡片左右各 16 = 256，向下取整到 250。
 */
const NARROWEST_BAR_PX = 250

/**
 * 段内百分比标注放不放得下。
 *
 * dataviz 规范：标注只在「渲染出来确实放得下」时才画进色块里 —— 放不下就交给
 * 图例 / 悬浮读数 / 明细表，绝不用 overflow:hidden 裁掉首尾字符（那比不标更糟）。
 * 标注字号 11px，数字约 6.1px、`%` 约 7.5px，两侧各留 4px 内边距。
 */
export function inlinePercentFits(percent: number): boolean {
  const text = `${Math.round(percent * 100)}%`
  return percent * NARROWEST_BAR_PX >= text.length * 7 + 8
}

/**
 * 为可见分类分配槽位。
 *
 * @param visibleIds  本次要着色的分类 id（null 表示折叠项「其他」）
 * @param stableOrder 分类的稳定顺序（通常来自 Category 数组顺序）
 * @returns categoryId → 槽位下标（0 起）；「其他」固定拿到最后一个槽位的下一个，即
 *          由调用方自行用 SERIES_OTHER_VAR 处理，这里不为其分配槽位。
 */
export function assignSeriesSlots(
  visibleIds: readonly string[],
  stableOrder: readonly string[],
): Map<string, number> {
  const rank = new Map<string, number>()
  stableOrder.forEach((id, i) => rank.set(id, i))

  // 先按稳定顺序排队，再依次占用尚未使用的槽位
  const queued = [...new Set(visibleIds)].sort(
    (a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER),
  )

  const assigned = new Map<string, number>()
  const used = new Set<number>()

  for (const id of queued) {
    // 首选槽位只由分类自身的稳定序号决定，与同屏还有谁无关 —— 这是颜色稳定的关键。
    const preferred = (rank.get(id) ?? assigned.size) % SERIES_SLOT_COUNT
    let slot = preferred

    if (used.has(slot)) {
      // 冲突只在可见分类数超过槽位数时发生：顺延到下一个空槽，避免同图出现同色两段。
      let free = 0
      while (free < SERIES_SLOT_COUNT && used.has(free)) free++
      if (free < SERIES_SLOT_COUNT) slot = free
    }

    used.add(slot)
    assigned.set(id, slot)
  }
  return assigned
}
