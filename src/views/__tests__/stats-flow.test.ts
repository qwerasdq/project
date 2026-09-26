/**
 * 统计页集成测试。
 *
 * ECharts 画在 canvas 上，jsdom 没有 canvas，所以这里把 vue-echarts 换成桩，
 * **接住传进去的 option 并直接断言它** —— 比截图比对可靠得多：
 * 系列名、每月数值、x 轴刻度、单轴（yAxis 不是数组）都能验到。
 * 占比条是手写 HTML，不需要桩，连同悬停读数一起实测。
 */

import { h } from 'vue'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StatsView from '@/views/StatsView.vue'
import { useMonth } from '@/composables/useMonth'
import { currentMonth, shiftMonth } from '@/lib/date'
import { useDbStore } from '@/stores/db'

/** 桩组件把每次渲染拿到的 option 记下来，供断言读取 */
const mocks = vi.hoisted(() => ({ option: null as unknown }))

vi.mock('vue-echarts', () => ({
  default: {
    name: 'VChartStub',
    props: { option: { type: Object, default: null } },
    setup(props: { option: unknown }) {
      return () => {
        mocks.option = props.option
        return h('div', { 'data-test': 'trend-chart' })
      }
    },
  },
}))

type Wrapper = ReturnType<typeof mount>

interface CapturedOption {
  xAxis: { data: string[] }
  yAxis: { type: string } | { type: string }[]
  series: { name: string; type: string; data: number[]; itemStyle: { color: string } }[]
  legend: { top: number; left: number }
}

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/stats', component: { template: '<div />' } },
    { path: '/settings', component: { template: '<div />' } },
  ],
})

let store: ReturnType<typeof useDbStore>
let wrapper: Wrapper | null = null

const MONTH = currentMonth()

