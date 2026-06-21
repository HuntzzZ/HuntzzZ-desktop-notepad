<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '../../stores'
import { exportAllData, importAllData, getSetting, saveSetting } from '../../utils/db'
import { getProviderConfig, saveProviderConfig, PROVIDER_NAMES, type AIProvider } from '../../utils/ai'
import { testConnection, uploadData, downloadData, listBackups, generateBackupFilename, type WebDAVConfig } from '../../utils/webdav'

const appStore = useAppStore()

// Work time
const workStart = ref(appStore.currentUser?.work_start_time || '09:00')
const workEnd = ref(appStore.currentUser?.work_end_time || '18:00')

// Entry date
const entryDate = ref(appStore.currentUser?.entry_date || '')

// Hitokoto
const hitokotoCategory = ref(appStore.currentUser?.hitokoto_category || '')

// AI providers
const currentProviderName = ref('mimo')
const providerConfig = ref<AIProvider>(getProviderConfig('mimo'))
const showApiKey = ref(false)

// Search API
const searchApiKey = ref(localStorage.getItem('search-api-key') || '')

// Backup
const backupResult = ref('')

// Avatar
const avatarOptions = ['😊', '😎', '🤓', '😇', '🙂', '😄', '🦊', '🐱', '🐼', '🐨', '🦁', '🐯', '🐸', '🐙', '🦄', '🤖', '👻', '💀', '🎃', '🌟']
const showAvatarPicker = ref(false)

// About
const appVersion = ref('0.3.0')

// Lock screen
const lockEnabled = ref(false)
const showChangeLock = ref(false)
const newLockPassword = ref('')
const confirmLockPassword = ref('')
const lockError = ref('')

// WebDAV
const webdavConfig = ref<WebDAVConfig>({
  server: '',
  username: '',
  password: '',
  path: '/desktop-notepad',
})
const webdavStatus = ref('')
const webdavLoading = ref(false)
const webdavBackups = ref<string[]>([])
const showWebdavPassword = ref(false)

async function hashPassword(pwd: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pwd + 'desktop-notepad-lock-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function saveWorkTime() {
  appStore.updateProfile({ work_start_time: workStart.value, work_end_time: workEnd.value })
}

function saveEntryDate() {
  appStore.updateProfile({ entry_date: entryDate.value })
}

function saveHitokotoCategory() {
  appStore.updateProfile({ hitokoto_category: hitokotoCategory.value })
}

function switchProvider(name: string) {
  currentProviderName.value = name
  providerConfig.value = getProviderConfig(name)
}

function saveProvider() {
  saveProviderConfig(providerConfig.value)
}

function saveSearchApiKey() {
  localStorage.setItem('search-api-key', searchApiKey.value)
}

function selectAvatar(emoji: string) {
  appStore.updateProfile({ avatar: emoji })
  showAvatarPicker.value = false
}

