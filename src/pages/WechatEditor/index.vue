<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { marked } from 'marked'
import { WECHAT_THEMES, renderMarkdownForWechat, copyToWechat, getTextStats, type WechatTheme } from '../../utils/editor'
import { getDb } from '../../utils/db'

const markdownContent = ref(`# 欢迎使用公众号编辑器

左侧编写 **Markdown**，右侧实时预览。

## 功能特性

- 🎨 6 套内置主题
- 📋 一键复制到微信后台
- 📝 导入 Markdown
- 📄 导出 PDF
- 💻 代码高亮
- 📊 字数统计
- 💾 自动保存

## 代码示例

\`\`\`javascript
function hello() {
  console.log('Hello, WeChat!')
}
\`\`\`

> 引用文本示例

---

**粗体** *斜体* ~~删除线~~ [链接](https://example.com)
`)

const selectedTheme = ref<WechatTheme>(WECHAT_THEMES[0])
const copySuccess = ref(false)
const showImportMenu = ref(false)
const showThemePanel = ref(false)

// Undo/Redo
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
const isUndoRedo = ref(false)

// Auto-save
let autoSaveTimer: ReturnType<typeof setInterval> | null = null
const lastSaved = ref('')
const isSaving = ref(false)

// Text stats
const textStats = computed(() => getTextStats(markdownContent.value))

const previewHtml = computed(() => {
  return renderMarkdownForWechat(markdownContent.value, selectedTheme.value)
})

const rawPreviewHtml = computed(() => {
  return marked.parse(markdownContent.value) as string
})

// Watch for content changes to build undo stack
watch(markdownContent, (_newVal, oldVal) => {
  if (!isUndoRedo.value && oldVal !== undefined) {
    undoStack.value.push(oldVal)
    if (undoStack.value.length > 100) undoStack.value.shift()
    redoStack.value = []
  }
  isUndoRedo.value = false
})

function handleUndo() {
  if (undoStack.value.length === 0) return
  isUndoRedo.value = true
  redoStack.value.push(markdownContent.value)
  markdownContent.value = undoStack.value.pop()!
}

function handleRedo() {
  if (redoStack.value.length === 0) return
  isUndoRedo.value = true
  undoStack.value.push(markdownContent.value)
  markdownContent.value = redoStack.value.pop()!
}

function handleKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      handleUndo()
    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
      e.preventDefault()
      handleRedo()
    }
  }
}

function handleCopy() {
  try {
    copyToWechat(previewHtml.value)
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
  } catch {
    navigator.clipboard.writeText(markdownContent.value)
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
  }
}

function handleImportMd() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.md,.markdown,.txt'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      markdownContent.value = await file.text()
    }
  }
  input.click()
  showImportMenu.value = false
}

function handleExportPdf() {
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>导出</title>
        <style>${selectedTheme.value.css}</style>
      </head>
      <body>${previewHtml.value}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }
}

function insertTemplate(type: string) {
  const templates: Record<string, string> = {
    header: '# 标题\n\n',
    h2: '## 二级标题\n\n',
    h3: '### 三级标题\n\n',
    code: '```javascript\n// 代码\n```\n\n',
    table: '| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 数据 | 数据 | 数据 |\n\n',
    quote: '> 引用内容\n\n',
    image: '![图片描述](图片URL)\n\n',
    list: '- 列表项1\n- 列表项2\n- 列表项3\n\n',
    ordered: '1. 列表项1\n2. 列表项2\n3. 列表项3\n\n',
    bold: '**粗体文本**',
    italic: '*斜体文本*',
    link: '[链接文本](URL)',
    hr: '\n---\n\n',
  }
  markdownContent.value += templates[type] || ''
}

// Auto-save to SQLite
async function autoSave() {
  if (markdownContent.value === lastSaved.value) return
  isSaving.value = true
  try {
    const db = await getDb()
    await db.execute(
      `INSERT INTO editor_drafts (id, content, theme, updated_at) VALUES (1, $1, $2, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET content = $1, theme = $2, updated_at = datetime('now')`,
      [markdownContent.value, selectedTheme.value.name],
    )
    lastSaved.value = markdownContent.value
  } catch {
    // silent fail
  }
  isSaving.value = false
}

async function loadDraft() {
  try {
    const db = await getDb()
    const rows = await db.select<{ content: string; theme: string }[]>('SELECT content, theme FROM editor_drafts WHERE id = 1')
    if (rows.length > 0 && rows[0].content) {
      markdownContent.value = rows[0].content
      const theme = WECHAT_THEMES.find(t => t.name === rows[0].theme)
      if (theme) selectedTheme.value = theme
    }
  } catch {
    // no draft yet
  }
}

