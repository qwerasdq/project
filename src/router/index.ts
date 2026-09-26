import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * 用 hash 模式：构建产物 dist/ 可以直接双击打开或静态托管，不需要服务器重写规则。
 *
 * meta 约定：
 * - `title` 写入 document.title
 * - `tab`   底部 TabBar 高亮项；表单页不设该字段，表示不显示 TabBar
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: '首页', tab: 'dashboard' },
    },
    {
      path: '/transactions',
      name: 'transactions',
      component: () => import('@/views/TransactionsView.vue'),
      meta: { title: '账单', tab: 'transactions' },
    },
    {
      path: '/transactions/new',
      name: 'transaction-new',
      component: () => import('@/views/TransactionFormView.vue'),
      meta: { title: '记一笔' },
    },
    {
      path: '/transactions/:id/edit',
      name: 'transaction-edit',
      component: () => import('@/views/TransactionFormView.vue'),
      meta: { title: '编辑账目' },
    },
    {
      path: '/transfers/new',
      name: 'transfer-new',
      component: () => import('@/views/TransferFormView.vue'),
      meta: { title: '转账' },
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue'),
      meta: { title: '统计', tab: 'stats' },
    },
    {
      path: '/budgets',
      name: 'budgets',
      component: () => import('@/views/BudgetsView.vue'),
      meta: { title: '预算' },
    },
    {
      path: '/accounts',
      name: 'accounts',
      component: () => import('@/views/AccountsView.vue'),
      meta: { title: '账户' },
    },
    {
      path: '/categories',
      name: 'categories',
      component: () => import('@/views/CategoriesView.vue'),
      meta: { title: '分类' },
    },
    {
      path: '/mine',
      name: 'mine',
      component: () => import('@/views/MineView.vue'),
      meta: { title: '我的', tab: 'mine' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: '/',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · 记账本` : '记账本'
})

export default router
