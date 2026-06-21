<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  chatStream, getProviderConfig, saveProviderConfig, webSearch,
  PROVIDER_NAMES, type ChatMessage, type AIProvider, type TokenUsage,
} from '../../utils/ai'
import { renderMarkdownSafe } from '../../utils/editor'
import { getDb } from '../../utils/db'
import { useAppStore } from '../../stores'

const appStore = useAppStore()

interface Session {
  id: number; title: string; messages: ChatMessage[]; provider: string; systemPrompt: string; createdAt: string
}

const sessions = ref<Session[]>([])
const currentSession = ref<Session | null>(null)
const userInput = ref('')
const isLoading = ref(false)
const showSettings = ref(false)
const showSystemPrompt = ref(false)
const currentProviderName = ref('mimo')
const providerConfig = ref<AIProvider>(getProviderConfig('mimo'))
const abortController = ref<AbortController | null>(null)
const messagesRef = ref<HTMLElement | null>(null)
const lastUsage = ref<TokenUsage | null>(null)
const enableWebSearch = ref(false)
const enableLocalSearch = ref(false)

const currentMessages = computed(() => currentSession.value?.messages || [])

async function createSession() {
  const db = await getDb()
  const result = await db.execute(
    'INSERT INTO ai_sessions (title, messages, provider, system_prompt, user_id) VALUES ($1, $2, $3, $4, $5)',
    ['新对话', '[]', currentProviderName.value, '', appStore.currentUser?.id || 1],
  )
  const session: Session = {
    id: result.lastInsertId as number, title: '新对话', messages: [],
    provider: currentProviderName.value, systemPrompt: '', createdAt: new Date().toISOString(),
  }
  sessions.value.unshift(session)
  currentSession.value = session
}

function selectSession(session: Session) {
  currentSession.value = session
  currentProviderName.value = session.provider
  providerConfig.value = getProviderConfig(session.provider)
}

async function deleteSession(id: number) {
  const db = await getDb()
  await db.execute('DELETE FROM ai_sessions WHERE id = $1', [id])
  sessions.value = sessions.value.filter(s => s.id !== id)
  if (currentSession.value?.id === id) currentSession.value = sessions.value[0] || null
}

async function saveCurrentSession() {
  if (!currentSession.value) return
  const db = await getDb()
  await db.execute(
    'UPDATE ai_sessions SET title = $1, messages = $2, provider = $3, system_prompt = $4, updated_at = datetime("now") WHERE id = $5',
    [currentSession.value.title, JSON.stringify(currentSession.value.messages), currentSession.value.provider, currentSession.value.systemPrompt, currentSession.value.id],
  )
}

async function searchLocalData(query: string): Promise<string> {
  const db = await getDb()
  const userId = appStore.currentUser?.id || 1
  const results: string[] = []

  // Search tasks
  const tasks = await db.select<{ title: string; status: string; date: string; tag: string }[]>(
    "SELECT title, status, date, tag FROM tasks WHERE user_id = $1 AND (title LIKE $2 OR description LIKE $2) LIMIT 10",
    [userId, `%${query}%`],
  )
  if (tasks.length > 0) {
    results.push('**相关任务：**')
    for (const t of tasks) {
      results.push(`- [${t.status === 'done' ? '✅' : '⏳'}] ${t.title} (${t.date}, ${t.tag})`)
    }
  }

  // Search personal cards
  const cards = await db.select<{ title: string; category: string; content: string }[]>(
    "SELECT title, category, content FROM personal_cards WHERE user_id = $1 AND (title LIKE $2 OR content LIKE $2) AND is_sensitive = 0 LIMIT 5",
    [userId, `%${query}%`],
  )
  if (cards.length > 0) {
    results.push('\n**相关信息：**')
    for (const c of cards) {
      results.push(`- [${c.category}] ${c.title}: ${c.content.slice(0, 100)}`)
    }
  }

  return results.length > 0 ? results.join('\n') : ''
}

