<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from './stores'
import { getDb, getSetting, saveSetting } from './utils/db'
import LockScreen from './components/LockScreen.vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const showLockScreen = ref(false)
const lockMode = ref<'set' | 'verify'>('verify')
const isInitialized = ref(false)

const menuItems = [
  { path: '/dashboard', label: '仪表盘', icon: '📊' },
  { path: '/work-task', label: '工作任务', icon: '📋' },
  { path: '/wechat-editor', label: '公众号编辑', icon: '✏️' },
  { path: '/ai-search', label: 'AI 搜问', icon: '🤖' },
  { path: '/my', label: '我的', icon: '👤' },
  { path: '/settings', label: '设置', icon: '⚙️' },
]

async function handleLockUnlock(hash: string) {
  if (lockMode.value === 'set') {
    await saveSetting('lock_password', hash)
    appStore.setLock(hash)
  } else {
    if (hash === appStore.lockPasswordHash) {
      appStore.unlock()
    } else {
      return
    }
  }
  showLockScreen.value = false
}

onMounted(async () => {
  const db = await getDb()
  let users = await db.select<{ id: number; username: string; display_name: string; avatar: string; entry_date: string; work_start_time: string; work_end_time: string; theme: string; hitokoto_category: string }[]>(
    'SELECT * FROM users LIMIT 1'
  )
  if (users.length === 0) {
    await db.execute("INSERT INTO users (username, password_hash, display_name) VALUES ('default', '', '用户')")
    users = await db.select('SELECT * FROM users LIMIT 1')
  }
  await appStore.init(users[0])

  const lockHash = await getSetting('lock_password', '')
  if (lockHash) {
    appStore.lockPasswordHash = lockHash
    lockMode.value = 'verify'
    showLockScreen.value = true
    appStore.isUnlocked = false
  } else {
    appStore.isUnlocked = true
  }

  isInitialized.value = true
})
</script>

<template>
  <LockScreen
    v-if="showLockScreen"
    :mode="lockMode"
    @unlock="handleLockUnlock"
  />
  <div class="layout" v-if="isInitialized && appStore.isUnlocked">
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
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  user-select: none;
  transition: width 0.2s ease, min-width 0.2s ease;
}

.sidebar.collapsed {
  width: 72px;
  min-width: 72px;
}

.sidebar-header {
  padding: 0 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 10px;
  border-radius: var(--radius);
  transition: background 0.15s ease;
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
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
  margin: 2px 8px;
  border-radius: 0 var(--radius) var(--radius) 0;
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
  font-weight: 500;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.theme-toggle {
  background: none;
  border: 1px solid rgba(255,255,255,0.1);
  color: var(--text-sidebar);
  padding: 10px 14px;
  border-radius: var(--radius);
  cursor: pointer;
  width: 100%;
  font-size: 13px;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  font-weight: 500;
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
