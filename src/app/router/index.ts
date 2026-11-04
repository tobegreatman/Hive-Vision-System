import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'hive',
    component: () => import('@/pages/market/MarketPage.vue'),
    meta: { title: '板块蜂巢' },
  },
  {
    // 下钻层：同一个页面组件，由路由参数决定蜂巢铺什么
    path: '/board/:board',
    name: 'hive-board',
    component: () => import('@/pages/market/MarketPage.vue'),
    meta: { title: '蜂巢盘面' },
  },
  {
    path: '/flow',
    name: 'flow',
    component: () => import('@/pages/flow/FlowPage.vue'),
    meta: { title: '行业资金流' },
  },
  {
    path: '/mainline',
    name: 'mainline',
    component: () => import('@/pages/mainline/MainlinePage.vue'),
    meta: { title: '市场主线分析' },
  },
  {
    path: '/stock',
    name: 'stock',
    component: () => import('@/pages/stock/StockPage.vue'),
    meta: { title: '个股分析' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/not-found/NotFoundPage.vue'),
    meta: { title: '页面不存在' },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => {
  const title = typeof to.meta.title === 'string' ? to.meta.title : '盘面'
  document.title = `${title} · 盘面`
})