onMounted(async () => {
  await loadDraft()
  autoSaveTimer = setInterval(autoSave, 30000) // 30s auto-save
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="wechat-editor">
    <div class="header">
      <h1>✏️ 公众号编辑器</h1>
      <div class="toolbar">
        <div class="insert-btns">
          <button @click="insertTemplate('h2')" title="二级标题">H2</button>
          <button @click="insertTemplate('h3')" title="三级标题">H3</button>
          <button @click="insertTemplate('bold')" title="粗体">B</button>
          <button @click="insertTemplate('italic')" title="斜体">I</button>
          <button @click="insertTemplate('code')" title="代码">{ }</button>
          <button @click="insertTemplate('table')" title="表格">⊞</button>
          <button @click="insertTemplate('quote')" title="引用">❝</button>
          <button @click="insertTemplate('link')" title="链接">🔗</button>
          <button @click="insertTemplate('image')" title="图片">🖼</button>
          <button @click="insertTemplate('list')" title="无序列表">☰</button>
          <button @click="insertTemplate('ordered')" title="有序列表">1.</button>
          <button @click="insertTemplate('hr')" title="分割线">—</button>
        </div>
        <div class="undo-redo">
          <button @click="handleUndo" :disabled="undoStack.length === 0" title="撤销 (Ctrl+Z)">↩️</button>
          <button @click="handleRedo" :disabled="redoStack.length === 0" title="重做 (Ctrl+Y)">↪️</button>
        </div>
        <div class="theme-select">
          <button class="btn" @click="showThemePanel = !showThemePanel">🎨 {{ selectedTheme.name }}</button>
          <div v-if="showThemePanel" class="theme-dropdown">
            <button
              v-for="theme in WECHAT_THEMES"
              :key="theme.name"
              class="theme-option"
              :class="{ active: theme.name === selectedTheme.name }"
              @click="selectedTheme = theme; showThemePanel = false"
            >
              {{ theme.name }}
            </button>
          </div>
        </div>
        <div class="action-btns">
          <div class="import-wrapper">
            <button class="btn" @click="showImportMenu = !showImportMenu">📥 导入</button>
            <div v-if="showImportMenu" class="import-menu">
              <button @click="handleImportMd">导入 Markdown</button>
            </div>
          </div>
          <button class="btn" @click="handleExportPdf">📄 导出 PDF</button>
          <button class="btn primary" @click="handleCopy">
            {{ copySuccess ? '✅ 已复制' : '📋 复制到微信' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Status bar -->
    <div class="status-bar">
      <span class="stats">📊 {{ textStats.chars }} 字 · {{ textStats.words }} 词 · {{ textStats.readTime }}阅读</span>
      <span class="save-status">
        <span v-if="isSaving">💾 保存中...</span>
        <span v-else-if="lastSaved">✅ 已自动保存</span>
      </span>
    </div>

    <div class="editor-body">
      <div class="editor-left">
        <div class="editor-label">Markdown</div>
        <textarea
          v-model="markdownContent"
          class="editor-textarea"
          placeholder="在这里编写 Markdown..."
          spellcheck="false"
        ></textarea>
      </div>
      <div class="editor-right">
        <div class="editor-label">预览</div>
        <div class="preview-content" v-html="rawPreviewHtml"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wechat-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  margin-bottom: 8px;
}

.header h1 {
  font-size: 24px;
  margin-bottom: 12px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.insert-btns {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}

.insert-btns button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.insert-btns button:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.undo-redo {
  display: flex;
  gap: 3px;
  border-left: 1px solid var(--border);
  padding-left: 8px;
}

.undo-redo button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.undo-redo button:disabled { opacity: 0.3; cursor: not-allowed; }
.undo-redo button:hover:not(:disabled) { border-color: var(--accent); }

.theme-select {
  position: relative;
}

.theme-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 100;
  min-width: 120px;
}

.theme-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}

.theme-option:hover { background: var(--bg-secondary); }
.theme-option.active { color: var(--accent); font-weight: 600; }

.action-btns {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.import-wrapper { position: relative; }

.import-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  z-index: 10;
  min-width: 140px;
}

.import-menu button {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: none;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}

.import-menu button:hover { background: var(--bg-secondary); }

.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 12px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}

.editor-body {
  flex: 1;
  display: flex;
  gap: 16px;
  min-height: 0;
}

.editor-left,
.editor-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.editor-textarea {
  flex: 1;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.editor-textarea:focus { border-color: var(--accent); }

.preview-content {
  flex: 1;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-primary);
  overflow-y: auto;
  font-size: 15px;
  line-height: 1.8;
}

.preview-content :deep(h1) { font-size: 22px; font-weight: 700; margin: 20px 0 10px; border-bottom: 2px solid var(--accent); padding-bottom: 8px; }
.preview-content :deep(h2) { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
.preview-content :deep(h3) { font-size: 16px; font-weight: 600; margin: 12px 0 6px; }
.preview-content :deep(code) { background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px; font-family: 'Menlo', monospace; font-size: 13px; }
.preview-content :deep(pre) { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; }
.preview-content :deep(pre code) { background: none; padding: 0; color: inherit; }
.preview-content :deep(blockquote) { border-left: 4px solid var(--accent); padding: 8px 16px; margin: 12px 0; background: var(--bg-secondary); }
.preview-content :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.preview-content :deep(th), .preview-content :deep(td) { border: 1px solid var(--border); padding: 8px 12px; text-align: left; }
.preview-content :deep(th) { background: var(--bg-secondary); font-weight: 600; }
.preview-content :deep(img) { max-width: 100%; border-radius: 8px; }
.preview-content :deep(hr) { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
</style>
