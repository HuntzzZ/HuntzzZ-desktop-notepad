<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getDb } from '../../utils/db'
import { formatDate, TASK_STATUS_MAP, type Task } from '../../utils/task'
import { useAppStore } from '../../stores'
import YearHeatmap from '../../components/YearHeatmap.vue'

const router = useRouter()
const appStore = useAppStore()
const tasks = ref<Task[]>([])
const today = formatDate(new Date())
const currentTime = ref(new Date().toLocaleTimeString('zh-CN'))
const hitokotoText = ref('')
const hitokotoFrom = ref('')

// Update clock
setInterval(() => { currentTime.value = new Date().toLocaleTimeString('zh-CN') }, 1000)

// Work days counter
const workDays = computed(() => {
  const entryDate = appStore.currentUser?.entry_date
  if (!entryDate) return null
  const start = new Date(entryDate)
  const now = new Date()
  const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  return diff
})

// Greeting
const greeting = computed(() => {
  const hour = new Date().getHours()
  const name = appStore.currentUser?.display_name || '朋友'
  if (hour < 6) return `🌙 夜深了，${name}`
  if (hour < 9) return `🌅 早上好，${name}`
  if (hour < 12) return `☀️ 上午好，${name}`
  if (hour < 14) return `🍚 中午好，${name}`
  if (hour < 18) return `🌤️ 下午好，${name}`
  if (hour < 22) return `🌆 晚上好，${name}`
  return `🌙 夜深了，${name}`
})

// Stats
const todayTasks = computed(() => tasks.value.filter(t => t.date === today))
const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending'))
const doneTasks = computed(() => tasks.value.filter(t => t.status === 'done'))
const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress'))
const weekDoneCount = computed(() => {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  return tasks.value.filter(t => t.status === 'done' && new Date(t.date) >= weekStart).length
})

// Commute
const commuteProgress = computed(() => {
  const now = new Date()
  const start = appStore.currentUser?.work_start_time || '09:00'
  const end = appStore.currentUser?.work_end_time || '18:00'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (nowMin < startMin) return { type: 'before', label: '距上班', percent: 0, remaining: startMin - nowMin }
  if (nowMin < endMin) {
    const total = endMin - startMin
    const elapsed = nowMin - startMin
    return { type: 'work', label: '工作中', percent: Math.round((elapsed / total) * 100), remaining: endMin - nowMin }
  }
  return { type: 'after', label: '已下班', percent: 100, remaining: 0 }
})

// Weekly chart
const weeklyStats = computed(() => {
  const stats: { label: string; done: number; total: number }[] = []
  const now = new Date()
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i)
    const dateStr = formatDate(d)
    const dayTasks = tasks.value.filter(t => t.date === dateStr)
    stats.push({ label: weekDays[d.getDay()], done: dayTasks.filter(t => t.status === 'done').length, total: dayTasks.length })
  }
  return stats
})
const maxWeeklyTotal = computed(() => Math.max(...weeklyStats.value.map(s => s.total), 1))

// Hitokoto
async function fetchHitokoto() {
  try {
    const res = await fetch('https://v1.hitokoto.cn/')
    const data = await res.json()
    hitokotoText.value = data.hitokoto || ''
    hitokotoFrom.value = data.from || ''
  } catch {
    hitokotoText.value = '每一个不曾起舞的日子，都是对生命的辜负。'
    hitokotoFrom.value = '尼采'
  }
}

// Quick actions
const quickActions = [
  { icon: '📋', label: '新建任务', path: '/work-task' },
  { icon: '✏️', label: '公众号编辑', path: '/wechat-editor' },
  { icon: '🤖', label: 'AI 对话', path: '/ai-search' },
  { icon: '👤', label: '我的', path: '/my' },
]

async function loadTasks() {
  const db = await getDb()
  const userId = appStore.currentUser?.id || 1
  tasks.value = await db.select<Task[]>('SELECT * FROM tasks WHERE user_id = $1 ORDER BY date DESC', [userId])
}

onMounted(() => {
  loadTasks()
  fetchHitokoto()
})
</script>