async function sendMessage() {
  if (!userInput.value.trim() || isLoading.value) return
  if (!currentSession.value) await createSession()

  const userMsg: ChatMessage = { role: 'user', content: userInput.value.trim() }
  currentSession.value!.messages.push(userMsg)
  if (currentSession.value!.messages.filter(m => m.role === 'user').length === 1) {
    currentSession.value!.title = userMsg.content.slice(0, 30)
  }

  const query = userInput.value.trim()
  userInput.value = ''
  isLoading.value = true
  lastUsage.value = null

  // Build context with search results
  let contextPrefix = ''
  if (enableLocalSearch.value) {
    const localResults = await searchLocalData(query)
    if (localResults) contextPrefix += `[本地数据搜索结果]\n${localResults}\n\n`
  }
  if (enableWebSearch.value) {
    const searchApiKey = localStorage.getItem('search-api-key')
    if (searchApiKey) {
      const webResults = await webSearch(query, searchApiKey)
      if (webResults) contextPrefix += `[联网搜索结果]\n${webResults}\n\n`
    }
  }

  const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
  currentSession.value!.messages.push(assistantMsg)

  abortController.value = new AbortController()

  // Build messages with context
  const messagesToSend = currentSession.value!.messages.slice(0, -1)
  if (contextPrefix) {
    // Add context as a system-like message before the user's question
    const lastUserIdx = messagesToSend.length - 1
    messagesToSend[lastUserIdx] = {
      role: 'user',
      content: `${contextPrefix}用户问题：${query}`,
    }
  }

  try {
    await chatStream(
      providerConfig.value, messagesToSend,
      (chunk) => { assistantMsg.content += chunk; nextTick(() => scrollToBottom()) },
      (usage) => { isLoading.value = false; lastUsage.value = usage || null; saveCurrentSession() },
      abortController.value.signal,
      { systemPrompt: currentSession.value!.systemPrompt },
    )
  } catch (err: unknown) {
    if (err instanceof Error && err.name !== 'AbortError') {
      assistantMsg.content = `❌ 错误: ${err.message}`
    }
    isLoading.value = false
  }
}

function stopGeneration() { abortController.value?.abort(); isLoading.value = false }

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
}

function switchProvider(name: string) {
  currentProviderName.value = name
  providerConfig.value = getProviderConfig(name)
  if (currentSession.value) currentSession.value.provider = name
}

function saveProviderSettings() { saveProviderConfig(providerConfig.value); showSettings.value = false }

function renderMd(text: string): string { return renderMarkdownSafe(text) }

function scrollToBottom() { if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight }

