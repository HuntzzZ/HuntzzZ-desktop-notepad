<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  unlock: [hash: string]
}>()

const props = defineProps<{
  mode: 'set' | 'verify'
}>()

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const isLoading = ref(false)

async function hashPassword(pwd: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pwd + 'desktop-notepad-lock-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function handleSubmit() {
  error.value = ''
  isLoading.value = true

  try {
    if (props.mode === 'set') {
      if (password.value.length < 4) {
        error.value = '口令至少需要 4 位'
        return
      }
      if (password.value !== confirmPassword.value) {
        error.value = '两次输入的口令不一致'
        return
      }
      const hash = await hashPassword(password.value)
      emit('unlock', hash)
    } else {
      const hash = await hashPassword(password.value)
      emit('unlock', hash)
    }
  } catch {
    error.value = '操作失败'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="lock-screen">
    <div class="lock-card">
      <div class="lock-icon">🔒</div>
      <h2>{{ mode === 'set' ? '设置口令' : '输入口令解锁' }}</h2>
      <p class="lock-desc">{{ mode === 'set' ? '设置一个口令来保护你的数据' : '请输入口令以继续使用' }}</p>

      <form @submit.prevent="handleSubmit" class="lock-form">
        <div class="form-group">
          <input
            v-model="password"
            type="password"
            :placeholder="mode === 'set' ? '输入口令（至少4位）' : '输入口令'"
            autofocus
          />
        </div>
        <div v-if="mode === 'set'" class="form-group">
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="确认口令"
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="btn primary" :disabled="isLoading || !password">
          {{ isLoading ? '处理中...' : (mode === 'set' ? '设置' : '解锁') }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.lock-screen {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(20px);
}

.lock-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: 48px 40px;
  width: 380px;
  max-width: 90vw;
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.lock-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.lock-card h2 {
  font-size: 22px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.lock-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 32px;
}

.lock-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lock-form input {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  font-size: 16px;
  text-align: center;
  letter-spacing: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.lock-form input:focus {
  border-color: var(--accent);
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: 0;
}

.lock-form .btn {
  width: 100%;
  padding: 14px;
  font-size: 16px;
  font-weight: 600;
}
</style>
