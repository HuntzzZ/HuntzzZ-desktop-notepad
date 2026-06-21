<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getDb } from '../../utils/db'
import { formatDate, TASK_TAGS, TASK_STATUS_MAP, TASK_PRIORITY_MAP, searchTasks, filterTasks, type Task } from '../../utils/task'
import { getDateInfo } from '../../data/holidays'

const tasks = ref<Task[]>([])
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth())
const selectedDate = ref(formatDate(new Date()))
const viewMode = ref<'month' | 'week'>('month')
const showAddModal = ref(false)
const editingTask = ref<Task | null>(null)
const searchQuery = ref('')
const filterStatus = ref('')
const filterTag = ref('')
const filterPriority = ref('')

const newTask = ref<Task>({
  title: '',
  description: '',
  tag: '默认',
  priority: 'medium',
  status: 'pending',
  date: formatDate(new Date()),
  reminder: '',
})

const daysInMonth = computed(() => {
  const d = new Date(currentYear.value, currentMonth.value + 1, 0)
  return d.getDate()
})

const firstDay = computed(() => new Date(currentYear.value, currentMonth.value, 1).getDay())

const calendarDays = computed(() => {
  const days: { date: string; day: number; isCurrentMonth: boolean; holiday: string | null; lunar: string; tasks: Task[] }[] = []

  // Previous month padding
  const prevMonthDays = new Date(currentYear.value, currentMonth.value, 0).getDate()
  for (let i = firstDay.value - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const m = currentMonth.value === 0 ? 12 : currentMonth.value
    const y = currentMonth.value === 0 ? currentYear.value - 1 : currentYear.value
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const info = getDateInfo(dateStr)
    days.push({ date: dateStr, day: d, isCurrentMonth: false, holiday: info.holiday, lunar: info.lunar, tasks: [] })
  }

  // Current month
  for (let d = 1; d <= daysInMonth.value; d++) {
    const dateStr = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const info = getDateInfo(dateStr)
    days.push({
      date: dateStr,
      day: d,
      isCurrentMonth: true,
      holiday: info.holiday,
      lunar: info.lunar,
      tasks: tasks.value.filter(t => t.date === dateStr),
    })
  }

  // Next month padding
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const m = currentMonth.value === 11 ? 1 : currentMonth.value + 2
    const y = currentMonth.value === 11 ? currentYear.value + 1 : currentYear.value
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const info = getDateInfo(dateStr)
    days.push({ date: dateStr, day: d, isCurrentMonth: false, holiday: info.holiday, lunar: info.lunar, tasks: [] })
  }

  return days
})

const selectedDateTasks = computed(() => {
  let result = tasks.value.filter(t => t.date === selectedDate.value)
  if (filterStatus.value) result = filterTasks(result, { status: filterStatus.value })
  if (filterTag.value) result = filterTasks(result, { tag: filterTag.value })
  if (filterPriority.value) result = filterTasks(result, { priority: filterPriority.value })
  if (searchQuery.value) result = searchTasks(result, searchQuery.value)
  return result
})

const allFilteredTasks = computed(() => {
  let result = tasks.value
  if (searchQuery.value) result = searchTasks(result, searchQuery.value)
  if (filterStatus.value) result = filterTasks(result, { status: filterStatus.value })
  if (filterTag.value) result = filterTasks(result, { tag: filterTag.value })
  if (filterPriority.value) result = filterTasks(result, { priority: filterPriority.value })
  return result
})

const monthName = computed(() => {
  const names = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
  return names[currentMonth.value]
})

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function selectDate(date: string) {
  selectedDate.value = date
  newTask.value.date = date
}

function openAddModal() {
  editingTask.value = null
  newTask.value = { title: '', description: '', tag: '默认', priority: 'medium', status: 'pending', date: selectedDate.value, reminder: '' }
  showAddModal.value = true
}

function openEditModal(task: Task) {
  editingTask.value = task
  newTask.value = { ...task }
  showAddModal.value = true
}

async function saveTask() {
  if (!newTask.value.title.trim()) return
  const db = await getDb()
  if (editingTask.value?.id) {
    await db.execute(
      'UPDATE tasks SET title = $1, description = $2, tag = $3, priority = $4, status = $5, date = $6, reminder = $7, updated_at = datetime("now") WHERE id = $8',
      [newTask.value.title, newTask.value.description, newTask.value.tag, newTask.value.priority, newTask.value.status, newTask.value.date, newTask.value.reminder || null, editingTask.value.id],
    )
  } else {
    await db.execute(
      'INSERT INTO tasks (title, description, tag, priority, status, date, reminder) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [newTask.value.title, newTask.value.description, newTask.value.tag, newTask.value.priority, newTask.value.status, newTask.value.date, newTask.value.reminder || null],
    )
  }
  showAddModal.value = false
  await loadTasks()
}

