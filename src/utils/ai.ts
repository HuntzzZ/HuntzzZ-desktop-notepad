export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIProvider {
  name: string
  apiBase: string
  apiKey: string
  model: string
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  enableWebSearch?: boolean
  searchApiKey?: string
}

const PROVIDERS: Record<string, { defaultBase: string; defaultModel: string }> = {
  mimo: { defaultBase: 'https://api.mimo.com/v1', defaultModel: 'mimo-v2.5-pro' },
  deepseek: { defaultBase: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  siliconflow: { defaultBase: 'https://api.siliconflow.cn/v1', defaultModel: 'Qwen/Qwen2.5-7B-Instruct' },
  openrouter: { defaultBase: 'https://openrouter.ai/api/v1', defaultModel: 'openai/gpt-4o-mini' },
}

export const PROVIDER_NAMES: Record<string, string> = {
  mimo: 'MiMo',
  deepseek: 'DeepSeek',
  siliconflow: '硅基流动',
  openrouter: 'OpenRouter',
}

export function getProviderConfig(name: string): AIProvider {
  const saved = localStorage.getItem(`ai-provider-${name}`)
  if (saved) return JSON.parse(saved)
  const defaults = PROVIDERS[name] || PROVIDERS.deepseek
  return { name, apiBase: defaults.defaultBase, apiKey: '', model: defaults.defaultModel }
}

export function saveProviderConfig(config: AIProvider) {
  localStorage.setItem(`ai-provider-${config.name}`, JSON.stringify(config))
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * 流式对话（带自动重试）
 */
export async function chatStream(
  provider: AIProvider,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  onDone: (usage?: TokenUsage) => void,
  signal?: AbortSignal,
  options?: ChatOptions,
  retryCount = 0,
): Promise<void> {
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: buildMessages(messages, options?.systemPrompt),
    stream: true,
  }
  if (options?.temperature !== undefined) body.temperature = options.temperature
  if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens

  try {
    const res = await fetch(`${provider.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => '')
      throw new Error(`API error: ${res.status} ${res.statusText} ${errorText}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let usage: TokenUsage | undefined

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') { onDone(usage); return }
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) onChunk(content)
          if (parsed.usage) {
            usage = {
              promptTokens: parsed.usage.prompt_tokens || 0,
              completionTokens: parsed.usage.completion_tokens || 0,
              totalTokens: parsed.usage.total_tokens || 0,
            }
          }
        } catch { /* skip */ }
      }
    }
    onDone(usage)
  } catch (err: unknown) {
    if (retryCount < 2 && err instanceof Error && (err.name === 'TypeError' || err.message.includes('fetch'))) {
      await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)))
      return chatStream(provider, messages, onChunk, onDone, signal, options, retryCount + 1)
    }
    throw err
  }
}

/**
 * 同步对话
 */
export async function chatSync(
  provider: AIProvider,
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<{ content: string; usage?: TokenUsage }> {
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: buildMessages(messages, options?.systemPrompt),
    stream: false,
  }
  if (options?.temperature !== undefined) body.temperature = options.temperature
  if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens

  const res = await fetch(`${provider.apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0,
      totalTokens: data.usage.total_tokens || 0,
    } : undefined,
  }
}

function buildMessages(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
  if (!systemPrompt?.trim()) return messages
  return [{ role: 'system', content: systemPrompt }, ...messages.filter(m => m.role !== 'system')]
}

/**
 * 联网搜索（通过第三方搜索 API）
 */
export async function webSearch(query: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        include_answer: true,
      }),
    })
    if (!res.ok) throw new Error(`Search API error: ${res.status}`)
    const data = await res.json()
    let result = ''
    if (data.answer) result += `**搜索摘要：** ${data.answer}\n\n`
    if (data.results?.length > 0) {
      result += '**相关结果：**\n'
      for (const r of data.results.slice(0, 5)) {
        result += `- [${r.title}](${r.url})\n  ${r.content?.slice(0, 100)}...\n`
      }
    }
    return result || '未找到相关结果'
  } catch (err: unknown) {
    return `搜索失败: ${err instanceof Error ? err.message : String(err)}`
  }
}
