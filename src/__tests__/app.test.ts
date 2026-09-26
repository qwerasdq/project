/**
 * 应用骨架冒烟测试：路由可导航、标题正确、TabBar 按 meta.tab 显示/隐藏。
 * 阶段 3 的验收标准「全部页面可导航、tab 高亮正确」由这里自动兜住。
 */

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import App from '@/App.vue'
import AppTabBar from '@/components/AppTabBar.vue'
import router from '@/router'

/** 路由表里所有存在的路径（:id 用真实值代入） */
const ROUTES: { path: string; title: string; tab?: string }[] = [
  { path: '/', title: '首页', tab: 'dashboard' },
  { path: '/transactions', title: '账单', tab: 'transactions' },
  { path: '/transactions/new', title: '记一笔' },
  { path: '/transfers/new', title: '转账' },
  { path: '/stats', title: '统计', tab: 'stats' },
  { path: '/budgets', title: '预算' },
  { path: '/accounts', title: '账户' },
  { path: '/categories', title: '分类' },
  { path: '/mine', title: '我的', tab: 'mine' },
  { path: '/settings', title: '设置' },
]

let wrapper: ReturnType<typeof mount> | null = null

beforeEach(() => {
  localStorage.clear()
  // jsdom 没实现 scrollTo，路由的 scrollBehavior 会刷屏告警
  window.scrollTo = () => {}
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

/**
 * router 是模块级单例，上一个用例的路径会残留。这里显式指定起始路径，
 * 保证每个用例的起点一致。
 */
async function mountApp(initialPath = '/'): Promise<ReturnType<typeof mount>> {
  await router.push(initialPath)
  const w = mount(App, {
    global: { plugins: [createPinia(), router] },
    attachTo: document.body,
  })
  await router.isReady()
  await flushPromises()
  return w
}

describe('路由', () => {
  it('路由表里每个路径都能解析到已命名的路由（没有未匹配项）', () => {
    for (const { path } of ROUTES) {
      const resolved = router.resolve(path)
      expect(resolved.name, `路径 ${path} 未匹配到路由`).not.toBe('not-found')
    }
    expect(router.resolve('/transactions/abc123/edit').name).toBe('transaction-edit')
  })

  it('未知路径重定向到首页', () => {
    expect(router.resolve('/根本不存在的路径').name).toBe('not-found')
  })

  it.each(ROUTES)('$path 能渲染出「$title」', async ({ path, title }) => {
    wrapper = await mountApp()
    await router.push(path)
    await flushPromises()
    expect(wrapper.text()).toContain(title)
  })

  it('写入 document.title', async () => {
    wrapper = await mountApp()
    await router.push('/budgets')
    await flushPromises()
    expect(document.title).toBe('预算 · 记账本')
  })
})

describe('底部导航', () => {
  it('带 tab 的页面显示 TabBar', async () => {
    wrapper = await mountApp()
    for (const { path, tab } of ROUTES.filter((r) => r.tab)) {
      await router.push(path)
      await flushPromises()
      expect(wrapper.findComponent(AppTabBar).exists(), `${path} 应显示 TabBar`).toBe(true)
      expect(tab).toBeDefined()
    }
  })

  it('表单类页面隐藏 TabBar，给表单腾整屏', async () => {
    wrapper = await mountApp()
    for (const path of ['/transactions/new', '/transfers/new', '/budgets', '/settings']) {
      await router.push(path)
      await flushPromises()
      expect(wrapper.findComponent(AppTabBar).exists(), `${path} 不应显示 TabBar`).toBe(false)
    }
  })

  it('TabBar 有 4 个跳转项加 1 个中央记账按钮', async () => {
    wrapper = await mountApp('/')
    const tabBar = wrapper.findComponent(AppTabBar)
    expect(tabBar.findAll('a')).toHaveLength(5)
    expect(tabBar.find('a[aria-label="记一笔"]').exists()).toBe(true)
  })
})

describe('Toast 容器', () => {
  it('应用挂载后即存在（Teleport 到 body）', async () => {
    wrapper = await mountApp()
    expect(document.body.querySelector('[role="status"]')).not.toBeNull()
  })
})
