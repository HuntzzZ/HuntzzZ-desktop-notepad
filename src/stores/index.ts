import { defineStore } from 'pinia'
import { ref } from 'vue'
import { updateUser, type User } from '../utils/db'

/**
 * 全局应用状态
 */
export const useAppStore = defineStore('app', () => {
  const currentUser = ref<User | null>(null)
  const isDark = ref(false)
  const sidebarCollapsed = ref(false)
  const isUnlocked = ref(false)
  const lockPasswordHash = ref('')

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

  function setLock(hash: string) {
    lockPasswordHash.value = hash
    isUnlocked.value = true
  }

  function unlock() {
    isUnlocked.value = true
  }

  function clearLock() {
    lockPasswordHash.value = ''
    isUnlocked.value = true
  }

  return { currentUser, isDark, sidebarCollapsed, isUnlocked, lockPasswordHash, init, toggleDark, toggleSidebar, updateProfile, setLock, unlock, clearLock }
})