async function deleteTask(id: number) {
  const db = await getDb()
  await db.execute('DELETE FROM tasks WHERE id = $1', [id])
  await loadTasks()
}

async function toggleStatus(task: Task) {
  const next = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'pending'
  const db = await getDb()
  await db.execute('UPDATE tasks SET status = $1, updated_at = datetime("now") WHERE id = $2', [next, task.id])
  await loadTasks()
}

async function loadTasks() {
  const db = await getDb()
  tasks.value = await db.select<Task[]>('SELECT * FROM tasks ORDER BY date DESC, created_at DESC')
}

function getSelectedDateInfo() {
  return getDateInfo(selectedDate.value)
}

onMounted(loadTasks)
</script>

<template>
  <div class="work-task">
    <div class="header">
      <h1>📋 工作任务</h1>
      <div class="actions">
        <div class="search-box">
          <input v-model="searchQuery" placeholder="🔍 搜索任务..." class="search-input" />
        </div>
        <button class="btn" :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">月</button>
        <button class="btn" :class="{ active: viewMode === 'week' }" @click="viewMode = 'week'">周</button>
        <button class="btn primary" @click="openAddModal">+ 新建任务</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select v-model="filterStatus" class="filter-select">
        <option value="">全部状态</option>
        <option v-for="(v, k) in TASK_STATUS_MAP" :key="k" :value="k">{{ v.label }}</option>
      </select>
      <select v-model="filterTag" class="filter-select">
        <option value="">全部标签</option>
        <option v-for="tag in TASK_TAGS" :key="tag" :value="tag">{{ tag }}</option>
      </select>
      <select v-model="filterPriority" class="filter-select">
        <option value="">全部优先级</option>
        <option v-for="(v, k) in TASK_PRIORITY_MAP" :key="k" :value="k">{{ v.icon }} {{ v.label }}</option>
      </select>
      <span class="filter-count">共 {{ allFilteredTasks.length }} 个任务</span>
    </div>

    <div class="calendar-section">
      <div class="calendar-nav">
        <button @click="prevMonth" class="nav-btn">◀</button>
        <span class="month-title">{{ currentYear }}年 {{ monthName }}</span>
        <button @click="nextMonth" class="nav-btn">▶</button>
      </div>

      <div class="calendar-grid">
        <div v-for="d in ['日','一','二','三','四','五','六']" :key="d" class="calendar-header">{{ d }}</div>
        <div
          v-for="day in calendarDays"
          :key="day.date"
          class="calendar-day"
          :class="{
            'other-month': !day.isCurrentMonth,
            'selected': day.date === selectedDate,
            'today': day.date === formatDate(new Date()),
            'has-tasks': day.tasks.length > 0,
            'is-weekend': [0, 6].includes(new Date(day.date).getDay()),
          }"
          @click="selectDate(day.date)"
        >
          <span class="day-number">{{ day.day }}</span>
          <span v-if="day.holiday" class="holiday">{{ day.holiday }}</span>
          <span v-else-if="day.lunar" class="lunar">{{ day.lunar }}</span>
          <div v-if="day.tasks.length > 0" class="task-dots">
            <span
              v-for="task in day.tasks.slice(0, 3)"
              :key="task.id"
              class="dot"
              :style="{ background: TASK_STATUS_MAP[task.status]?.color }"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Selected date info & tasks -->
    <div class="selected-tasks">
      <div class="selected-header">
        <h3>{{ selectedDate }} {{ getSelectedDateInfo().holiday ? '🎉 ' + getSelectedDateInfo().holiday : '' }}</h3>
        <span class="selected-lunar">{{ getSelectedDateInfo().lunar }}</span>
      </div>
      <div v-if="selectedDateTasks.length === 0" class="empty">
        {{ searchQuery || filterStatus || filterTag || filterPriority ? '没有匹配的任务' : '暂无任务' }}
      </div>
      <div v-for="task in selectedDateTasks" :key="task.id" class="task-card">
        <div class="task-header">
          <div class="task-badges">
            <span class="task-tag">{{ task.tag }}</span>
            <span class="task-priority" :style="{ color: TASK_PRIORITY_MAP[task.priority]?.color }">
              {{ TASK_PRIORITY_MAP[task.priority]?.icon }} {{ TASK_PRIORITY_MAP[task.priority]?.label }}
            </span>
          </div>
          <span class="task-status-badge" :style="{ background: TASK_STATUS_MAP[task.status]?.color }" @click="toggleStatus(task)">
            {{ TASK_STATUS_MAP[task.status]?.label }}
          </span>
        </div>
        <h4 class="task-title">{{ task.title }}</h4>
        <p v-if="task.description" class="task-desc">{{ task.description }}</p>
        <div class="task-footer">
          <span v-if="task.reminder" class="task-reminder">⏰ {{ task.reminder.replace('T', ' ').slice(0, 16) }}</span>
          <div class="task-actions">
            <button class="action-btn" @click="openEditModal(task)">编辑</button>
            <button class="action-btn danger" @click="deleteTask(task.id!)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>{{ editingTask ? '编辑任务' : '新建任务' }}</h3>
        <div class="form-group">
          <label>标题 *</label>
          <input v-model="newTask.title" placeholder="任务标题" @keydown.enter="saveTask" />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea v-model="newTask.description" placeholder="任务描述" rows="3"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>标签</label>
            <select v-model="newTask.tag">
              <option v-for="tag in TASK_TAGS" :key="tag" :value="tag">{{ tag }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>优先级</label>
            <select v-model="newTask.priority">
              <option v-for="(v, k) in TASK_PRIORITY_MAP" :key="k" :value="k">{{ v.icon }} {{ v.label }}</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>状态</label>
            <select v-model="newTask.status">
              <option value="pending">待办</option>
              <option value="in_progress">进行中</option>
              <option value="done">已完成</option>
            </select>
          </div>
          <div class="form-group">
            <label>日期</label>
            <input type="date" v-model="newTask.date" />
          </div>
        </div>
        <div class="form-group">
          <label>提醒时间（可选）</label>
          <input type="datetime-local" v-model="newTask.reminder" />
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showAddModal = false">取消</button>
          <button class="btn primary" @click="saveTask" :disabled="!newTask.title.trim()">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.work-task { max-width: 1000px; margin: 0 auto; }

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.header h1 { font-size: 24px; }

.actions { display: flex; gap: 8px; align-items: center; }

.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  width: 180px;
  outline: none;
}

