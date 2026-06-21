import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', name: 'Login', component: () => import('../pages/Login/index.vue') },
  { path: '/dashboard', name: 'Dashboard', component: () => import('../pages/Dashboard/index.vue') },
  { path: '/work-task', name: 'WorkTask', component: () => import('../pages/WorkTask/index.vue') },
  { path: '/wechat-editor', name: 'WechatEditor', component: () => import('../pages/WechatEditor/index.vue') },
  { path: '/ai-search', name: 'AiSearch', component: () => import('../pages/AiSearch/index.vue') },
  { path: '/my', name: 'My', component: () => import('../pages/My/index.vue') },
  { path: '/settings', name: 'Settings', component: () => import('../pages/Settings/index.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
