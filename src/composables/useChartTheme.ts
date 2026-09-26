/**
 * 图表令牌解析。
 *
 * ECharts 画在 canvas 上，**不认 CSS 变量** —— `ctx.fillStyle = 'var(--series-2)'`
 * 会被静默忽略，画出来是上一笔的颜色。所以必须先把令牌解析成具体色值再交给 ECharts。
 *
 * 跟随系统切换主题时重新解析一次，否则暗色下会残留浅色的网格线与文字。
 */

import type { Ref } from 'vue'
import { onScopeDispose, ref } from 'vue'

/** 图表需要的令牌 → 语义名 */
const TOKENS = {
  surface: '--surface',
  hairline: '--hairline',
  ink: '--ink',
  inkSecondary: '--ink-secondary',
  inkMuted: '--ink-muted',
  expense: '--series-2',
  income: '--series-3',
} as const

export type ChartToken = keyof typeof TOKENS
export type ChartTheme = Record<ChartToken, string>

/**
 * 读不到令牌时的兜底（jsdom、或样式尚未加载完）。值与 main.css 浅色 `:root` 一致，
 * 只是兜底 —— 正常路径永远走令牌，改主题令牌不需要改这里。
 */
const FALLBACK: ChartTheme = {
  surface: '#fcfcfb',
  hairline: '#e1e0d9',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  inkMuted: '#898781',
  expense: '#eb6834',
  income: '#1baf7a',
}

function resolveTokens(): ChartTheme {
  if (typeof window === 'undefined') return { ...FALLBACK }

  const styles = getComputedStyle(document.documentElement)
  const theme = {} as ChartTheme
  for (const [key, token] of Object.entries(TOKENS) as [ChartToken, string][]) {
    theme[key] = styles.getPropertyValue(token).trim() || FALLBACK[key]
  }
  return theme
}

export function useChartTheme(): Ref<ChartTheme> {
  const theme = ref(resolveTokens())
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null

  if (media) {
    const refresh = (): void => {
      theme.value = resolveTokens()
    }
    media.addEventListener('change', refresh)
    onScopeDispose(() => media.removeEventListener('change', refresh))
  }

  return theme
}