.search-input:focus { border-color: var(--accent); }

.filters {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.filter-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: auto;
}

.btn { padding: 8px 16px; border: 1px solid var(--border); background: var(--bg-primary); color: var(--text-primary); border-radius: var(--radius); cursor: pointer; font-size: 13px; transition: all 0.2s; }
.btn:hover { border-color: var(--accent); }
.btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn.primary:hover { opacity: 0.9; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.calendar-section {
  background: var(--bg-primary);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  margin-bottom: 20px;
}

.calendar-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}

.nav-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-primary);
  padding: 4px 8px;
  border-radius: 4px;
}

.nav-btn:hover { background: var(--bg-secondary); }

.month-title { font-size: 16px; font-weight: 600; }

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-header {
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px;
  font-weight: 600;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius);
  transition: all 0.2s;
  position: relative;
  min-height: 48px;
}

.calendar-day:hover { background: var(--bg-secondary); }
.calendar-day.selected { background: var(--accent); color: #fff; }
.calendar-day.today .day-number { font-weight: 700; color: var(--accent); }
.calendar-day.selected.today .day-number { color: #fff; }
.calendar-day.other-month { opacity: 0.4; }
.calendar-day.is-weekend .day-number { color: #ef4444; }
.calendar-day.selected.is-weekend .day-number { color: #fff; }

.day-number { font-size: 12px; }

.holiday {
  font-size: 10px;
  color: #e74c3c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  padding: 0 2px;
}

.calendar-day.selected .holiday { color: #ffd; }

.lunar {
  font-size: 9px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.calendar-day.selected .lunar { color: rgba(255,255,255,0.7); }

.task-dots {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.selected-tasks {
  background: var(--bg-primary);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
}

.selected-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.selected-header h3 { margin: 0; }
.selected-lunar { font-size: 13px; color: var(--text-secondary); }

.empty { color: var(--text-secondary); text-align: center; padding: 20px; font-size: 14px; }

.task-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px;
  margin-bottom: 8px;
  transition: border-color 0.2s;
}

.task-card:hover { border-color: var(--accent); }

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-tag {
  font-size: 11px;
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 10px;
  color: var(--text-secondary);
}

.task-priority {
  font-size: 12px;
  font-weight: 500;
}

.task-status-badge {
  font-size: 11px;
  color: #fff;
  padding: 2px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.task-status-badge:hover { opacity: 0.8; }

.task-title { font-size: 15px; margin-bottom: 4px; }
.task-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }

.task-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-reminder {
  font-size: 11px;
  color: var(--accent);
}

.task-actions { display: flex; gap: 8px; }

.action-btn {
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-primary);
  border-radius: 4px;
  cursor: pointer;
}

.action-btn:hover { border-color: var(--accent); }
.action-btn.danger { color: #e74c3c; }
.action-btn.danger:hover { border-color: #e74c3c; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 24px;
  width: 520px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.modal h3 { margin-bottom: 16px; }

.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: var(--accent);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