<template>
  <div class="dashboard">
    <!-- Welcome Card -->
    <div class="welcome-card">
      <div class="welcome-left">
        <div class="welcome-avatar">
          <span class="avatar-emoji">{{ appStore.currentUser?.avatar || '😊' }}</span>
        </div>
        <div class="welcome-info">
          <h1>{{ greeting }}</h1>
          <p class="hitokoto" v-if="hitokotoText">「{{ hitokotoText }}」<span v-if="hitokotoFrom">—— {{ hitokotoFrom }}</span></p>
          <div class="welcome-meta">
            <span class="date">{{ today }} {{ currentTime }}</span>
            <span v-if="workDays !== null" class="work-days">🐴 已当牛马 <strong>{{ workDays }}</strong> 天</span>
          </div>
        </div>
      </div>
      <button class="refresh-quote" @click="fetchHitokoto" title="换一句">🔄</button>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions">
      <button v-for="action in quickActions" :key="action.path" class="quick-btn" @click="router.push(action.path)">
        <span class="quick-icon">{{ action.icon }}</span>
        <span class="quick-label">{{ action.label }}</span>
      </button>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card stat-total">
        <div class="stat-icon">📊</div>
        <div class="stat-number">{{ todayTasks.length }}</div>
        <div class="stat-label">今日任务</div>
      </div>
      <div class="stat-card stat-pending">
        <div class="stat-icon">⏳</div>
        <div class="stat-number">{{ pendingTasks.length }}</div>
        <div class="stat-label">待办</div>
      </div>
      <div class="stat-card stat-progress">
        <div class="stat-icon">🔄</div>
        <div class="stat-number">{{ inProgressTasks.length }}</div>
        <div class="stat-label">进行中</div>
      </div>
      <div class="stat-card stat-done">
        <div class="stat-icon">✅</div>
        <div class="stat-number">{{ doneTasks.length }}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card stat-week">
        <div class="stat-icon">📈</div>
        <div class="stat-number">{{ weekDoneCount }}</div>
        <div class="stat-label">本周完成</div>
      </div>
    </div>

    <!-- Commute -->
    <div class="section">
      <div class="section-header">
        <h2>⏰ {{ commuteProgress.label }}</h2>
        <span class="time-range">{{ appStore.currentUser?.work_start_time || '09:00' }} - {{ appStore.currentUser?.work_end_time || '18:00' }}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: commuteProgress.percent + '%' }"></div>
      </div>
      <p class="progress-text" v-if="commuteProgress.remaining > 0">
        还剩 {{ Math.floor(commuteProgress.remaining / 60) }} 小时 {{ commuteProgress.remaining % 60 }} 分钟
      </p>
      <p class="progress-text" v-else-if="commuteProgress.type === 'after'">辛苦了，今天！🎉</p>
    </div>

    <!-- Weekly Chart -->
    <div class="section">
      <h2>📈 本周产出</h2>
      <div class="chart">
        <div v-for="(day, i) in weeklyStats" :key="i" class="chart-bar-group">
          <div class="chart-bar-wrap">
            <div class="chart-bar" :style="{ height: (day.total / maxWeeklyTotal) * 100 + '%' }">
              <div class="chart-bar-done" :style="{ height: day.total > 0 ? (day.done / day.total) * 100 + '%' : '0%' }"></div>
            </div>
          </div>
          <div class="chart-label">{{ day.label }}</div>
          <div class="chart-value">{{ day.done }}/{{ day.total }}</div>
        </div>
      </div>
    </div>

    <!-- Year Heatmap -->
    <div class="section">
      <YearHeatmap :tasks="tasks" />
    </div>

    <!-- Recent Tasks -->
    <div class="section">
      <h2>📋 最近任务</h2>
      <div class="task-list">
        <div v-for="task in tasks.slice(0, 5)" :key="task.id" class="task-item">
          <span class="task-status" :style="{ background: TASK_STATUS_MAP[task.status]?.color }">
            {{ TASK_STATUS_MAP[task.status]?.label }}
          </span>
          <span class="task-title">{{ task.title }}</span>
          <span class="task-date">{{ task.date }}</span>
        </div>
        <p v-if="tasks.length === 0" class="empty">暂无任务，去任务页面创建吧</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard { max-width: 960px; margin: 0 auto; }