async function handleExport() {
  try {
    const userId = appStore.currentUser?.id || 1
    const json = await exportAllData(userId)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `desktop-notepad-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    backupResult.value = '✅ 导出成功'
  } catch (err: unknown) {
    backupResult.value = `❌ 导出失败: ${err instanceof Error ? err.message : String(err)}`
  }
}

async function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const userId = appStore.currentUser?.id || 1
      const result = await importAllData(userId, text)
      backupResult.value = `✅ 导入成功：${result.tasks} 任务，${result.notes} 笔记，${result.sessions} 会话，${result.cards} 卡片`
    } catch (err: unknown) {
      backupResult.value = `❌ 导入失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
  input.click()
}

// Lock screen functions
async function handleSetLock() {
  lockError.value = ''
  if (newLockPassword.value.length < 4) {
    lockError.value = '口令至少需要 4 位'
    return
  }
  if (newLockPassword.value !== confirmLockPassword.value) {
    lockError.value = '两次输入的口令不一致'
    return
  }
  const hash = await hashPassword(newLockPassword.value)
  await saveSetting('lock_password', hash)
  appStore.setLock(hash)
  lockEnabled.value = true
  showChangeLock.value = false
  newLockPassword.value = ''
  confirmLockPassword.value = ''
}

async function handleClearLock() {
  await saveSetting('lock_password', '')
  appStore.clearLock()
  lockEnabled.value = false
  showChangeLock.value = false
}

// WebDAV functions
async function handleTestWebdav() {
  webdavLoading.value = true
  webdavStatus.value = '测试中...'
  const result = await testConnection(webdavConfig.value)
  webdavStatus.value = result.message
  webdavLoading.value = false

  if (result.success) {
    await saveSetting('webdav_config', JSON.stringify(webdavConfig.value))
    const backups = await listBackups(webdavConfig.value)
    webdavBackups.value = backups
  }
}

async function handleWebdavSync() {
  webdavLoading.value = true
  webdavStatus.value = '同步中...'
  try {
    const userId = appStore.currentUser?.id || 1
    const data = await exportAllData(userId)
    const filename = generateBackupFilename()
    const success = await uploadData(webdavConfig.value, data, filename)
    if (success) {
      webdavStatus.value = `✅ 同步成功: ${filename}`
      const backups = await listBackups(webdavConfig.value)
      webdavBackups.value = backups
    } else {
      webdavStatus.value = '❌ 同步失败'
    }
  } catch (err) {
    webdavStatus.value = `❌ 同步错误: ${err instanceof Error ? err.message : String(err)}`
  }
  webdavLoading.value = false
}

async function handleWebdavRestore(filename: string) {
  webdavLoading.value = true
  webdavStatus.value = '恢复中...'
  try {
    const data = await downloadData(webdavConfig.value, filename)
    if (data) {
      const userId = appStore.currentUser?.id || 1
      const result = await importAllData(userId, data)
      webdavStatus.value = `✅ 恢复成功：${result.tasks} 任务，${result.notes} 笔记，${result.sessions} 会话，${result.cards} 卡片`
    } else {
      webdavStatus.value = '❌ 下载失败'
    }
  } catch (err) {
    webdavStatus.value = `❌ 恢复错误: ${err instanceof Error ? err.message : String(err)}`
  }
  webdavLoading.value = false
}

// Hitokoto categories
const hitokotoCategories = [
  { key: '', label: '随机' },
  { key: 'a', label: '动画' },
  { key: 'b', label: '漫画' },
  { key: 'c', label: '游戏' },
  { key: 'd', label: '文学' },
  { key: 'e', label: '原创' },
  { key: 'f', label: '网络' },
  { key: 'g', label: '其他' },
  { key: 'h', label: '影视' },
  { key: 'i', label: '诗词' },
  { key: 'j', label: '网易云' },
  { key: 'k', label: '哲学' },
  { key: 'l', label: '抖机灵' },
]

onMounted(async () => {
  const lockHash = await getSetting('lock_password', '')
  lockEnabled.value = !!lockHash

  const savedConfig = await getSetting('webdav_config', '')
  if (savedConfig) {
    try {
      webdavConfig.value = JSON.parse(savedConfig)
    } catch {}
  }
})
</script>

<template>
  <div class="settings-page">
    <h1>⚙️ 设置</h1>

    <!-- Profile -->
    <div class="section">
      <h2>👤 个人信息</h2>
      <div class="profile-row">
        <div class="avatar-picker">
          <button class="avatar-btn" @click="showAvatarPicker = !showAvatarPicker">
            <span class="avatar-emoji">{{ appStore.currentUser?.avatar || '😊' }}</span>
          </button>
          <div v-if="showAvatarPicker" class="avatar-grid">
            <button v-for="emoji in avatarOptions" :key="emoji" class="avatar-option" @click="selectAvatar(emoji)">
              {{ emoji }}
            </button>
          </div>
        </div>
        <div class="profile-info">
          <div class="profile-name">{{ appStore.currentUser?.display_name || '用户' }}</div>
          <div class="profile-username">@{{ appStore.currentUser?.username }}</div>
        </div>
      </div>
    </div>

    <!-- Work Time -->
    <div class="section">
      <h2>⏰ 上下班时间</h2>
      <div class="form-row">
        <div class="form-group">
          <label>上班时间</label>
          <input type="time" v-model="workStart" @change="saveWorkTime" />
        </div>
        <div class="form-group">
          <label>下班时间</label>
          <input type="time" v-model="workEnd" @change="saveWorkTime" />
        </div>
      </div>
    </div>

    <!-- Entry Date -->
    <div class="section">
      <h2>📅 入职日期</h2>
      <p class="section-desc">设置后仪表盘会显示「已当牛马 XX 天」</p>
      <input type="date" v-model="entryDate" @change="saveEntryDate" class="date-input" />
    </div>

    <!-- Hitokoto -->
    <div class="section">
      <h2>💬 一言设置</h2>
      <p class="section-desc">仪表盘欢迎卡片显示的随机句子</p>
      <select v-model="hitokotoCategory" @change="saveHitokotoCategory" class="select-input">
        <option v-for="cat in hitokotoCategories" :key="cat.key" :value="cat.key">{{ cat.label }}</option>
      </select>
    </div>

    <!-- AI Config -->
    <div class="section">
      <h2>🤖 AI 平台配置</h2>
      <div class="provider-tabs">
        <button
          v-for="(_, name) in PROVIDER_NAMES"
          :key="name"
          class="provider-tab"
          :class="{ active: currentProviderName === name }"
          @click="switchProvider(name as string)"
        >
          {{ PROVIDER_NAMES[name as string] }}
        </button>
      </div>
      <div class="form-group">
        <label>API Base</label>
        <input v-model="providerConfig.apiBase" @change="saveProvider" placeholder="https://api.example.com/v1" />
      </div>
      <div class="form-group">
        <label>API Key</label>
        <div class="key-input">
          <input v-model="providerConfig.apiKey" @change="saveProvider" :type="showApiKey ? 'text' : 'password'" placeholder="sk-..." />
          <button class="toggle-key" @click="showApiKey = !showApiKey">{{ showApiKey ? '🙈' : '👁️' }}</button>
        </div>
      </div>
      <div class="form-group">
        <label>模型</label>
        <input v-model="providerConfig.model" @change="saveProvider" placeholder="model-name" />
      </div>
    </div>

    <!-- Search API -->
    <div class="section">
      <h2>🔍 联网搜索</h2>
      <p class="section-desc">配置搜索 API Key 后，AI 搜问可联网搜索。目前支持 Tavily。</p>
      <div class="form-group">
        <label>Search API Key</label>
        <input v-model="searchApiKey" @change="saveSearchApiKey" type="password" placeholder="tvly-..." />
      </div>
    </div>

    <!-- Lock Screen -->
    <div class="section">
      <h2>🔒 口令锁屏</h2>
      <p class="section-desc">设置口令后，每次打开应用需要输入口令才能使用。</p>

      <div v-if="!lockEnabled">
        <button class="btn primary" @click="showChangeLock = true">设置口令</button>
      </div>
      <div v-else>
        <div class="lock-status">
          <span class="status-badge">已启用</span>
          <div class="lock-actions">
            <button class="btn" @click="showChangeLock = true">修改口令</button>
            <button class="btn danger" @click="handleClearLock">取消口令</button>
          </div>
        </div>
      </div>

      <div v-if="showChangeLock" class="lock-form">
        <div class="form-group">
          <label>新口令</label>
          <input v-model="newLockPassword" type="password" placeholder="输入口令（至少4位）" />
        </div>
        <div class="form-group">
          <label>确认口令</label>
          <input v-model="confirmLockPassword" type="password" placeholder="再次输入口令" />
        </div>
        <p v-if="lockError" class="error">{{ lockError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showChangeLock = false; newLockPassword = ''; confirmLockPassword = ''; lockError = ''">取消</button>
          <button class="btn primary" @click="handleSetLock">确认</button>
        </div>
      </div>
    </div>

    <!-- WebDAV Sync -->
    <div class="section">
      <h2>☁️ WebDAV 同步</h2>
      <p class="section-desc">配置 WebDAV 服务器，实现跨设备数据同步。</p>

      <div class="form-group">
        <label>服务器地址</label>
        <input v-model="webdavConfig.server" placeholder="https://dav.example.com" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="webdavConfig.username" placeholder="username" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <div class="key-input">
            <input v-model="webdavConfig.password" :type="showWebdavPassword ? 'text' : 'password'" placeholder="password" />
            <button class="toggle-key" @click="showWebdavPassword = !showWebdavPassword">{{ showWebdavPassword ? '🙈' : '👁️' }}</button>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>目录路径</label>
        <input v-model="webdavConfig.path" placeholder="/desktop-notepad" />
      </div>

      <div class="webdav-actions">
        <button class="btn" @click="handleTestWebdav" :disabled="webdavLoading || !webdavConfig.server">测试连接</button>
        <button class="btn primary" @click="handleWebdavSync" :disabled="webdavLoading || !webdavConfig.server">立即同步</button>
      </div>

      <p v-if="webdavStatus" class="webdav-status">{{ webdavStatus }}</p>

      <div v-if="webdavBackups.length > 0" class="webdav-backups">
        <h4>云端备份</h4>
        <div v-for="backup in webdavBackups" :key="backup" class="backup-item">
          <span class="backup-name">{{ backup }}</span>
          <button class="btn-sm" @click="handleWebdavRestore(backup)" :disabled="webdavLoading">恢复</button>
        </div>
      </div>
    </div>

    <!-- Backup -->
    <div class="section">
      <h2>💾 数据备份</h2>
      <p class="section-desc">导出所有数据为 JSON 文件，或从备份恢复。</p>
      <div class="backup-actions">
        <button class="btn primary" @click="handleExport">📤 导出数据</button>
        <button class="btn" @click="handleImport">📥 导入数据</button>
      </div>
      <p v-if="backupResult" class="backup-result">{{ backupResult }}</p>
    </div>

    <!-- About -->
    <div class="section">
      <h2>ℹ️ 关于</h2>
      <div class="about-info">
        <div class="about-row"><span>应用名称</span><span>Desktop Notepad</span></div>
        <div class="about-row"><span>版本</span><span>v{{ appVersion }}</span></div>
        <div class="about-row"><span>技术栈</span><span>Tauri 2 + Vue 3 + TypeScript</span></div>
        <div class="about-row"><span>数据存储</span><span>本地 SQLite</span></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page { max-width: 700px; margin: 0 auto; }
.settings-page h1 { font-size: 24px; margin-bottom: 24px; }

.section {
  background: var(--bg-primary); border-radius: var(--radius); padding: 24px;
  box-shadow: var(--shadow); margin-bottom: 16px;
}
.section h2 { font-size: 16px; margin-bottom: 12px; }
.section-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }

/* Profile */
.profile-row { display: flex; align-items: center; gap: 16px; }
.avatar-picker { position: relative; }
.avatar-btn {
  width: 64px; height: 64px; border-radius: var(--radius-lg); border: 2px solid var(--border);
  background: var(--bg-secondary); cursor: pointer; font-size: 36px;
  display: flex; align-items: center; justify-content: center; transition: border-color 0.2s;
}
.avatar-btn:hover { border-color: var(--accent); }
.avatar-grid {
  position: absolute; top: 72px; left: 0; background: var(--bg-primary);
  border: 1px solid var(--border); border-radius: var(--radius); padding: 12px;
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
  box-shadow: var(--shadow-md); z-index: 100;
}
.avatar-option {
  width: 40px; height: 40px; border: none; background: var(--bg-secondary);
  border-radius: var(--radius); cursor: pointer; font-size: 24px; transition: all 0.2s;
}
.avatar-option:hover { background: var(--accent); transform: scale(1.1); }

.profile-name { font-size: 18px; font-weight: 600; }
.profile-username { font-size: 13px; color: var(--text-secondary); }

/* Provider tabs */
.provider-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }

.key-input { display: flex; gap: 8px; }
.key-input input { flex: 1; }
.toggle-key {
  padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-secondary); cursor: pointer; font-size: 16px;
}
.provider-tab {
  padding: 8px 14px; border: 1px solid var(--border); background: var(--bg-primary);
  color: var(--text-primary); border-radius: var(--radius); cursor: pointer; font-size: 13px; transition: all 0.2s;
}
.provider-tab:hover { border-color: var(--accent); }
.provider-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

/* Backup */
.backup-actions { display: flex; gap: 12px; }
.backup-result { margin-top: 12px; font-size: 14px; }

/* About */
.about-row {
  display: flex; justify-content: space-between; padding: 10px 0;
  border-bottom: 1px solid var(--border); font-size: 14px;
}
.about-row:last-child { border-bottom: none; }
.about-row span:first-child { color: var(--text-secondary); }

/* Lock screen */
.lock-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-badge {
  background: var(--accent);
  color: #fff;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 13px;
}

.lock-actions {
  display: flex;
  gap: 8px;
}

.lock-form {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin-bottom: 12px;
}

/* WebDAV */
.webdav-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.webdav-status {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.webdav-backups {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.webdav-backups h4 {
  font-size: 14px;
  margin-bottom: 8px;
}

.backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}

.backup-item:last-child {
  border-bottom: none;
}

.backup-name {
  font-size: 13px;
  color: var(--text-primary);
  font-family: 'Menlo', monospace;
}

.logout-section { text-align: center; }
</style>
