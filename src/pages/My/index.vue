<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getPersonalCards, savePersonalCard, deletePersonalCard, type PersonalCard } from '../../utils/db'
import { useAppStore } from '../../stores'

const appStore = useAppStore()
const cards = ref<PersonalCard[]>([])
const selectedCategory = ref('全部')
const searchQuery = ref('')
const showAddModal = ref(false)
const editingCard = ref<PersonalCard | null>(null)
const showPasscodeModal = ref(false)
const passcodeInput = ref('')
const passcodeError = ref('')
const revealedCardId = ref<number | null>(null)

// Passcode stored in localStorage (simple protection for local app)
const PASSCODE_KEY = 'personal-passcode'

const categories = [
  { key: '全部', icon: '📋', label: '全部' },
  { key: '地址', icon: '🏠', label: '地址' },
  { key: '银行卡', icon: '💳', label: '银行卡' },
  { key: '证件', icon: '🪪', label: '证件' },
  { key: '常用信息', icon: '📌', label: '常用信息' },
  { key: '自定义', icon: '🔧', label: '自定义' },
]

const newCard = ref<PersonalCard>({
  user_id: appStore.currentUser?.id || 1,
  category: '常用信息',
  title: '',
  content: '',
  is_sensitive: 0,
  icon: '📌',
  sort_order: 0,
})

const hasPasscode = computed(() => !!localStorage.getItem(PASSCODE_KEY))

