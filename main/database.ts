import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import type { AppDirectoryEntry, CategoryName, DashboardData, TimeRange, TrackerStatus, UsageApp, UsageBucket } from '../shared/types'

export interface ActiveSession {
  id: number
  appId: number
  startedAt: string
}

export const CATEGORIES: Array<{ name: CategoryName; color: string }> = [
  { name: 'Productivity', color: '#30D158' },
  { name: 'Social', color: '#BF5AF2' },
  { name: 'Entertainment', color: '#FF375F' },
  { name: 'Development', color: '#0A84FF' },
  { name: 'Browsing', color: '#64D2FF' },
  { name: 'Other', color: '#8E8E93' },
]

const categoryNames = CATEGORIES.map(({ name }) => name)
type SessionRecord = {
  app_id: number
  name: string
  executable_path: string
  category: CategoryName
  color: string
  window_title: string
  started_at: string
  ended_at: string | null
  duration_seconds: number
  is_demo: number
}

function localDay(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function nextBoundary(cursor: Date, range: TimeRange, end: Date) {
  const boundary = new Date(cursor)
  if (range === 'day') boundary.setHours(boundary.getHours() + 1, 0, 0, 0)
  else boundary.setHours(24, 0, 0, 0)
  return Math.min(boundary.getTime(), end.getTime())
}

function categoryTotals(): Record<CategoryName, number> {
  return Object.fromEntries(categoryNames.map((name) => [name, 0])) as Record<CategoryName, number>
}

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export class Store {
  private db: Database.Database

  constructor() {
    this.db = new Database(join(app.getPath('userData'), 'stilltime.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executable_path TEXT NOT NULL UNIQUE,
        category_id INTEGER REFERENCES categories(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        window_title TEXT NOT NULL DEFAULT '',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
        is_demo INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS sessions_started_at_idx ON sessions(started_at);
      CREATE TABLE IF NOT EXISTS limits (
        id INTEGER PRIMARY KEY,
        target_type TEXT NOT NULL CHECK (target_type IN ('app', 'category')),
        target_id INTEGER NOT NULL,
        daily_limit_seconds INTEGER NOT NULL CHECK (daily_limit_seconds > 0),
        UNIQUE (target_type, target_id)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    const insertCategory = this.db.prepare('INSERT OR IGNORE INTO categories(name, color) VALUES (?, ?)')
    for (const category of CATEGORIES) insertCategory.run(category.name, category.color)
    const sessionColumns = this.db.pragma('table_info(sessions)') as Array<{ name: string }>
    if (!sessionColumns.some(({ name }) => name === 'is_demo')) this.db.exec('ALTER TABLE sessions ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0')
    // A session from a previous unclean shutdown should never keep accumulating.
    this.db.prepare("UPDATE sessions SET ended_at = COALESCE(ended_at, datetime('now')) WHERE ended_at IS NULL").run()
    const initialized = this.getSetting('demo_seeded')
    const sessionCount = (this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }).count
    if (!initialized && sessionCount === 0) this.seedDemoData()
  }

  classify(name: string, executablePath: string): CategoryName {
    const key = `${name} ${executablePath}`.toLowerCase()
    if (/code|visual studio|webstorm|idea64|pycharm|devenv|terminal|powershell|cmd\.exe|github desktop/.test(key)) return 'Development'
    if (/word|excel|powerpoint|outlook|notion|slack|teams|zoom|figma|obsidian|onenote/.test(key)) return 'Productivity'
    if (/discord|instagram|whatsapp|telegram|facebook|messenger|snapchat|reddit|x\.com|twitter/.test(key)) return 'Social'
    if (/spotify|youtube|netflix|twitch|vlc|media player|prime video|disney/.test(key)) return 'Entertainment'
    if (/chrome|firefox|msedge|brave|opera|browser/.test(key)) return 'Browsing'
    return 'Other'
  }

  upsertApp(name: string, executablePath: string): number {
    const path = executablePath || `unknown:${name.toLowerCase()}`
    const known = this.db.prepare('SELECT id FROM apps WHERE executable_path = ?').get(path) as { id: number } | undefined
    if (known) {
      this.db.prepare('UPDATE apps SET name = ? WHERE id = ?').run(name, known.id)
      return known.id
    }
    const categoryName = this.classify(name, path)
    const category = this.db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName) as { id: number }
    const result = this.db.prepare('INSERT INTO apps(name, executable_path, category_id) VALUES (?, ?, ?)').run(name, path, category.id)
    return Number(result.lastInsertRowid)
  }

  startSession(appId: number, windowTitle: string, at = new Date()): ActiveSession {
    const result = this.db.prepare('INSERT INTO sessions(app_id, window_title, started_at) VALUES (?, ?, ?)').run(appId, windowTitle, at.toISOString())
    return { id: Number(result.lastInsertRowid), appId, startedAt: at.toISOString() }
  }

  updateSession(session: ActiveSession, title: string, at = new Date()): number {
    const seconds = Math.max(0, Math.floor((at.getTime() - new Date(session.startedAt).getTime()) / 1000))
    this.db.prepare('UPDATE sessions SET window_title = ?, duration_seconds = ? WHERE id = ?').run(title, seconds, session.id)
    return seconds
  }

  endSession(session: ActiveSession, title: string, at = new Date()): number {
    const seconds = Math.max(0, Math.floor((at.getTime() - new Date(session.startedAt).getTime()) / 1000))
    this.db.prepare('UPDATE sessions SET window_title = ?, ended_at = ?, duration_seconds = ? WHERE id = ?').run(title, at.toISOString(), seconds, session.id)
    return seconds
  }

  getTodaySnapshot(tracking: boolean, idle: boolean, currentApp: string | null) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rows = this.db.prepare(`
      SELECT a.name AS appName, s.duration_seconds AS durationSeconds, s.started_at AS startedAt
      FROM sessions s JOIN apps a ON a.id = s.app_id
      WHERE s.is_demo = 0 AND julianday(s.started_at) >= julianday(?) ORDER BY s.started_at DESC
    `).all(today.toISOString()) as Array<{ appName: string; durationSeconds: number; startedAt: string }>
    const totalSeconds = rows.reduce((total, row) => total + row.durationSeconds, 0)
    const apps = new Set(rows.map((row) => row.appName))
    return {
      status: { tracking, idle, currentApp, todaySeconds: totalSeconds },
      totalSeconds,
      appCount: apps.size,
      sessions: rows.slice(0, 8),
    }
  }

  getDashboardData(range: TimeRange, selectedDate: string, status: TrackerStatus): DashboardData {
    const selected = parseLocalDay(selectedDate)
    const start = new Date(selected)
    if (range === 'week') {
      const weekdayOffset = (selected.getDay() + 6) % 7
      start.setDate(start.getDate() - weekdayOffset)
    }
    const end = new Date(start)
    end.setDate(end.getDate() + (range === 'day' ? 1 : 7))

    const rows = this.readSessions(start, end)
    const appsById = new Map<number, UsageApp>()
    const categoryMap = new Map(CATEGORIES.map(({ name, color }) => [name, { name, color, seconds: 0, percent: 0 }]))
    const buckets: UsageBucket[] = range === 'day'
      ? Array.from({ length: 24 }, (_, hour) => ({
          key: `${hour}`,
          label: new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: 'numeric' }),
          totalSeconds: 0,
          categories: categoryTotals(),
        }))
      : Array.from({ length: 7 }, (_, day) => {
          const date = new Date(start)
          date.setDate(date.getDate() + day)
          return { key: localDay(date), label: date.toLocaleDateString(undefined, { weekday: 'short' }), totalSeconds: 0, categories: categoryTotals() }
        })

    let totalSeconds = 0
    let hasDemoData = false
    for (const row of rows) {
      const rawStart = new Date(row.started_at).getTime()
      const rawEnd = row.ended_at ? new Date(row.ended_at).getTime() : rawStart + row.duration_seconds * 1000
      let cursor = Math.max(rawStart, start.getTime())
      const sessionEnd = Math.min(rawEnd, end.getTime())
      if (sessionEnd <= cursor) continue
      const app = appsById.get(row.app_id) ?? {
        id: row.app_id,
        name: row.name,
        executablePath: row.executable_path,
        category: row.category,
        categoryColor: row.color,
        seconds: 0,
        sessionCount: 0,
        lastTitle: row.window_title,
      }
      app.seconds += (sessionEnd - cursor) / 1000
      app.sessionCount += 1
      appsById.set(row.app_id, app)
      categoryMap.get(row.category)!.seconds += (sessionEnd - cursor) / 1000
      totalSeconds += (sessionEnd - cursor) / 1000
      hasDemoData ||= row.is_demo === 1

      while (cursor < sessionEnd) {
        const boundary = nextBoundary(new Date(cursor), range, new Date(sessionEnd))
        const bucketKey = range === 'day' ? `${new Date(cursor).getHours()}` : localDay(new Date(cursor))
        const bucket = buckets.find((item) => item.key === bucketKey)
        if (bucket) {
          const seconds = (boundary - cursor) / 1000
          bucket.totalSeconds += seconds
          bucket.categories[row.category] += seconds
        }
        cursor = boundary
      }
    }

    const apps = [...appsById.values()].sort((a, b) => b.seconds - a.seconds)
    const categoriesList = [...categoryMap.values()]
      .map((category) => ({ ...category, percent: totalSeconds ? Math.round((category.seconds / totalSeconds) * 100) : 0 }))
      .sort((a, b) => b.seconds - a.seconds)
    const averageEnd = new Date(selected)
    averageEnd.setDate(averageEnd.getDate() + 1)
    const averageStart = new Date(averageEnd)
    averageStart.setDate(averageStart.getDate() - 7)
    const averageRows = this.readSessions(averageStart, averageEnd)
    let averageTotal = 0
    for (const row of averageRows) {
      const rowStart = new Date(row.started_at).getTime()
      const rowEnd = row.ended_at ? new Date(row.ended_at).getTime() : rowStart + row.duration_seconds * 1000
      averageTotal += Math.max(0, Math.min(rowEnd, averageEnd.getTime()) - Math.max(rowStart, averageStart.getTime())) / 1000
    }

    return {
      range,
      selectedDate,
      startDate: localDay(start),
      endDate: localDay(new Date(end.getTime() - 1)),
      totalSeconds: Math.round(totalSeconds),
      averageSeconds: Math.round(averageTotal / 7),
      appCount: apps.length,
      apps,
      categories: categoriesList,
      buckets,
      hasDemoData,
      status,
    }
  }

  getAppDirectory(): AppDirectoryEntry[] {
    return this.db.prepare(`
      SELECT a.id, a.name, a.executable_path AS executablePath, c.name AS category, c.color AS categoryColor
      FROM apps a JOIN categories c ON c.id = a.category_id
      ORDER BY a.name COLLATE NOCASE
    `).all() as AppDirectoryEntry[]
  }

  getAppPath(appId: number) {
    return (this.db.prepare('SELECT executable_path AS path FROM apps WHERE id = ?').get(appId) as { path: string } | undefined)?.path ?? null
  }

  setAppCategory(appId: number, categoryName: CategoryName) {
    const category = this.db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName) as { id: number } | undefined
    if (!category) throw new Error('Unknown category')
    this.db.prepare('UPDATE apps SET category_id = ? WHERE id = ?').run(category.id, appId)
  }

  seedDemoData() {
    this.db.prepare('DELETE FROM sessions WHERE is_demo = 1').run()
    const demoApps = [
      ['Visual Studio Code', 'demo://visual-studio-code'],
      ['Google Chrome', 'demo://google-chrome'],
      ['Spotify', 'demo://spotify'],
      ['Discord', 'demo://discord'],
      ['Notion', 'demo://notion'],
      ['YouTube', 'demo://youtube'],
      ['Figma', 'demo://figma'],
      ['Windows Terminal', 'demo://windows-terminal'],
    ] as const
    const appIds = demoApps.map(([name, path]) => this.upsertApp(name, path))
    const insert = this.db.prepare('INSERT INTO sessions(app_id, window_title, started_at, ended_at, duration_seconds, is_demo) VALUES (?, ?, ?, ?, ?, 1)')
    const random = seededRandom(20260615)
    const titleSeeds = ['Workspace', 'Project notes', 'Weekly planning', 'Focus playlist', 'Design system', 'Reading list', 'Inbox', 'Sprint board']
    const seed = this.db.transaction(() => {
      const today = new Date()
      for (let age = 13; age >= 0; age--) {
        const date = new Date(today)
        date.setDate(today.getDate() - age)
        date.setHours(0, 0, 0, 0)
        let cursor = new Date(date)
        cursor.setHours(8 + Math.floor(random() * 2), Math.floor(random() * 45), 0, 0)
        const segments = 9 + Math.floor(random() * 7)
        for (let index = 0; index < segments; index++) {
          const appIndex = index === 0 ? 0 : Math.floor(random() * appIds.length)
          const duration = 12 + Math.floor(random() * 50)
          const start = new Date(cursor)
          const finish = new Date(start.getTime() + duration * 60_000)
          if (start > today) break
          const cappedFinish = finish > today ? today : finish
          const seconds = Math.max(60, Math.floor((cappedFinish.getTime() - start.getTime()) / 1000))
          const title = titleSeeds[(index + age) % titleSeeds.length]
          insert.run(appIds[appIndex], title, start.toISOString(), new Date(start.getTime() + seconds * 1000).toISOString(), seconds)
          cursor = new Date(cappedFinish.getTime() + (5 + Math.floor(random() * 28)) * 60_000)
          if (cursor > today) break
        }
      }
      this.setSetting('demo_seeded', 'true')
    })
    seed()
  }

  private getSetting(key: string) {
    return (this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value
  }

  private setSetting(key: string, value: string) {
    this.db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  private readSessions(start: Date, end: Date) {
    return this.db.prepare(`
      SELECT s.app_id, a.name, a.executable_path, c.name AS category, c.color, s.window_title,
        s.started_at, s.ended_at, s.duration_seconds, s.is_demo
      FROM sessions s JOIN apps a ON a.id = s.app_id JOIN categories c ON c.id = a.category_id
      WHERE julianday(s.started_at) < julianday(?)
        AND julianday(COALESCE(s.ended_at, datetime(s.started_at, '+' || s.duration_seconds || ' seconds'))) > julianday(?)
      ORDER BY s.started_at
    `).all(end.toISOString(), start.toISOString()) as SessionRecord[]
  }

  close() { this.db.close() }
}