function exportChat() {
  if (!currentSession.value) return
  const lines = currentSession.value.messages.map(m => {
    const role = m.role === 'user' ? '👤 用户' : '🤖 AI'
    return `### ${role}\n\n${m.content}\n`
  })
  const md = `# ${currentSession.value.title}\n\n${lines.join('\n---\n\n')}`
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${currentSession.value.title.slice(0, 20)}.md`; a.click()
  URL.revokeObjectURL(url)
}

async function loadSessions() {
  try {
    const db = await getDb()
    const userId = appStore.currentUser?.id || 1
    const rows = await db.select<{ id: number; title: string; messages: string; provider: string; system_prompt: string; created_at: string }[]>(
      'SELECT * FROM ai_sessions WHERE user_id = $1 ORDER BY updated_at DESC', [userId],
    )
    sessions.value = rows.map(r => ({
      id: r.id, title: r.title, messages: JSON.parse(r.messages || '[]'),
      provider: r.provider, systemPrompt: r.system_prompt || '', createdAt: r.created_at,
    }))
    if (sessions.value.length > 0) {
      currentSession.value = sessions.value[0]
      currentProviderName.value = currentSession.value.provider
      providerConfig.value = getProviderConfig(currentSession.value.provider)
    }
  } catch { /* empty */ }
}

onMounted(loadSessions)
</script>

<template>
  <div class="ai-search">
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>🤖 AI 搜问</h2>
        <button class="new-chat-btn" @click="createSession">+ 新对话</button>
      </div>
      <div class="provider-tabs">
        <button v-for="(_, name) in PROVIDER_NAMES" :key="name" class="provider-tab"
          :class="{ active: currentProviderName === name }" @click="switchProvider(name as string)">
          {{ PROVIDER_NAMES[name as string] }}
        </button>
      </div>
      <div class="session-list">
        <div v-for="session in sessions" :key="session.id" class="session-item"
          :class="{ active: currentSession?.id === session.id }" @click="selectSession(session)">
          <span class="session-title">{{ session.title }}</span>
          <button class="delete-btn" @click.stop="deleteSession(session.id)">×</button>
        </div>
        <p v-if="sessions.length === 0" class="empty">暂无对话</p>
      </div>
      <div class="sidebar-footer">
        <button class="footer-btn" @click="exportChat" title="导出对话">📤</button>
        <button class="footer-btn" @click="showSettings = true" title="设置">⚙️</button>
      </div>
    </div>

    <div class="chat-area">
      <div class="chat-header" v-if="currentSession">
        <div class="chat-header-left">
          <button class="icon-btn" @click="showSystemPrompt = !showSystemPrompt" title="系统提示词">📝</button>
          <label class="search-toggle">
            <input type="checkbox" v-model="enableWebSearch" />
            <span>🌐 联网</span>
          </label>
          <label class="search-toggle">
            <input type="checkbox" v-model="enableLocalSearch" />
            <span>💾 本地</span>
          </label>
        </div>
        <div class="chat-header-right">
          <span class="provider-badge">{{ PROVIDER_NAMES[currentProviderName] }}</span>
        </div>
      </div>

      <div v-if="showSystemPrompt && currentSession" class="system-prompt-panel">
        <label>系统提示词</label>
        <textarea v-model="currentSession.systemPrompt" placeholder="定义 AI 行为方式..." rows="3" @blur="saveCurrentSession"></textarea>
      </div>

      <div class="messages" ref="messagesRef">
        <div v-if="currentMessages.length === 0" class="welcome">
          <div class="welcome-icon">🤖</div>
          <h3>AI 搜问助手</h3>
          <p>支持 MiMo、DeepSeek、硅基流动、OpenRouter</p>
          <p class="hint">开启「联网」可搜索网络，开启「本地」可搜索你的数据</p>
        </div>
        <div v-for="(msg, i) in currentMessages" :key="i" class="message" :class="msg.role">
          <div class="message-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
          <div class="message-content" v-html="renderMd(msg.content)"></div>
        </div>
        <div v-if="isLoading" class="message assistant">
          <div class="message-avatar">🤖</div>
          <div class="message-content loading">思考中...</div>
        </div>
      </div>

      <div v-if="lastUsage" class="usage-bar">
        <span>📊 Token：提示 {{ lastUsage.promptTokens }} · 生成 {{ lastUsage.completionTokens }} · 共 {{ lastUsage.totalTokens }}</span>
      </div>

      <div class="input-area">
        <textarea v-model="userInput" @keydown="handleKeydown" placeholder="输入消息... (Enter 发送, Shift+Enter 换行)" rows="3"></textarea>
        <div class="input-actions">
          <span class="input-hint">Enter 发送 · Shift+Enter 换行</span>
          <div>
            <button v-if="isLoading" class="stop-btn" @click="stopGeneration">⏹ 停止</button>
            <button v-else class="send-btn" @click="sendMessage" :disabled="!userInput.trim()">发送</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSettings" class="modal-overlay" @click.self="showSettings = false">
      <div class="modal">
        <h3>AI 设置</h3>
        <div class="form-group">
          <label>平台</label>
          <select v-model="providerConfig.name" @change="providerConfig = getProviderConfig(providerConfig.name)">
            <option v-for="(_, name) in PROVIDER_NAMES" :key="name" :value="name">{{ PROVIDER_NAMES[name as string] }}</option>
          </select>
        </div>
        <div class="form-group"><label>API Base</label><input v-model="providerConfig.apiBase" /></div>
        <div class="form-group"><label>API Key</label><input v-model="providerConfig.apiKey" type="password" placeholder="sk-..." /></div>
        <div class="form-group"><label>模型</label><input v-model="providerConfig.model" /></div>
        <div class="modal-actions">
          <button class="btn" @click="showSettings = false">取消</button>
          <button class="btn primary" @click="saveProviderSettings">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-search { display: flex; height: 100%; gap: 0; margin: -24px; }

.sidebar { width: 240px; min-width: 240px; background: var(--bg-sidebar); display: flex; flex-direction: column; color: var(--text-sidebar); }
.sidebar-header { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.sidebar-header h2 { font-size: 16px; margin-bottom: 10px; color: #fff; }
.new-chat-btn { width: 100%; padding: 10px; border: 1px solid rgba(255,255,255,0.15); background: none; color: var(--text-sidebar); border-radius: var(--radius); cursor: pointer; font-size: 13px; transition: all 0.2s; }
.new-chat-btn:hover { background: var(--bg-sidebar-hover); color: #fff; }

.provider-tabs { display: flex; padding: 8px; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap; }
.provider-tab { flex: 1; padding: 6px 4px; border: none; background: none; color: rgba(255,255,255,0.5); font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); opacity: 0.7; transition: all 0.2s; min-width: 40px; }
.provider-tab.active { background: var(--accent-bg); opacity: 1; color: var(--accent); }

.session-list { flex: 1; overflow-y: auto; padding: 8px; }
.session-item { display: flex; align-items: center; padding: 10px; border-radius: var(--radius); cursor: pointer; margin-bottom: 2px; transition: background 0.2s; }
.session-item:hover { background: var(--bg-sidebar-hover); }
.session-item.active { background: var(--bg-sidebar-active); }
.session-title { flex: 1; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.delete-btn { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 16px; opacity: 0; transition: all 0.2s; }
.session-item:hover .delete-btn { opacity: 0.6; }
.delete-btn:hover { opacity: 1; color: var(--danger); }

.empty { text-align: center; padding: 20px; font-size: 13px; opacity: 0.5; }

.sidebar-footer { padding: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; gap: 8px; justify-content: center; }
.footer-btn { padding: 6px 12px; border: 1px solid rgba(255,255,255,0.12); background: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 14px; border-radius: var(--radius); transition: all 0.2s; }
.footer-btn:hover { background: var(--bg-sidebar-hover); color: #fff; }

.chat-area { flex: 1; display: flex; flex-direction: column; background: var(--bg-secondary); }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-primary); }
.chat-header-left, .chat-header-right { display: flex; gap: 8px; align-items: center; }

.search-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); cursor: pointer; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius); transition: all 0.2s; }
.search-toggle:hover { border-color: var(--accent); }
.search-toggle input { width: auto; margin: 0; }

.provider-badge { font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full); background: var(--accent); color: #fff; }

.system-prompt-panel { padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--bg-primary); }
.system-prompt-panel label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
.system-prompt-panel textarea { width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-secondary); color: var(--text-primary); font-size: 13px; resize: vertical; outline: none; font-family: inherit; box-sizing: border-box; }
.system-prompt-panel textarea:focus { border-color: var(--accent); }

.messages { flex: 1; overflow-y: auto; padding: 20px; }
.welcome { text-align: center; padding: 60px 20px; }
.welcome-icon { font-size: 48px; margin-bottom: 12px; }
.welcome h3 { font-size: 20px; margin-bottom: 8px; }
.welcome p { color: var(--text-secondary); font-size: 14px; }
.welcome .hint { margin-top: 12px; color: var(--accent); }

.message { display: flex; gap: 12px; margin-bottom: 16px; max-width: 800px; }
.message.user { flex-direction: row-reverse; margin-left: auto; }
.message-avatar { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.message-content { padding: 12px 16px; border-radius: var(--radius); font-size: 14px; line-height: 1.7; max-width: 100%; overflow-wrap: break-word; }
.message.user .message-content { background: var(--accent); color: #fff; border-top-right-radius: var(--radius-sm); }
.message.assistant .message-content { background: var(--bg-primary); border: 1px solid var(--border); border-top-left-radius: var(--radius-sm); }
.message-content.loading { color: var(--text-secondary); animation: pulse 1.5s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.message-content :deep(pre) { background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: var(--radius); overflow-x: auto; margin: 8px 0; }
.message-content :deep(code) { background: var(--bg-secondary); padding: 2px 4px; border-radius: 3px; font-size: 13px; font-family: 'Menlo', monospace; }
.message-content :deep(pre code) { background: none; padding: 0; }
.message-content :deep(p) { margin: 6px 0; }
.message-content :deep(ul), .message-content :deep(ol) { padding-left: 20px; margin: 6px 0; }

.usage-bar { padding: 4px 16px; font-size: 11px; color: var(--text-secondary); border-top: 1px solid var(--border); background: var(--bg-primary); }

.input-area { padding: 16px 20px; border-top: 1px solid var(--border); background: var(--bg-primary); }
.input-area textarea { width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-secondary); color: var(--text-primary); font-size: 14px; resize: none; outline: none; font-family: inherit; box-sizing: border-box; }
.input-area textarea:focus { border-color: var(--accent); }
.input-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.input-hint { font-size: 11px; color: var(--text-secondary); }
.send-btn, .stop-btn { padding: 8px 20px; border: none; border-radius: var(--radius); cursor: pointer; font-size: 13px; }
.send-btn { background: var(--accent); color: #fff; }
.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.stop-btn { background: var(--danger); color: #fff; }
</style>