beforeEach(async () => {
  mocks.option = null
  localStorage.clear()
  setActivePinia(createPinia())
  store = useDbStore()
  useMonth().goTo(MONTH)
  await router.push('/stats')
  await router.isReady()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

async function mountStats(): Promise<Wrapper> {
  const w = mount(StatsView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return w
}

function cashId(): string {
  const a = store.activeAccounts[0]
  if (!a) throw new Error('测试夹具缺少账户')
  return a.id
}

function categoryIdOf(name: string): string {
  const c = store.categories.find((x) => x.name === name)
  if (!c) throw new Error(`测试夹具缺少分类：${name}`)
  return c.id
}

function spend(name: string, amount: number, occurredAt: string): void {
  store.addTransaction({
    type: 'expense',
    accountId: cashId(),
    categoryId: categoryIdOf(name),
    amount,
    occurredAt,
  })
}

function earn(name: string, amount: number, occurredAt: string): void {
  store.addTransaction({
    type: 'income',
    accountId: cashId(),
    categoryId: categoryIdOf(name),
    amount,
    occurredAt,
  })
}

/** 'YYYY-MM' → '2026年9月'，与 lib/date 的 monthLabel 同规则，供区间文案断言用 */
function ymLabel(month: string): string {
  return `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`
}

function trendOption(): CapturedOption {
  if (!mocks.option) throw new Error('趋势图没有拿到 option')
  return mocks.option as CapturedOption
}

function buttonByText(w: Wrapper, text: string) {
  const button = w.findAll('button').find((b) => b.text().trim() === text)
  if (!button) throw new Error(`找不到按钮：${text}`)
  return button
}

/** 占比条的色段。容器带 role="img"，段是它的直接子元素。 */
function segments(w: Wrapper): DOMWrapper<Element>[] {
  return [...w.get('[role="img"]').element.children].map((el) => new DOMWrapper(el))
}

function bar(w: Wrapper) {
  return w.get('[role="img"]')
}

/** 页面上有两张表：趋势数据表与占比明细表，按表头文字区分 */
function tableWith(w: Wrapper, header: string) {
  const table = w.findAll('table').find((t) => t.text().includes(header))
  if (!table) throw new Error(`找不到表头含「${header}」的表格`)
  return table
}


describe('过滤区', () => {
  it('月份选择器与区间开关在同一行，默认近 6 个月', async () => {
    wrapper = await mountStats()

    expect(wrapper.find('button[aria-label="上一个月"]').exists()).toBe(true)
    expect(buttonByText(wrapper, '近 6 月').attributes('aria-pressed')).toBe('true')
    expect(buttonByText(wrapper, '近 12 月').attributes('aria-pressed')).toBe('false')
  })

  it('切到近 12 月后趋势变长，标题与区间文案一起更新', async () => {
    spend('餐饮', 10000, `${MONTH}-05`)
    wrapper = await mountStats()
    expect(trendOption().xAxis.data).toHaveLength(6)
    expect(wrapper.text()).toContain(`${ymLabel(shiftMonth(MONTH, -5))} –`)

    await buttonByText(wrapper, '近 12 月').trigger('click')
    await flushPromises()

    expect(trendOption().xAxis.data).toHaveLength(12)
    expect(wrapper.text()).toContain('近 12 个月收支')
    expect(wrapper.text()).toContain(`${ymLabel(shiftMonth(MONTH, -11))} –`)
  })

  it('近 6 个月没有数据时，区间开关仍在，切到 12 月能看到更早的账目', async () => {
    spend('餐饮', 10000, `${shiftMonth(MONTH, -8)}-05`)
    wrapper = await mountStats()

    // 默认 6 个月窗口是空的，但开关没有被空状态吞掉
    expect(wrapper.text()).toContain('还没有可统计的账目')
    expect(buttonByText(wrapper, '近 12 月').exists()).toBe(true)

    await buttonByText(wrapper, '近 12 月').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="trend-chart"]').exists()).toBe(true)
    expect(trendOption().series[0]?.data[3]).toBe(10000) // 第 4 个点 = 8 个月前
  })
})

describe('月度趋势图', () => {
  it('两个系列共用一个 y 轴（绝不对偶轴）', async () => {
    spend('餐饮', 10000, `${MONTH}-05`)
    wrapper = await mountStats()

    const option = trendOption()
    expect(Array.isArray(option.yAxis)).toBe(false)
    expect(option.yAxis).toMatchObject({ type: 'value' })
    expect(option.series.map((s) => s.name)).toEqual(['支出', '收入'])
  })

  it('每月数值与账单口径一致，x 轴是月份短标签', async () => {
    earn('工资', 500000, `${MONTH}-05`)
    spend('餐饮', 120000, `${MONTH}-10`)
    spend('餐饮', 30000, `${shiftMonth(MONTH, -1)}-10`)
    wrapper = await mountStats()

    const option = trendOption()
    const expense = option.series[0]
    const income = option.series[1]

    expect(option.xAxis.data).toEqual([
      shiftMonth(MONTH, -5),
      shiftMonth(MONTH, -4),
      shiftMonth(MONTH, -3),
      shiftMonth(MONTH, -2),
      shiftMonth(MONTH, -1),
      MONTH,
    ].map((m) => `${Number(m.slice(5, 7))}月`))
    expect(expense?.data).toEqual([0, 0, 0, 0, 30000, 120000])
    expect(income?.data).toEqual([0, 0, 0, 0, 0, 500000])
  })

  it('系列色是解析后的具体色值 —— canvas 不认 CSS 变量', async () => {
    spend('餐饮', 10000, `${MONTH}-05`)
    wrapper = await mountStats()

    for (const series of trendOption().series) {
      expect(series.itemStyle.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('两个系列带图例', async () => {
    spend('餐饮', 10000, `${MONTH}-05`)
    wrapper = await mountStats()

    expect(trendOption().legend).toMatchObject({ top: 0, left: 0 })
  })

  it('转账不进图表', async () => {
    store.addAccount({
      name: '美元卡',
      currency: 'USD',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    const target = store.activeAccounts.find((a) => a.name === '美元卡')
    if (!target) throw new Error('测试夹具缺少账户')
    store.addTransfer({
      fromAccountId: cashId(),
      toAccountId: target.id,
      amount: 100000,
      rate: 0.14,
      occurredAt: `${MONTH}-10`,
    })
    wrapper = await mountStats()

    // 全是转账 → 没有可统计的收支，整页空状态
    expect(wrapper.text()).toContain('还没有可统计的账目')
  })

  it('数据表与图上数字一致', async () => {
    earn('工资', 500000, `${MONTH}-05`)
    spend('餐饮', 120000, `${MONTH}-10`)
    wrapper = await mountStats()

    const table = tableWith(wrapper, '月份').text()
    expect(table).toContain('支出')
    expect(table).toContain('结余')
    expect(table).toContain('1,200.00')
    expect(table).toContain('5,000.00')
    expect(table).toContain('3,800.00') // 结余 = 收入 − 支出
  })
})

describe('支出构成', () => {
  function setupThree(): void {
    spend('餐饮', 100000, `${MONTH}-05`)
    spend('交通', 3000, `${MONTH}-06`)
    spend('购物', 2000, `${MONTH}-07`)
  }

  it('每段一个色块，段数等于分类数', async () => {
    setupThree()
    wrapper = await mountStats()

    const segs = segments(wrapper)
    expect(segs).toHaveLength(3)
    expect(segs[0]?.attributes('style')).toContain('var(--series-1)')
    expect(segs[1]?.attributes('style')).toContain('var(--series-2)')
  })

  it('窄段不标百分比，值由明细表兜住（标注绝不被裁切）', async () => {
    setupThree()
    wrapper = await mountStats()

    // 只有 95% 那段放得下标注
    expect(bar(wrapper).text()).toContain('95%')
    expect(bar(wrapper).text()).not.toContain('3%')

    const rows = tableWith(wrapper, '分类').findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.text()).join(' ')).toContain('3%')
  })

  it('明细表带颜色标识、金额与占比，合计等于本月支出', async () => {
    setupThree()
    wrapper = await mountStats()

    const table = tableWith(wrapper, '分类').text()
    expect(table).toContain('餐饮')
    expect(table).toContain('1,000.00')
    expect(table).toContain('95%')
    expect(wrapper.text()).toContain('合计')
    expect(wrapper.text()).toContain('1,050.00')
  })

  it('悬停某段显示该段读数，移出回到合计', async () => {
    setupThree()
    wrapper = await mountStats()

    await segments(wrapper)[1]?.trigger('mouseenter')
    expect(wrapper.text()).toContain('交通 · ¥30.00 · 3%')

    await bar(wrapper).trigger('mouseleave')
    expect(wrapper.text()).toContain('合计 ¥1,050.00')
    expect(wrapper.text()).not.toContain('交通 ·')
  })

  it('点按某段也能看到读数 —— 手机上并没有悬停这回事', async () => {
    setupThree()
    wrapper = await mountStats()

    await segments(wrapper)[2]?.trigger('click')
    expect(wrapper.text()).toContain('购物 · ¥20.00 · 2%')

    await segments(wrapper)[2]?.trigger('click')
    expect(wrapper.text()).toContain('合计 ¥1,050.00')
  })

  it('悬停明细表的一行与悬停色段联动', async () => {
    setupThree()
    wrapper = await mountStats()

    await tableWith(wrapper, '分类').findAll('tbody tr')[1]?.trigger('mouseenter')

    expect(wrapper.text()).toContain('交通 · ¥30.00 · 3%')
  })

  it('无障碍名称按「分类 + 占比」把整条说清', async () => {
    setupThree()
    wrapper = await mountStats()

    const label = bar(wrapper).attributes('aria-label') ?? ''
    expect(label).toContain('支出构成')
    expect(label).toContain('餐饮 95%')
    expect(label).toContain('交通 3%')
  })

  it('本月只有收入时给出提示，不画空条', async () => {
    earn('工资', 500000, `${MONTH}-05`)
    wrapper = await mountStats()

    expect(wrapper.text()).toContain('本月还没有支出记录')
    expect(wrapper.find('[role="img"]').exists()).toBe(false)
  })
})

describe('空状态与汇率提示', () => {
  it('近半年没有账目时整页给出引导', async () => {
    wrapper = await mountStats()

    expect(wrapper.text()).toContain('还没有可统计的账目')
    expect(wrapper.find('[data-test="trend-chart"]').exists()).toBe(false)
  })

  it('外币缺汇率时在图表上方提示', async () => {
    store.addAccount({
      name: '欧元卡',
      currency: 'EUR',
      initialBalance: 0,
      icon: '💳',
      color: '#2a78d6',
    })
    const eur = store.activeAccounts.find((a) => a.name === '欧元卡')
    if (!eur) throw new Error('测试夹具缺少账户')
    store.addTransaction({
      type: 'expense',
      accountId: eur.id,
      categoryId: categoryIdOf('餐饮'),
      amount: 5000,
      occurredAt: `${MONTH}-05`,
    })
    wrapper = await mountStats()

    expect(wrapper.text()).toContain('未设置 EUR 汇率')
    expect(wrapper.text()).toContain('去设置')
  })
})
