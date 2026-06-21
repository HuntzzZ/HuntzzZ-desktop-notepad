<script setup lang="ts">
import { ref } from 'vue'
import { registerUser, loginUser } from '../../utils/db'
import { useAppStore } from '../../stores'

const appStore = useAppStore()
const mode = ref<'login' | 'register'>('login')
const username = ref('')
const password = ref('')
const displayName = ref('')
const errorMsg = ref('')
const isLoading = ref(false)

async function handleSubmit() {
  errorMsg.value = ''
  isLoading.value = true
  try {
    if (mode.value === 'register') {
      if (!username.value.trim() || !password.value.trim() || !displayName.value.trim()) {
        errorMsg.value = '请填写所有字段'
        return
      }
      const user = await registerUser(username.value, password.value, displayName.value)
      localStorage.setItem('currentUserId', String(user.id))
      await appStore.init(user)
    } else {
      if (!username.value.trim() || !password.value.trim()) {
        errorMsg.value = '请输入用户名和密码'
        return
      }
      const user = await loginUser(username.value, password.value)
      if (!user) {
        errorMsg.value = '用户名或密码错误'
        return
      }
      localStorage.setItem('currentUserId', String(user.id))
      await appStore.init(user)
    }
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '操作失败'
  } finally {
    isLoading.value = false
  }
}

function switchMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  errorMsg.value = ''
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">📝</div>
        <h1>Desktop Notepad</h1>
        <p class="subtitle">{{ mode === 'login' ? '欢迎回来' : '创建账号' }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div class="form-group">
          <label>👤 用户名</label>
          <input v-model="username" placeholder="输入用户名" autocomplete="username" />
        </div>
        <div v-if="mode === 'register'" class="form-group">
          <label>✨ 显示名称</label>
          <input v-model="displayName" placeholder="你的昵称" />
        </div>
        <div class="form-group">
          <label>🔒 密码</label>
          <input v-model="password" type="password" placeholder="输入密码" autocomplete="current-password" />
        </div>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '处理中...' : (mode === 'login' ? '登 录' : '注 册') }}
        </button>
      </form>

      <div class="switch-mode">
        <span>{{ mode === 'login' ? '没有账号？' : '已有账号？' }}</span>
        <button @click="switchMode">{{ mode === 'login' ? '立即注册' : '去登录' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  padding: 48px 40px;
  width: 400px;
  max-width: 90vw;
  box-shadow: var(--shadow-lg);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  font-size: 48px;
  margin-bottom: 8px;
}

.login-header h1 {
  font-size: 24px;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 14px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #667eea;
  background: var(--bg-primary);
}

.error {
  color: var(--danger);
  font-size: 13px;
  text-align: center;
  margin: 0;
}

.submit-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 8px;
}

.submit-btn:hover { opacity: 0.9; }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.switch-mode {
  text-align: center;
  margin-top: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.switch-mode button {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  margin-left: 4px;
}

.switch-mode button:hover { text-decoration: underline; }
</style>
