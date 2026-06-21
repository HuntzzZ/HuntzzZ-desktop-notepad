<script setup lang="ts">
import { computed, ref } from 'vue'

interface Task {
  id?: number
  title: string
  status: string
  date: string
}

const props = defineProps<{
  tasks: Task[]
}>()

const currentYear = ref(new Date().getFullYear())

const yearData = computed(() => {
  const year = currentYear.value
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)

  const doneTasksByDate: Record<string, number> = {}
  props.tasks.forEach(t => {
    if (t.status === 'done' && t.date.startsWith(String(year))) {
      doneTasksByDate[t.date] = (doneTasksByDate[t.date] || 0) + 1
    }
  })

  const weeks: { date: string; count: number; day: number }[][] = []
  let currentWeek: { date: string; count: number; day: number }[] = []

  const startDay = startDate.getDay()
  for (let i = 0; i < startDay; i++) {
    currentWeek.push({ date: '', count: -1, day: i })
  }

  const current = new Date(startDate)
  while (current <= endDate) {
    const dateStr = `${year}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
    const count = doneTasksByDate[dateStr] || 0

    currentWeek.push({ date: dateStr, count, day: current.getDay() })

    if (current.getDay() === 6) {
      weeks.push(currentWeek)
      currentWeek = []
    }

    current.setDate(current.getDate() + 1)
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  return weeks
})

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function getColor(count: number): string {
  if (count < 0) return 'transparent'
  if (count === 0) return 'var(--heatmap-empty)'
  if (count <= 2) return 'var(--heatmap-level-1)'
  if (count <= 4) return 'var(--heatmap-level-2)'
  if (count <= 6) return 'var(--heatmap-level-3)'
  return 'var(--heatmap-level-4)'
}

function prevYear() {
  currentYear.value--
}

function nextYear() {
  if (currentYear.value < new Date().getFullYear()) {
    currentYear.value++
  }
}
</script>

<template>
  <div class="heatmap-container">
    <div class="heatmap-header">
      <h3>{{ currentYear }} 年产出</h3>
      <div class="heatmap-nav">
        <button @click="prevYear" class="nav-btn">◀</button>
        <button @click="nextYear" :disabled="currentYear >= new Date().getFullYear()" class="nav-btn">▶</button>
      </div>
    </div>

    <div class="heatmap-grid">
      <div class="heatmap-months">
        <span v-for="m in months" :key="m">{{ m }}</span>
      </div>
      <div class="heatmap-body">
        <div v-for="(week, wi) in yearData" :key="wi" class="heatmap-week">
          <div
            v-for="(day, di) in week"
            :key="di"
            class="heatmap-day"
            :style="{ background: getColor(day.count) }"
            :title="day.date ? `${day.date}: ${day.count} 个完成` : ''"
          />
        </div>
      </div>
    </div>

    <div class="heatmap-legend">
      <span>少</span>
      <div class="legend-item" style="background: var(--heatmap-empty)" />
      <div class="legend-item" style="background: var(--heatmap-level-1)" />
      <div class="legend-item" style="background: var(--heatmap-level-2)" />
      <div class="legend-item" style="background: var(--heatmap-level-3)" />
      <div class="legend-item" style="background: var(--heatmap-level-4)" />
      <span>多</span>
    </div>
  </div>
</template>

<style scoped>
.heatmap-container {
  padding: 0;
}

.heatmap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.heatmap-header h3 {
  font-size: 16px;
  margin: 0;
}

.heatmap-nav {
  display: flex;
  gap: 4px;
}

.nav-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-primary);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-btn:hover {
  border-color: var(--accent);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.heatmap-grid {
  overflow-x: auto;
}

.heatmap-months {
  display: flex;
  margin-bottom: 4px;
  padding-left: 2px;
}

.heatmap-months span {
  font-size: 11px;
  color: var(--text-secondary);
  width: calc(100% / 12);
  text-align: center;
}

.heatmap-body {
  display: flex;
  gap: 3px;
}

.heatmap-week {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.heatmap-day {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.heatmap-day:hover {
  opacity: 0.8;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  justify-content: flex-end;
}

.heatmap-legend span {
  font-size: 11px;
  color: var(--text-secondary);
}

.legend-item {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}
</style>
