<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from './stores'
import { getUser } from './utils/db'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const menuItems = [
  { path: '/dashboard', label: '仪表盘', icon: '📊' },
  { path: '/work-task', label: '工作任务', icon: '📋' },
  { path: '/wechat-editor', label: '公众号编辑', icon: '✏️' },
  { path: '/ai-search', label: 'AI 搜问', icon: '🤖' },
  { path: '/my', label: '我的', icon: '👤' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

// Auth guard
watch(() => route.path, (path) => {
  if (!appStore.isLoggedIn && path !== '/login') {
    router.replace('/login')
  }
}, { immediate: true })

onMounted(async () => {
  // Try auto-login
  const savedUserId = localStorage.getItem('currentUserId')
  if (savedUserId) {
    const user = await getUser(Number(savedUserId))
    if (user) {
      await appStore.init(user)
      if (route.path === '/login') {
        router.replace('/dashboard')
      }
      return
    }
  }
  // No saved user, go to login
  if (route.path !== '/login') {
    router.replace('/login')
  }
})
</script>

<template>
  <div class="layout" v-if="route.path !== '/login'">
    <aside class="sidebar" :class="{ collapsed: appStore.sidebarCollapsed }">
      <div class="sidebar-header">
        <div class="user-info" @click="router.push('/settings')">
          <span class="user-avatar">{{ appStore.currentUser?.avatar || '😊' }}</span>
          <div v-if="!appStore.sidebarCollapsed" class="user-detail">
            <div class="user-name">{{ appStore.currentUser?.display_name || '用户' }}</div>
            <div class="user-tag">Desktop Notepad</div>
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: route.path === item.path }"
          :title="item.label"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span v-if="!appStore.sidebarCollapsed" class="nav-label">{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <button class="theme-toggle" @click="appStore.toggleDark" :title="appStore.isDark ? '亮色模式' : '暗色模式'">
          {{ appStore.isDark ? '☀️' : '🌙' }}
          <span v-if="!appStore.sidebarCollapsed">{{ appStore.isDark ? '亮色' : '暗色' }}</span>
        </button>
      </div>
    </aside>
    <main class="main-content">
      <router-view />
    </main>
  </div>
  <router-view v-else />
</template>

<style scoped>
.layout {
  display: flex;
  width: 100vw;
  height: 100vh;
}

.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  user-select: none;
  transition: width 0.2s, min-width 0.2s;
}

.sidebar.collapsed {
  width: 68px;
  min-width: 68px;
}

.sidebar-header {
  padding: 0 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius);
  transition: background 0.2s;
}

.user-info:hover { background: var(--bg-sidebar-hover); }

.user-avatar {
  width: 44px;
  height: 44px;
  background: rgba(255,255,255,0.1);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.user-detail { overflow: hidden; }

.user-name {
  font-size: 15px;
  color: #fff;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-tag {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  color: var(--text-sidebar);
  text-decoration: none;
  transition: all 0.2s;
  border-left: 3px solid transparent;
  margin: 2px 0;
}

.nav-item:hover {
  background: var(--bg-sidebar-hover);
  color: rgba(255,255,255,0.9);
}

.nav-item.active {
  background: var(--bg-sidebar-active);
  border-left-color: var(--accent);
  color: #fff;
}

.nav-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
}

.nav-label {
  font-size: 14px;
  white-space: nowrap;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.theme-toggle {
  background: none;
  border: 1px solid rgba(255,255,255,0.12);
  color: var(--text-sidebar);
  padding: 10px 14px;
  border-radius: var(--radius);
  cursor: pointer;
  width: 100%;
  font-size: 13px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
}

.theme-toggle:hover {
  background: var(--bg-sidebar-hover);
  color: rgba(255,255,255,0.9);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-secondary);
}
</style>
