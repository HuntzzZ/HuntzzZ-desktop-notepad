import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { updateUser, type User } from '../utils/db'

/**
 * 全局应用状态
 */
export const useAppStore = defineStore('app', () => {
  const currentUser = ref<User | null>(null)
  const isDark = ref(false)
  const sidebarCollapsed = ref(false)
  const isLoggedIn = computed(() => currentUser.value !== null)

  async function init(user: User) {
    currentUser.value = user
    isDark.value = user.theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function toggleDark() {
    isDark.value = !isDark.value
    document.documentElement.classList.toggle('dark', isDark.value)
    if (currentUser.value) {
      updateUser(currentUser.value.id, { theme: isDark.value ? 'dark' : 'light' })
    }
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  async function updateProfile(updates: Partial<User>) {
    if (!currentUser.value) return
    await updateUser(currentUser.value.id, updates)
    currentUser.value = { ...currentUser.value, ...updates }
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('currentUserId')
  }

  return { currentUser, isDark, sidebarCollapsed, isLoggedIn, init, toggleDark, toggleSidebar, updateProfile, logout }
})
