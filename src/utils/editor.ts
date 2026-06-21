import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/core'

// 按需加载常用语言
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import shell from 'highlight.js/lib/languages/shell'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('cs', csharp)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', html)
hljs.registerLanguage('xml', html)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('php', php)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('shell', shell)

// 配置 marked + 代码高亮
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  }),
  { breaks: true },
)

import DOMPurify from 'dompurify'

/**
 * 安全渲染 Markdown（带代码高亮 + XSS 过滤）
 */
export function renderMarkdownSafe(markdownText: string): string {
  const rawHtml = marked.parse(markdownText) as string
  return DOMPurify.sanitize(rawHtml)
}

/**
 * 计算文本统计信息
 */
export function getTextStats(text: string): { chars: number; words: number; readTime: string } {
  const chars = text.length
  // 中文按字符数，英文按空格分词
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length
  const words = chineseChars + englishWords
  const minutes = Math.max(1, Math.ceil(words / 300))
  return { chars, words, readTime: `约 ${minutes} 分钟` }
}

export interface WechatTheme {
  name: string
  css: string
}

export const WECHAT_THEMES: WechatTheme[] = [
  {
    name: '默认',
    css: `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.8; font-size: 15px; }
      h1 { font-size: 22px; font-weight: 700; color: #1a1a2e; margin: 24px 0 12px; border-bottom: 2px solid #4f46e5; padding-bottom: 8px; }
      h2 { font-size: 18px; font-weight: 600; color: #1a1a2e; margin: 20px 0 10px; }
      h3 { font-size: 16px; font-weight: 600; color: #333; margin: 16px 0 8px; }
      p { margin: 10px 0; }
      code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: 'Menlo', 'Monaco', monospace; }
      pre { background: #1e1e2e; color: #cdd6f4; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; position: relative; }
      pre code { background: none; padding: 0; color: inherit; }
      blockquote { border-left: 4px solid #4f46e5; padding: 8px 16px; margin: 12px 0; background: #f8f8ff; color: #555; }
      ul, ol { padding-left: 24px; margin: 10px 0; }
      li { margin: 4px 0; }
      a { color: #4f46e5; text-decoration: none; }
      img { max-width: 100%; border-radius: 8px; margin: 12px 0; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
      th { background: #f5f5f5; font-weight: 600; }
      hr { border: none; border-top: 1px solid #eee; margin: 20px 0; }
    `,
  },
  {
    name: '暗夜',
    css: `
      body { font-family: -apple-system, sans-serif; color: #e0e0e0; line-height: 1.8; font-size: 15px; background: #1a1a2e; }
      h1 { font-size: 22px; color: #818cf8; border-bottom: 2px solid #818cf8; padding-bottom: 8px; }
      h2 { font-size: 18px; color: #a5b4fc; }
      h3 { font-size: 16px; color: #c7d2fe; }
      code { background: #2d2d44; padding: 2px 6px; border-radius: 4px; color: #f0abfc; }
      pre { background: #0f0f23; color: #cdd6f4; padding: 16px; border-radius: 8px; }
      blockquote { border-left: 4px solid #818cf8; background: #16213e; color: #ccc; padding: 8px 16px; }
      a { color: #818cf8; }
      table { border-color: #2d2d44; }
      th { background: #16213e; }
    `,
  },
  {
    name: '清新绿',
    css: `
      body { font-family: -apple-system, sans-serif; color: #2d3436; line-height: 1.8; font-size: 15px; }
      h1 { color: #00b894; border-bottom: 2px solid #00b894; }
      h2 { color: #00b894; }
      h3 { color: #55efc4; }
      code { background: #dfe6e9; }
      pre { background: #2d3436; color: #55efc4; }
      blockquote { border-left-color: #00b894; background: #f0fff4; }
      a { color: #00b894; }
    `,
  },
  {
    name: '暖橙',
    css: `
      body { font-family: -apple-system, sans-serif; color: #333; line-height: 1.8; font-size: 15px; }
      h1 { color: #e17055; border-bottom: 2px solid #e17055; }
      h2 { color: #e17055; }
      code { background: #ffeaa7; }
      pre { background: #2d3436; color: #ffeaa7; }
      blockquote { border-left-color: #e17055; background: #fff5f5; }
      a { color: #e17055; }
    `,
  },
  {
    name: '极简',
    css: `
      body { font-family: Georgia, 'Times New Roman', serif; color: #333; line-height: 2; font-size: 16px; }
      h1 { font-size: 24px; font-weight: 400; letter-spacing: 2px; }
      h2 { font-size: 20px; font-weight: 400; }
      code { background: #f5f5f5; font-size: 14px; }
      pre { background: #fafafa; border: 1px solid #eee; }
      blockquote { border-left: 2px solid #333; font-style: italic; }
    `,
  },
  {
    name: '科技蓝',
    css: `
      body { font-family: -apple-system, sans-serif; color: #333; line-height: 1.8; font-size: 15px; }
      h1 { color: #0984e3; border-bottom: 2px solid #0984e3; }
      h2 { color: #0984e3; }
      code { background: #dfe6e9; color: #0984e3; }
      pre { background: #0c2461; color: #74b9ff; }
      blockquote { border-left-color: #0984e3; background: #f0f8ff; }
      a { color: #0984e3; }
    `,
  },
]

/**
 * 渲染 Markdown 为微信兼容 HTML（带 CSS 内联）
 */
export function renderMarkdownForWechat(markdownText: string, theme: WechatTheme): string {
  const rawHtml = marked.parse(markdownText) as string
  return juice.inlineContent(rawHtml, theme.css)
}

/**
 * 复制 HTML 到剪贴板（微信兼容）
 */
export function copyToWechat(html: string): void {
  const blob = new Blob([html], { type: 'text/html' })
  const clipboardItem = new ClipboardItem({ 'text/html': blob })
  navigator.clipboard.write([clipboardItem])
}

import juice from 'juice'