const filteredCards = computed(() => {
  let result = cards.value
  if (selectedCategory.value !== '全部') {
    result = result.filter(c => c.category === selectedCategory.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(c => c.title.toLowerCase().includes(q) || c.content.toLowerCase().includes(q))
  }
  return result
})

function setPasscode() {
  if (passcodeInput.value.length < 4) {
    passcodeError.value = '口令至少4位'
    return
  }
  localStorage.setItem(PASSCODE_KEY, passcodeInput.value)
  passcodeInput.value = ''
  passcodeError.value = ''
  showPasscodeModal.value = false
}

function requestReveal(card: PersonalCard) {
  if (!card.is_sensitive) return
  if (revealedCardId.value === card.id) {
    revealedCardId.value = null
    return
  }
  passcodeInput.value = ''
  passcodeError.value = ''
  showPasscodeModal.value = true
}

function handlePasscodeSubmit() {
  const stored = localStorage.getItem(PASSCODE_KEY)
  if (!stored) {
    setPasscode()
    return
  }
  if (passcodeInput.value === stored) {
    // Find the next sensitive card to reveal
    const sensitiveCards = filteredCards.value.filter(c => c.is_sensitive)
    if (sensitiveCards.length > 0) {
      revealedCardId.value = sensitiveCards[0].id!
    }
    passcodeInput.value = ''
    passcodeError.value = ''
    showPasscodeModal.value = false
  } else {
    passcodeError.value = '口令错误'
  }
}

function maskContent(content: string): string {
  if (content.length <= 4) return '****'
  return content.slice(0, 2) + '*'.repeat(content.length - 4) + content.slice(-2)
}

function copyContent(content: string) {
  navigator.clipboard.writeText(content)
}

function openAddModal() {
  editingCard.value = null
  newCard.value = {
    user_id: appStore.currentUser?.id || 1,
    category: selectedCategory.value === '全部' ? '常用信息' : selectedCategory.value,
    title: '', content: '', is_sensitive: 0, icon: '📌', sort_order: 0,
  }
  showAddModal.value = true
}

function openEditModal(card: PersonalCard) {
  editingCard.value = card
  newCard.value = { ...card }
  showAddModal.value = true
}

async function saveCard() {
  if (!newCard.value.title.trim() || !newCard.value.content.trim()) return
  await savePersonalCard(newCard.value)
  showAddModal.value = false
  await loadCards()
}

async function removeCard(id: number) {
  await deletePersonalCard(id)
  if (revealedCardId.value === id) revealedCardId.value = null
  await loadCards()
}

async function loadCards() {
  const userId = appStore.currentUser?.id || 1
  cards.value = await getPersonalCards(userId)
}

function getCategoryIcon(category: string): string {
  return categories.find(c => c.key === category)?.icon || '📌'
}

onMounted(loadCards)
</script>

<template>
  <div class="my-page">
    <div class="header">
      <h1>👤 我的</h1>
      <div class="header-actions">
        <button v-if="hasPasscode" class="btn-sm" @click="showPasscodeModal = true">🔑 修改口令</button>
        <button class="btn primary" @click="openAddModal">+ 新增</button>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="category-tabs">
      <button
        v-for="cat in categories"
        :key="cat.key"
        class="cat-tab"
        :class="{ active: selectedCategory === cat.key }"
        @click="selectedCategory = cat.key"
      >
        {{ cat.icon }} {{ cat.label }}
      </button>
    </div>

    <!-- Search -->
    <div class="search-bar">
      <input v-model="searchQuery" placeholder="🔍 搜索卡片..." class="search-input" />
      <span class="card-count">共 {{ filteredCards.length }} 张</span>
    </div>

    <!-- Cards Grid -->
    <div class="cards-grid">
      <div v-for="card in filteredCards" :key="card.id" class="card-item" :class="{ sensitive: card.is_sensitive }">
        <div class="card-header">
          <span class="card-icon">{{ card.icon || getCategoryIcon(card.category) }}</span>
          <span class="card-category">{{ card.category }}</span>
          <div class="card-actions">
            <button class="action-icon" @click="copyContent(card.is_sensitive && revealedCardId !== card.id ? maskContent(card.content) : card.content)" title="复制">📋</button>
            <button class="action-icon" @click="openEditModal(card)" title="编辑">✏️</button>
            <button class="action-icon danger" @click="removeCard(card.id!)" title="删除">🗑️</button>
          </div>
        </div>
        <h3 class="card-title">{{ card.title }}</h3>
        <div class="card-content">
          <template v-if="card.is_sensitive && revealedCardId !== card.id">
            <span class="masked">{{ maskContent(card.content) }}</span>
            <button class="reveal-btn" @click="requestReveal(card)">👁️ 查看</button>
          </template>
          <template v-else>
            <span class="revealed">{{ card.content }}</span>
            <button v-if="card.is_sensitive" class="reveal-btn" @click="revealedCardId = null">🔒 隐藏</button>
          </template>
        </div>
      </div>

      <div v-if="filteredCards.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p>还没有卡片，点击右上角新增</p>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>{{ editingCard ? '编辑卡片' : '新增卡片' }}</h3>
        <div class="form-group">
          <label>标题</label>
          <input v-model="newCard.title" placeholder="如：家庭住址、招商银行卡" />
        </div>
        <div class="form-group">
          <label>内容</label>
          <textarea v-model="newCard.content" placeholder="详细内容..." rows="4"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>分类</label>
            <select v-model="newCard.category">
              <option v-for="cat in categories.filter(c => c.key !== '全部')" :key="cat.key" :value="cat.key">
                {{ cat.icon }} {{ cat.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>图标</label>
            <select v-model="newCard.icon">
              <option value="📌">📌</option>
              <option value="🏠">🏠</option>
              <option value="💳">💳</option>
              <option value="🪪">🪪</option>
              <option value="📧">📧</option>
              <option value="📱">📱</option>
              <option value="🔗">🔗</option>
              <option value="📎">📎</option>
              <option value="🏷️">🏷️</option>
              <option value="⭐">⭐</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="newCard.is_sensitive" :true-value="1" :false-value="0" />
            🔒 敏感信息（需口令查看）
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showAddModal = false">取消</button>
          <button class="btn primary" @click="saveCard" :disabled="!newCard.title.trim() || !newCard.content.trim()">保存</button>
        </div>
      </div>
    </div>

    <!-- Passcode Modal -->
    <div v-if="showPasscodeModal" class="modal-overlay" @click.self="showPasscodeModal = false">
      <div class="modal passcode-modal">
        <h3>{{ hasPasscode ? '🔑 输入口令' : '🔑 设置口令' }}</h3>
        <p class="passcode-hint">{{ hasPasscode ? '输入口令以查看敏感信息' : '首次使用请设置口令（至少4位）' }}</p>
        <input
          v-model="passcodeInput"
          type="password"
          placeholder="输入口令..."
          maxlength="20"
          @keydown.enter="handlePasscodeSubmit"
          class="passcode-input"
        />
        <p v-if="passcodeError" class="passcode-error">{{ passcodeError }}</p>
        <div class="modal-actions">
          <button class="btn" @click="showPasscodeModal = false; passcodeInput = ''; passcodeError = ''">取消</button>
          <button class="btn primary" @click="handlePasscodeSubmit">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-page { max-width: 960px; margin: 0 auto; }

.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.header h1 { font-size: 24px; }
.header-actions { display: flex; gap: 8px; }

.category-tabs {
  display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;
}

.cat-tab {
  padding: 8px 16px; border: 1px solid var(--border); background: var(--bg-primary);
  color: var(--text-primary); border-radius: var(--radius-full); cursor: pointer; font-size: 13px; transition: all 0.2s;
}
.cat-tab:hover { border-color: var(--accent); }
.cat-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.search-bar {
  display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
}

.search-input {
  flex: 1; padding: 10px 16px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-primary); color: var(--text-primary); font-size: 14px; outline: none;
}
.search-input:focus { border-color: var(--accent); }

.card-count { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }

.cards-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;
}

.card-item {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  transition: all 0.2s;
}
.card-item:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.card-item.sensitive { border-left: 3px solid var(--danger); }

.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.card-icon { font-size: 20px; }
.card-category { font-size: 11px; color: var(--text-secondary); background: var(--bg-secondary); padding: 2px 8px; border-radius: var(--radius-full); }
.card-actions { margin-left: auto; display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; }
.card-item:hover .card-actions { opacity: 1; }

.action-icon {
  background: none; border: none; cursor: pointer; font-size: 14px; padding: 4px; border-radius: var(--radius-sm);
  transition: background 0.2s;
}
.action-icon:hover { background: var(--bg-secondary); }
.action-icon.danger:hover { background: #fff1f0; }

.card-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; }

.card-content { display: flex; align-items: center; gap: 8px; }
.masked { font-size: 14px; color: var(--text-secondary); letter-spacing: 2px; flex: 1; }
.revealed { font-size: 14px; color: var(--text-primary); flex: 1; word-break: break-all; }
.reveal-btn {
  background: none; border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 4px 8px; cursor: pointer; font-size: 12px; white-space: nowrap;
  transition: all 0.2s;
}
.reveal-btn:hover { border-color: var(--accent); }

.empty-state { grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-secondary); }
.empty-icon { font-size: 48px; margin-bottom: 12px; }

.passcode-modal { width: 360px; text-align: center; }
.passcode-hint { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
.passcode-input {
  width: 100%; padding: 14px; border: 2px solid var(--border); border-radius: var(--radius);
  background: var(--bg-secondary); color: var(--text-primary); font-size: 18px;
  text-align: center; letter-spacing: 8px; outline: none; box-sizing: border-box;
}
.passcode-input:focus { border-color: var(--accent); }
.passcode-error { color: var(--danger); font-size: 13px; margin-top: 8px; }
</style>
