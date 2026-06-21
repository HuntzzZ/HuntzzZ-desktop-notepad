import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:desktop-notepad.db')
    await initTables(db)
  }
  return db
}

async function initTables(db: Database) {
  // Users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      entry_date TEXT DEFAULT '',
      work_start_time TEXT DEFAULT '09:00',
      work_end_time TEXT DEFAULT '18:00',
      theme TEXT DEFAULT 'light',
      hitokoto_category TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Tasks table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      tag TEXT DEFAULT '默认',
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      date TEXT NOT NULL,
      reminder TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // AI sessions table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      messages TEXT DEFAULT '[]',
      provider TEXT DEFAULT 'deepseek',
      system_prompt TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Personal info cards (「我的」)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS personal_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_sensitive INTEGER DEFAULT 0,
      icon TEXT DEFAULT '📌',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  // Editor drafts
  await db.execute(`
    CREATE TABLE IF NOT EXISTS editor_drafts (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id INTEGER DEFAULT 1,
      content TEXT DEFAULT '',
      theme TEXT DEFAULT '默认',
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Notes table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'markdown',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Migrations
  try { await db.execute('ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT "medium"') } catch {}
  try { await db.execute('ALTER TABLE tasks ADD COLUMN reminder TEXT') } catch {}
  try { await db.execute('ALTER TABLE tasks ADD COLUMN user_id INTEGER DEFAULT 1') } catch {}
  try { await db.execute('ALTER TABLE ai_sessions ADD COLUMN system_prompt TEXT DEFAULT ""') } catch {}
  try { await db.execute('ALTER TABLE ai_sessions ADD COLUMN user_id INTEGER DEFAULT 1') } catch {}
}

// ============ User Auth ============

export interface User {
  id: number
  username: string
  display_name: string
  avatar: string
  entry_date: string
  work_start_time: string
  work_end_time: string
  theme: string
  hitokoto_category: string
}

// Simple hash for local use (not cryptographically secure, but sufficient for local app)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'desktop-notepad-salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function registerUser(username: string, password: string, displayName: string): Promise<User> {
  const db = await getDb()
  const hash = await hashPassword(password)
  try {
    const result = await db.execute(
      'INSERT INTO users (username, password_hash, display_name) VALUES ($1, $2, $3)',
      [username, hash, displayName],
    )
    return {
      id: result.lastInsertId as number,
      username,
      display_name: displayName,
      avatar: '',
      entry_date: '',
      work_start_time: '09:00',
      work_end_time: '18:00',
      theme: 'light',
      hitokoto_category: '',
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes('UNIQUE')) {
      throw new Error('用户名已存在')
    }
    throw e
  }
}

export async function loginUser(username: string, password: string): Promise<User | null> {
  const db = await getDb()
  const hash = await hashPassword(password)
  const rows = await db.select<(User & { password_hash: string })[]>(
    'SELECT * FROM users WHERE username = $1',
    [username],
  )
  if (rows.length === 0) return null
  if (rows[0].password_hash !== hash) return null
  const { password_hash: _, ...user } = rows[0]
  return user
}

export async function updateUser(userId: number, updates: Partial<User>): Promise<void> {
  const db = await getDb()
  const fields: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const [key, val] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'username' && val !== undefined) {
      fields.push(`${key} = $${idx}`)
      values.push(val)
      idx++
    }
  }
  fields.push(`updated_at = datetime('now')`)
  values.push(userId)

  await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values)
}

export async function getUser(userId: number): Promise<User | null> {
  const db = await getDb()
  const rows = await db.select<User[]>('SELECT id, username, display_name, avatar, entry_date, work_start_time, work_end_time, theme, hitokoto_category FROM users WHERE id = $1', [userId])
  return rows.length > 0 ? rows[0] : null
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb()
  return db.select<User[]>('SELECT id, username, display_name, avatar, entry_date, work_start_time, work_end_time, theme, hitokoto_category FROM users ORDER BY id')
}

// ============ Settings ============

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const db = await getDb()
    const rows = await db.select<{ value: string }[]>('SELECT value FROM settings WHERE key = $1', [key])
    return rows.length > 0 ? rows[0].value : defaultValue
  } catch {
    return defaultValue
  }
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.execute(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2',
    [key, value],
  )
}

// ============ Personal Cards ============

export interface PersonalCard {
  id?: number
  user_id: number
  category: string
  title: string
  content: string
  is_sensitive: number
  icon: string
  sort_order: number
  created_at?: string
  updated_at?: string
}

export async function getPersonalCards(userId: number, category?: string): Promise<PersonalCard[]> {
  const db = await getDb()
  if (category) {
    return db.select<PersonalCard[]>(
      'SELECT * FROM personal_cards WHERE user_id = $1 AND category = $2 ORDER BY sort_order, created_at DESC',
      [userId, category],
    )
  }
  return db.select<PersonalCard[]>(
    'SELECT * FROM personal_cards WHERE user_id = $1 ORDER BY category, sort_order, created_at DESC',
    [userId],
  )
}

export async function savePersonalCard(card: PersonalCard): Promise<void> {
  const db = await getDb()
  if (card.id) {
    await db.execute(
      'UPDATE personal_cards SET title = $1, content = $2, category = $3, is_sensitive = $4, icon = $5, updated_at = datetime("now") WHERE id = $6',
      [card.title, card.content, card.category, card.is_sensitive, card.icon, card.id],
    )
  } else {
    await db.execute(
      'INSERT INTO personal_cards (user_id, category, title, content, is_sensitive, icon) VALUES ($1, $2, $3, $4, $5, $6)',
      [card.user_id, card.category, card.title, card.content, card.is_sensitive, card.icon],
    )
  }
}

export async function deletePersonalCard(id: number): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM personal_cards WHERE id = $1', [id])
}

// ============ Data Export/Import ============

export async function exportAllData(userId: number): Promise<string> {
  const db = await getDb()
  const tasks = await db.select('SELECT * FROM tasks WHERE user_id = $1 ORDER BY date DESC', [userId])
  const notes = await db.select('SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC', [userId])
  const sessions = await db.select('SELECT * FROM ai_sessions WHERE user_id = $1 ORDER BY updated_at DESC', [userId])
  const cards = await db.select('SELECT * FROM personal_cards WHERE user_id = $1 ORDER BY category', [userId])
  const user = await getUser(userId)

  return JSON.stringify({
    version: '0.3.0',
    exportedAt: new Date().toISOString(),
    user: user ? { display_name: user.display_name, entry_date: user.entry_date, work_start_time: user.work_start_time, work_end_time: user.work_end_time, theme: user.theme, hitokoto_category: user.hitokoto_category } : null,
    tasks,
    notes,
    sessions,
    personalCards: cards,
  }, null, 2)
}

export async function importAllData(userId: number, jsonStr: string): Promise<{ tasks: number; notes: number; sessions: number; cards: number }> {
  const data = JSON.parse(jsonStr)
  const db = await getDb()

  let taskCount = 0, noteCount = 0, sessionCount = 0, cardCount = 0

  if (data.tasks) {
    for (const t of data.tasks) {
      await db.execute(
        'INSERT OR REPLACE INTO tasks (id, user_id, title, description, tag, priority, status, date, reminder, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [t.id, userId, t.title, t.description, t.tag, t.priority || 'medium', t.status, t.date, t.reminder, t.created_at, t.updated_at],
      )
      taskCount++
    }
  }

  if (data.notes) {
    for (const n of data.notes) {
      await db.execute(
        'INSERT OR REPLACE INTO notes (id, user_id, title, content, type, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [n.id, userId, n.title, n.content, n.type, n.created_at, n.updated_at],
      )
      noteCount++
    }
  }

  if (data.sessions) {
    for (const s of data.sessions) {
      await db.execute(
        'INSERT OR REPLACE INTO ai_sessions (id, user_id, title, messages, provider, system_prompt, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [s.id, userId, s.title, s.messages, s.provider, s.system_prompt || '', s.created_at, s.updated_at],
      )
      sessionCount++
    }
  }

  if (data.personalCards) {
    for (const c of data.personalCards) {
      await db.execute(
        'INSERT OR REPLACE INTO personal_cards (id, user_id, category, title, content, is_sensitive, icon, sort_order, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [c.id, userId, c.category, c.title, c.content, c.is_sensitive, c.icon, c.sort_order || 0, c.created_at, c.updated_at],
      )
      cardCount++
    }
  }

  return { tasks: taskCount, notes: noteCount, sessions: sessionCount, cards: cardCount }
}
