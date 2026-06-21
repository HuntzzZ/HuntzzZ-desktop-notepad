<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getDb } from '../../utils/db'
import { formatDate, type Task } from '../../utils/task'

const currentTime = ref(new Date().toLocaleTimeString())
const currentDate = ref(new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))
const pendingCount = ref(0)
const quotes = [
  '今天也要加油呀！💪',
  '每一个不曾起舞的日子，都是对生命的辜负。',
  '行动是治愈焦虑的良药。',
  '把每一天当作新的开始。',
  '完成比完美更重要。',
  '保持专注，保持热情。',
  '慢慢来，比较快。',
  '做就对了！',
]
const dailyQuote = ref(quotes[new Date().getDate() % quotes.length])

let timer: ReturnType<typeof setInterval>

async function loadData() {
  try {
    const db = await getDb()
    const tasks = await db.select<Task[]>(
      "SELECT * FROM tasks WHERE status != 'done' AND date <= $1",
      [formatDate(new Date())]
    )
    pendingCount.value = tasks.length
  } catch {
    pendingCount.value = 0
  }
}

onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = new Date().toLocaleTimeString()
    currentDate.value = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    })
  }, 1000)
  loadData()
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="widget-page">
    <h1>🖼️ 桌面小组件</h1>
    <p class="desc">常驻桌面的毛玻璃小窗口，显示实时时钟、今日待办和每日激励语。</p>

    <div class="widget-preview">
      <div class="widget">
        <div class="widget-clock">{{ currentTime }}</div>
        <div class="widget-date">{{ currentDate }}</div>
        <div class="widget-divider"></div>
        <div class="widget-todo">
          <span class="todo-icon">📋</span>
          <span class="todo-text">待办任务: <strong>{{ pendingCount }}</strong> 项</span>
        </div>
        <div class="widget-quote">{{ dailyQuote }}</div>
      </div>
    </div>

    <div class="widget-info">
      <h3>使用说明</h3>
      <ul>
        <li>组件常驻桌面，双击回到主窗口</li>
        <li>毛玻璃效果，不遮挡桌面内容</li>
        <li>实时更新时钟和待办数量</li>
        <li>每日自动更换激励语</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.widget-page {
  max-width: 700px;
  margin: 0 auto;
}

.widget-page h1 {
  font-size: 24px;
  margin-bottom: 8px;
}

.desc {
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.widget-preview {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.widget {
  width: 280px;
  padding: 24px;
  border-radius: var(--radius-lg);
  background: var(--bg-primary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  text-align: center;
  color: var(--text-primary);
}

.widget-clock {
  font-size: 42px;
  font-weight: 200;
  letter-spacing: 2px;
  margin-bottom: 4px;
  font-variant-numeric: tabular-nums;
}

.widget-date {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.widget-divider {
  height: 1px;
  background: var(--border);
  margin: 16px 0;
}

.widget-todo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}

.todo-icon { font-size: 16px; }

.widget-todo strong {
  color: var(--accent);
  font-size: 18px;
}

.widget-quote {
  font-size: 13px;
  color: var(--accent);
  font-style: italic;
  line-height: 1.6;
}

.widget-info {
  background: var(--bg-primary);
  padding: 20px;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.widget-info h3 {
  margin-bottom: 12px;
}

.widget-info ul {
  padding-left: 20px;
}

.widget-info li {
  margin: 6px 0;
  color: var(--text-secondary);
  font-size: 14px;
}
</style>
