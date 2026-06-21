export interface Task {
  id?: number
  title: string
  description: string
  tag: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'done'
  date: string
  reminder?: string // ISO datetime string
  created_at?: string
  updated_at?: string
}

export const TASK_TAGS = ['默认', '工作', '学习', '生活', '紧急', '重要']

export const TASK_PRIORITY_MAP: Record<string, { label: string; color: string; icon: string }> = {
  low: { label: '低', color: '#6b7280', icon: '⬇️' },
  medium: { label: '中', color: '#f59e0b', icon: '➡️' },
  high: { label: '高', color: '#ef4444', icon: '⬆️' },
  urgent: { label: '紧急', color: '#dc2626', icon: '🔥' },
}

export const TASK_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待办', color: '#f59e0b' },
  in_progress: { label: '进行中', color: '#3b82f6' },
  done: { label: '已完成', color: '#10b981' },
}

export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

/**
 * 获取任务的排序权重（优先级 + 状态）
 */
export function getTaskSortWeight(task: Task): number {
  const priorityWeight = { urgent: 40, high: 30, medium: 20, low: 10 }
  const statusWeight = { pending: 3, in_progress: 2, done: 1 }
  return (priorityWeight[task.priority] || 0) + (statusWeight[task.status] || 0)
}

/**
 * 搜索任务
 */
export function searchTasks(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return tasks
  const q = query.toLowerCase()
  return tasks.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tag.toLowerCase().includes(q),
  )
}

/**
 * 按条件过滤任务
 */
export function filterTasks(
  tasks: Task[],
  filters: { status?: string; tag?: string; priority?: string },
): Task[] {
  return tasks.filter(t => {
    if (filters.status && t.status !== filters.status) return false
    if (filters.tag && t.tag !== filters.tag) return false
    if (filters.priority && t.priority !== filters.priority) return false
    return true
  })
}