/* Welcome Card */
.welcome-card {
  background: linear-gradient(135deg, rgba(102,126,234,0.9) 0%, rgba(118,75,162,0.9) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: var(--radius-lg);
  padding: 28px 32px;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(102,126,234,0.3);
}

.welcome-left { display: flex; gap: 20px; align-items: center; }

.welcome-avatar {
  width: 64px; height: 64px;
  background: rgba(255,255,255,0.2);
  border-radius: var(--radius-lg);
  display: flex; align-items: center; justify-content: center;
  font-size: 36px;
  flex-shrink: 0;
}

.welcome-info h1 { font-size: 22px; font-weight: 600; margin-bottom: 8px; }

.hitokoto {
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.6;
  margin-bottom: 10px;
  max-width: 500px;
}

.hitokoto span { opacity: 0.7; font-size: 12px; }

.welcome-meta { display: flex; gap: 16px; align-items: center; font-size: 13px; opacity: 0.85; }

.work-days strong { font-size: 18px; color: #ffd666; }

.refresh-quote {
  background: rgba(255,255,255,0.15);
  border: none; border-radius: var(--radius);
  padding: 8px 12px; cursor: pointer; font-size: 16px;
  transition: background 0.2s;
}
.refresh-quote:hover { background: rgba(255,255,255,0.25); }

/* Quick Actions */
.quick-actions {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;
}

.quick-btn {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 16px;
  cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  transition: all 0.2s;
  box-shadow: var(--shadow);
}

.quick-btn:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); }
.quick-icon { font-size: 28px; }
.quick-label { font-size: 13px; color: var(--text-primary); font-weight: 500; }

/* Stats */
.stats-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px;
}

.stat-card {
  background: var(--bg-primary);
  border-radius: var(--radius);
  padding: 20px 16px;
  text-align: center;
  box-shadow: var(--shadow);
  border-top: 3px solid var(--border);
}

.stat-card.stat-total { border-top-color: #8c8c8c; }
.stat-card.stat-pending { border-top-color: var(--warning); }
.stat-card.stat-progress { border-top-color: var(--info); }
.stat-card.stat-done { border-top-color: var(--accent); }
.stat-card.stat-week { border-top-color: #722ed1; }

.stat-icon { font-size: 24px; margin-bottom: 8px; }
.stat-number { font-size: 28px; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

/* Section */
.section {
  background: var(--bg-primary);
  padding: 20px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}

.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-header h2 { font-size: 16px; margin: 0; }
.time-range { font-size: 12px; color: var(--text-secondary); }
.section h2 { font-size: 16px; margin-bottom: 12px; }

.progress-bar { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; margin: 8px 0; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-hover)); border-radius: 4px; transition: width 0.3s; }
.progress-text { font-size: 13px; color: var(--text-secondary); }

/* Chart */
.chart { display: flex; gap: 8px; align-items: flex-end; height: 120px; padding-top: 10px; }
.chart-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.chart-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.chart-bar { width: 60%; max-width: 40px; background: var(--border); border-radius: 4px 4px 0 0; position: relative; min-height: 4px; overflow: hidden; }
.chart-bar-done { position: absolute; bottom: 0; left: 0; right: 0; background: var(--accent); border-radius: 4px 4px 0 0; transition: height 0.3s; }
.chart-label { font-size: 12px; color: var(--text-secondary); margin-top: 6px; }
.chart-value { font-size: 11px; color: var(--text-secondary); }

/* Tasks */
.task-list { display: flex; flex-direction: column; gap: 8px; }
.task-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.task-status { font-size: 11px; color: #fff; padding: 2px 8px; border-radius: var(--radius-full); white-space: nowrap; }
.task-title { flex: 1; font-size: 14px; }
.task-date { font-size: 12px; color: var(--text-secondary); }
</style>
