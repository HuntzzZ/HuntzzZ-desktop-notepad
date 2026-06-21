export interface WebDAVConfig {
  server: string
  username: string
  password: string
  path: string
}

function getAuthHeader(config: WebDAVConfig): string {
  const credentials = btoa(`${config.username}:${config.password}`)
  return `Basic ${credentials}`
}

function getBaseUrl(config: WebDAVConfig): string {
  const server = config.server.replace(/\/$/, '')
  const path = config.path.replace(/^\//, '').replace(/\/$/, '')
  return `${server}/${path}`
}

export async function testConnection(config: WebDAVConfig): Promise<{ success: boolean; message: string }> {
  try {
    const url = getBaseUrl(config)
    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        Authorization: getAuthHeader(config),
        Depth: '0',
      },
    })

    if (response.ok || response.status === 207) {
      return { success: true, message: '连接成功' }
    }
    return { success: false, message: `连接失败: ${response.status}` }
  } catch (err) {
    return { success: false, message: `连接错误: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function uploadData(config: WebDAVConfig, data: string, filename: string): Promise<boolean> {
  try {
    const url = `${getBaseUrl(config)}/${filename}`
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: getAuthHeader(config),
        'Content-Type': 'application/json',
      },
      body: data,
    })
    return response.ok
  } catch {
    return false
  }
}

export async function downloadData(config: WebDAVConfig, filename: string): Promise<string | null> {
  try {
    const url = `${getBaseUrl(config)}/${filename}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(config),
      },
    })
    if (response.ok) {
      return await response.text()
    }
    return null
  } catch {
    return null
  }
}

export async function listBackups(config: WebDAVConfig): Promise<string[]> {
  try {
    const url = getBaseUrl(config)
    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        Authorization: getAuthHeader(config),
        Depth: '1',
      },
    })

    if (!response.ok && response.status !== 207) {
      return []
    }

    const text = await response.text()
    const files: string[] = []
    const regex = /<d:href>([^<]*\.json)<\/d:href>/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const filename = match[1].split('/').pop()
      if (filename && filename.startsWith('desktop-notepad-backup')) {
        files.push(filename)
      }
    }
    return files.sort().reverse()
  } catch {
    return []
  }
}

export function generateBackupFilename(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const time = now.toISOString().slice(11, 19).replace(/:/g, '')
  return `desktop-notepad-backup-${date}-${time}.json`
}
