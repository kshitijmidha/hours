import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import type {
  AppDirectoryEntry, AppLimit, AppearancePreference, CategoryName, ControlSnapshot, DashboardData,
  DowntimeSettings, LimitTargetType, TimeRange, TrackerStatus, TrendPoint, UsageApp, UsageBucket,
} from '../shared/types'

export const CATEGORIES: Array<{ name: CategoryName; color: string }> = [
  { name: 'Productivity', color: '#30D158' },
  { name: 'Social', color: '#BF5AF2' },
  { name: 'Entertainment', color: '#FF375F' },
  { name: 'Development', color: '#0A84FF' },
  { name: 'Browsing', color: '#64D2FF' },
  { name: 'Other', color: '#8E8E93' },
]

const categoryNames = CATEGORIES.map(({ name }) => name)

interface SessionRecord {
  app_id: number
  name: string
  executable_path: string
  category: CategoryName
  color: string
  window_title: string
  started_at: string
  ended_at: string | null
  is_demo: number
}

interface DaySpan {
  start: Date
  end: Date
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

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
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

function sessionEnd(row: SessionRecord) {
  return row.ended_at ? Date.parse(row.ended_at) : Date.now()
}

function overlapSeconds(row: SessionRecord, fromMs: number, toMs: number) {
  const start = Math.max(Date.parse(row.started_at), fromMs)
  const end = Math.min(sessionEnd(row), toMs)
  return Math.max(0, (end - start) / 1000)
}

export class Store {
  private db: Database.Database
  private appCache = new Map<string, number>()

  constructor() {
    this.db = new Database(join(app.getPath('userData'), 'hours.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
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
      CREATE TABLE IF NOT EXISTS always_allowed (
        app_id INTEGER PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS limit_notifications (
        limit_id INTEGER NOT NULL REFERENCES limits(id) ON DELETE CASCADE,
        local_date TEXT NOT NULL,
        threshold INTEGER NOT NULL,
        PRIMARY KEY (limit_id, local_date, threshold)
      );
      CREATE TABLE IF NOT EXISTS downtime_notifications (
        app_id INTEGER NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
        window_key TEXT NOT NULL,
        PRIMARY KEY (app_id, window_key)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    const insertCategory = this.db.prepare('INSERT OR IGNORE INTO categories(name, color) VALUES (?, ?)')
    for (const category of CATEGORIES) insertCategory.run(category.name, category.color)

    const sessionColumns = this.db.pragma('table_info(sessions)') as Array<{ name: string }>
    if (!sessionColumns.some(({ name }) => name === 'is_demo')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0')
    }
    // Older builds wrote crash-recovered timestamps without a timezone marker; SQLite wrote those in UTC.
    this.db.prepare(`
      UPDATE sessions SET ended_at = REPLACE(ended_at, ' ', 'T') || 'Z'
      WHERE ended_at IS NOT NULL AND ended_at NOT LIKE '%Z' AND ended_at LIKE '% %'
    `).run()
    this.db.prepare(`
      UPDATE sessions SET started_at = REPLACE(started_at, ' ', 'T') || 'Z'
      WHERE started_at NOT LIKE '%Z' AND started_at LIKE '% %'
    `).run()
    // Sessions left open by a previous unclean shutdown end where their last saved duration ends.
    this.db.prepare(`
      UPDATE sessions
      SET ended_at = CASE WHEN duration_seconds > 0
        THEN strftime('%Y-%m-%dT%H:%M:%fZ', started_at, '+' || duration_seconds || ' seconds')
        ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END
      WHERE ended_at IS NULL
    `).run()
    // Windows paths are case-insensitive; merge entries that only differ by case.
    const duplicates = this.db.prepare(`
      SELECT LOWER(executable_path) AS key, COUNT(*) AS count FROM apps
      GROUP BY LOWER(executable_path) HAVING COUNT(*) > 1
    `).all() as Array<{ key: string }>
    if (duplicates.length) {
      const merge = this.db.transaction(() => {
        for (const { key } of duplicates) {
          const rows = this.db.prepare('SELECT id FROM apps WHERE LOWER(executable_path) = ? ORDER BY id').all(key) as Array<{ id: number }>
          const [keep, ...rest] = rows
          if (!keep) continue
          for (const row of rest) {
            this.db.prepare('UPDATE sessions SET app_id = ? WHERE app_id = ?').run(keep.id, row.id)
            this.db.prepare('UPDATE limits SET target_id = ? WHERE target_type = ? AND target_id = ?').run(keep.id, 'app', row.id)
            this.db.prepare('DELETE FROM apps WHERE id = ?').run(row.id)
          }
        }
      })
      merge()
    }
    // Version 2 replaced the sampling engine and fixed duplicate/overlapping rows from the old
    // process-based tracker. Old rows cannot be trusted, so start from a clean slate exactly once.
    if (this.getPreference('data_reset_v2') !== 'true') {
      const reset = this.db.transaction(() => {
        this.db.prepare('DELETE FROM sessions').run()
        this.db.prepare('DELETE FROM apps').run()
        this.db.prepare("DELETE FROM limits WHERE target_type = 'app'").run()
        this.db.prepare('DELETE FROM downtime_notifications').run()
        this.setPreference('demo_seeded', 'true')
        this.setPreference('data_reset_v2', 'true')
      })
      reset()
    }
    // Forget any history recorded for Hours itself (from older builds that tracked everything).
    const selfApps = this.db.prepare(`
      SELECT id FROM apps WHERE LOWER(executable_path) = ? OR LOWER(name) IN ('stilltime', 'hours')
    `).all(process.execPath.toLowerCase()) as Array<{ id: number }>
    if (selfApps.length) {
      const removeSelf = this.db.transaction(() => {
        for (const { id } of selfApps) {
          this.db.prepare('DELETE FROM sessions WHERE app_id = ?').run(id)
          this.db.prepare('DELETE FROM limits WHERE target_type = ? AND target_id = ?').run('app', id)
          this.db.prepare('DELETE FROM always_allowed WHERE app_id = ?').run(id)
          this.db.prepare('DELETE FROM apps WHERE id = ?').run(id)
        }
      })
      removeSelf()
    }
    for (const row of this.db.prepare('SELECT id, executable_path FROM apps').all() as Array<{ id: number; executable_path: string }>) {
      this.appCache.set(row.executable_path.toLowerCase(), row.id)
    }

    const initialized = this.getPreference('demo_seeded')
    const sessionCount = (this.db.prepare('SELECT COUNT(*) AS count FROM sessions').get() as { count: number }).count
    if (!initialized && sessionCount === 0) this.seedDemoData()
  }

  classify(name: string, executablePath: string): CategoryName {
    const key = `${name} ${executablePath}`.toLowerCase()
    if (/code|visual studio|webstorm|idea64|pycharm|devenv|terminal|powershell|cmd\.exe|github desktop|intellij|rider64|goland|clion|sublime/.test(key)) return 'Development'
    if (/word|excel|powerpoint|outlook|notion|slack|teams|zoom|figma|obsidian|onenote|todoist|trello|asana|miro/.test(key)) return 'Productivity'
    if (/discord|instagram|whatsapp|telegram|facebook|messenger|snapchat|reddit|twitter|linkedin|messenger/.test(key)) return 'Social'
    if (/spotify|youtube|netflix|twitch|vlc|media player|prime video|disney|potplayer|mpv|hulu|music\.apple/.test(key)) return 'Entertainment'
    if (/chrome|firefox|msedge|brave|opera|browser|vivaldi|arc\.exe/.test(key)) return 'Browsing'
    return 'Other'
  }

  upsertApp(name: string, executablePath: string): number {
    const path = executablePath || `unknown:${name.toLowerCase()}`
    const key = path.toLowerCase()
    const cached = this.appCache.get(key)
    if (cached !== undefined) return cached
    const known = this.db.prepare('SELECT id FROM apps WHERE LOWER(executable_path) = ?').get(key) as { id: number } | undefined
    if (known) {
      this.appCache.set(key, known.id)
      return known.id
    }
    const categoryName = this.classify(name, path)
    const category = this.db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName) as { id: number }
    const result = this.db.prepare('INSERT INTO apps(name, executable_path, category_id) VALUES (?, ?, ?)').run(name, path, category.id)
    const id = Number(result.lastInsertRowid)
    this.appCache.set(key, id)
    return id
  }

  startSession(appId: number, title: string, at = new Date()): number {
    const result = this.db.prepare('INSERT INTO sessions(app_id, window_title, started_at) VALUES (?, ?, ?)').run(appId, title, at.toISOString())
    return Number(result.lastInsertRowid)
  }

  progressSession(id: number, title: string, durationSeconds: number) {
    this.db.prepare('UPDATE sessions SET window_title = ?, duration_seconds = ? WHERE id = ? AND ended_at IS NULL').run(title, durationSeconds, id)
  }

  finishSession(id: number, title: string, endedAt: Date, durationSeconds: number) {
    this.db.prepare('UPDATE sessions SET window_title = ?, ended_at = ?, duration_seconds = ? WHERE id = ?').run(title, endedAt.toISOString(), durationSeconds, id)
  }

  getTodayStatus(tracking: boolean, idle: boolean, currentApp: string | null, currentAppId: number | null): TrackerStatus {
    const start = startOfDay(new Date())
    const end = addDays(start, 1)
    let totalSeconds = 0
    for (const row of this.readSessions(start, end)) {
      if (row.is_demo) continue
      totalSeconds += overlapSeconds(row, start.getTime(), end.getTime())
    }
    return { tracking, idle, currentApp, currentAppId, todaySeconds: Math.round(totalSeconds) }
  }

  getDashboardData(range: TimeRange, selectedDate: string, status: TrackerStatus): DashboardData {
    const selected = parseLocalDay(selectedDate)
    const start = range === 'week' ? addDays(startOfDay(selected), -((selected.getDay() + 6) % 7)) : startOfDay(selected)
    const end = addDays(start, range === 'day' ? 1 : 7)

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
      : Array.from({ length: 7 }, (_, index) => {
          const date = addDays(start, index)
          return {
            key: localDay(date),
            label: date.toLocaleDateString(undefined, { weekday: 'short' }),
            totalSeconds: 0,
            categories: categoryTotals(),
          }
        })

    let totalSeconds = 0
    let hasDemoData = false
    for (const row of rows) {
      const startedMs = Date.parse(row.started_at)
      const endedMs = sessionEnd(row)
      if (endedMs <= Math.max(startedMs, start.getTime())) continue
      const from = Math.max(startedMs, start.getTime())
      const to = Math.min(endedMs, end.getTime())
      const seconds = Math.max(0, (to - from) / 1000)

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
      app.seconds += seconds
      app.sessionCount += 1
      app.lastTitle = row.window_title || app.lastTitle
      appsById.set(row.app_id, app)
      categoryMap.get(row.category)!.seconds += seconds
      totalSeconds += seconds
      hasDemoData ||= row.is_demo === 1

      let cursor = from
      while (cursor < to) {
        const cursorDate = new Date(cursor)
        const boundary = range === 'day'
          ? Math.min(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate(), cursorDate.getHours() + 1).getTime(), to)
          : Math.min(addDays(startOfDay(cursorDate), 1).getTime(), to)
        if (boundary <= cursor) break
        const bucketKey = range === 'day' ? `${cursorDate.getHours()}` : localDay(cursorDate)
        const bucket = buckets.find((item) => item.key === bucketKey)
        if (bucket) {
          const bucketSeconds = (boundary - cursor) / 1000
          bucket.totalSeconds += bucketSeconds
          bucket.categories[row.category] += bucketSeconds
        }
        cursor = boundary
      }
    }

    const apps = [...appsById.values()].sort((a, b) => b.seconds - a.seconds)
    const categoryList = [...categoryMap.values()]
      .map((category) => ({ ...category, percent: totalSeconds ? Math.round((category.seconds / totalSeconds) * 100) : 0 }))
      .sort((a, b) => b.seconds - a.seconds)

    // Trailing seven-day average, excluding the selected day itself.
    const averageWindow: DaySpan = { start: addDays(start, -7), end: start }
    const averageDays = this.dailyTotals(averageWindow, 7)
    const averageSeconds = averageDays.reduce((total, value) => total + value, 0) / 7

    const trend: TrendPoint[] = range === 'week'
      ? buckets.map((bucket) => ({
          date: bucket.key,
          label: new Date(`${bucket.key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }),
          seconds: Math.round(bucket.totalSeconds),
        }))
      : (() => {
          const trendStart = addDays(start, -6)
          const values = this.dailyTotals({ start: trendStart, end: addDays(start, 1) }, 7)
          return values.map((seconds, index) => {
            const date = addDays(trendStart, index)
            return { date: localDay(date), label: date.toLocaleDateString(undefined, { weekday: 'narrow' }), seconds: Math.round(seconds) }
          })
        })()

    return {
      range,
      selectedDate,
      startDate: localDay(start),
      endDate: localDay(addDays(end, -1)),
      totalSeconds: Math.round(totalSeconds),
      averageSeconds: Math.round(averageSeconds),
      appCount: apps.length,
      apps,
      categories: categoryList,
      buckets,
      trend,
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

  getControls(): ControlSnapshot {
    const apps = this.getAppDirectory()
    const start = startOfDay(new Date())
    const end = addDays(start, 1)
    const appUsage = new Map<number, number>()
    const categoryUsage = new Map<CategoryName, number>()
    for (const row of this.readSessions(start, end)) {
      if (row.is_demo) continue
      const seconds = overlapSeconds(row, start.getTime(), end.getTime())
      appUsage.set(row.app_id, (appUsage.get(row.app_id) ?? 0) + seconds)
      categoryUsage.set(row.category, (categoryUsage.get(row.category) ?? 0) + seconds)
    }
    const limitRows = this.db.prepare(`
      SELECT l.id, l.target_type AS targetType, l.target_id AS targetId, l.daily_limit_seconds AS dailyLimitSeconds,
        CASE WHEN l.target_type = 'app' THEN a.name ELSE c.name END AS targetName,
        CASE WHEN l.target_type = 'app' THEN appCategory.color ELSE c.color END AS color
      FROM limits l
      LEFT JOIN apps a ON l.target_type = 'app' AND a.id = l.target_id
      LEFT JOIN categories appCategory ON appCategory.id = a.category_id
      LEFT JOIN categories c ON l.target_type = 'category' AND c.id = l.target_id
      ORDER BY targetName COLLATE NOCASE
    `).all() as Array<{ id: number; targetType: LimitTargetType; targetId: number; targetName: string; color: string; dailyLimitSeconds: number }>
    const limits: AppLimit[] = limitRows.filter((item) => item.targetName).map((item) => {
      const usedSeconds = Math.round(item.targetType === 'app' ? appUsage.get(item.targetId) ?? 0 : categoryUsage.get(item.targetName as CategoryName) ?? 0)
      return { ...item, usedSeconds, percent: Math.round((usedSeconds / item.dailyLimitSeconds) * 100) }
    })
    const alwaysAllowedIds = (this.db.prepare('SELECT app_id AS id FROM always_allowed').all() as Array<{ id: number }>).map(({ id }) => id)
    return {
      limits,
      apps,
      categories: this.db.prepare('SELECT id, name, color FROM categories ORDER BY id').all() as Array<{ id: number; name: CategoryName; color: string }>,
      alwaysAllowedIds,
      downtime: {
        enabled: this.getPreference('downtime_enabled') === 'true',
        start: this.getPreference('downtime_start') ?? '23:00',
        end: this.getPreference('downtime_end') ?? '07:00',
      },
    }
  }

  setLimit(targetType: LimitTargetType, targetId: number, dailyLimitSeconds: number | null) {
    if (dailyLimitSeconds === null) {
      this.db.prepare('DELETE FROM limits WHERE target_type = ? AND target_id = ?').run(targetType, targetId)
      return
    }
    if (!Number.isInteger(dailyLimitSeconds) || dailyLimitSeconds <= 0) throw new Error('A limit must be a positive number of seconds')
    if (targetType === 'app' && !this.getAppPath(targetId)) throw new Error('Unknown app')
    if (targetType === 'category' && !this.db.prepare('SELECT id FROM categories WHERE id = ?').get(targetId)) throw new Error('Unknown category')
    this.db.prepare(`
      INSERT INTO limits(target_type, target_id, daily_limit_seconds) VALUES (?, ?, ?)
      ON CONFLICT(target_type, target_id) DO UPDATE SET daily_limit_seconds = excluded.daily_limit_seconds
    `).run(targetType, targetId, dailyLimitSeconds)
  }

  setDowntime(settings: DowntimeSettings) {
    const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    if (!validTime(settings.start) || !validTime(settings.end)) throw new Error('Downtime requires valid start and end times')
    this.setPreference('downtime_enabled', String(settings.enabled))
    this.setPreference('downtime_start', settings.start)
    this.setPreference('downtime_end', settings.end)
  }

  setAlwaysAllowed(appId: number, allowed: boolean) {
    if (!this.getAppPath(appId)) throw new Error('Unknown app')
    if (allowed) this.db.prepare('INSERT OR IGNORE INTO always_allowed(app_id) VALUES (?)').run(appId)
    else this.db.prepare('DELETE FROM always_allowed WHERE app_id = ?').run(appId)
  }

  recordLimitNotification(limitId: number, localDate: string, threshold: number) {
    return this.db.prepare('INSERT OR IGNORE INTO limit_notifications(limit_id, local_date, threshold) VALUES (?, ?, ?)').run(limitId, localDate, threshold).changes === 1
  }

  recordDowntimeNotification(appId: number, windowKey: string) {
    return this.db.prepare('INSERT OR IGNORE INTO downtime_notifications(app_id, window_key) VALUES (?, ?)').run(appId, windowKey).changes === 1
  }

  isAlwaysAllowed(appId: number) {
    return Boolean(this.db.prepare('SELECT 1 FROM always_allowed WHERE app_id = ?').get(appId))
  }

  getAppName(appId: number) {
    return (this.db.prepare('SELECT name FROM apps WHERE id = ?').get(appId) as { name: string } | undefined)?.name ?? 'An app'
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
        const date = addDays(startOfDay(today), -age)
        let cursor = new Date(date)
        cursor.setHours(8 + Math.floor(random() * 2), Math.floor(random() * 45), 0, 0)
        const segments = 9 + Math.floor(random() * 7)
        for (let index = 0; index < segments; index++) {
          const appIndex = index === 0 ? 0 : Math.floor(random() * appIds.length)
          const duration = 12 + Math.floor(random() * 50)
          const sessionStart = new Date(cursor)
          const finish = new Date(sessionStart.getTime() + duration * 60_000)
          if (sessionStart > today) break
          const cappedFinish = finish > today ? today : finish
          const seconds = Math.max(60, Math.floor((cappedFinish.getTime() - sessionStart.getTime()) / 1000))
          insert.run(appIds[appIndex], titleSeeds[(index + age) % titleSeeds.length], sessionStart.toISOString(), new Date(sessionStart.getTime() + seconds * 1000).toISOString(), seconds)
          cursor = new Date(cappedFinish.getTime() + (5 + Math.floor(random() * 28)) * 60_000)
          if (cursor > today) break
        }
      }
      this.setPreference('demo_seeded', 'true')
    })
    seed()
  }

  removeDemoData() {
    this.db.prepare('DELETE FROM sessions WHERE is_demo = 1').run()
    this.db.prepare("DELETE FROM apps WHERE executable_path LIKE 'demo://%' AND id NOT IN (SELECT app_id FROM sessions)").run()
    for (const [path, id] of [...this.appCache]) {
      if (!this.db.prepare('SELECT 1 FROM apps WHERE id = ?').get(id)) this.appCache.delete(path)
    }
  }

  deleteAllData() {
    const clear = this.db.transaction(() => {
      this.db.prepare('DELETE FROM sessions').run()
      this.db.prepare('DELETE FROM limits').run()
      this.db.prepare('DELETE FROM apps').run()
      this.db.prepare('DELETE FROM limit_notifications').run()
      this.db.prepare('DELETE FROM downtime_notifications').run()
      this.setPreference('demo_seeded', 'true')
    })
    clear()
    this.appCache.clear()
  }

  getAppearance(): AppearancePreference {
    const value = this.getPreference('appearance')
    return value === 'light' || value === 'dark' ? value : 'system'
  }

  setAppearance(value: AppearancePreference) {
    this.setPreference('appearance', value)
  }

  isOnboardingComplete() {
    return this.getPreference('onboarding_complete') === 'true'
  }

  completeOnboarding() {
    this.setPreference('onboarding_complete', 'true')
  }

  getPreference(key: string) {
    return (this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value
  }

  setPreference(key: string, value: string) {
    this.db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  }

  exportCsv() {
    const rows = this.db.prepare(`
      SELECT a.name AS app, a.executable_path AS executable, s.window_title AS title,
        s.started_at AS started, s.ended_at AS ended,
        CAST(ROUND((julianday(COALESCE(s.ended_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))) - julianday(s.started_at)) * 86400) AS INTEGER) AS duration,
        c.name AS category, s.is_demo AS demo
      FROM sessions s JOIN apps a ON a.id = s.app_id JOIN categories c ON c.id = a.category_id
      ORDER BY s.started_at
    `).all() as Array<{ app: string; executable: string; title: string; started: string; ended: string | null; duration: number; category: string; demo: number }>
    const field = (value: unknown) => {
      const text = String(value ?? '')
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
      return `"${safe.replace(/"/g, '""')}"`
    }
    const output = [
      ['App', 'Executable path', 'Window title', 'Started at', 'Ended at', 'Duration (seconds)', 'Category', 'Sample data'].map(field).join(','),
      ...rows.map((row) => [row.app, row.executable, row.title, row.started, row.ended ?? '', row.duration, row.category, row.demo ? 'yes' : 'no'].map(field).join(',')),
    ]
    return `\uFEFF${output.join('\r\n')}`
  }

  close() {
    this.db.close()
  }

  private dailyTotals(window: DaySpan, days: number) {
    const indexByKey = new Map(Array.from({ length: days }, (_, index) => [localDay(addDays(window.start, index)), index]))
    const totals = new Array<number>(days).fill(0)
    for (const row of this.readSessions(window.start, window.end)) {
      let cursor = Math.max(Date.parse(row.started_at), window.start.getTime())
      const clippedEnd = Math.min(sessionEnd(row), window.end.getTime())
      while (cursor < clippedEnd) {
        const cursorDate = new Date(cursor)
        const boundary = Math.min(addDays(startOfDay(cursorDate), 1).getTime(), clippedEnd)
        if (boundary <= cursor) break
        const index = indexByKey.get(localDay(cursorDate))
        if (index !== undefined) totals[index] += (boundary - cursor) / 1000
        cursor = boundary
      }
    }
    return totals
  }

  private readSessions(start: Date, end: Date) {
    return this.db.prepare(`
      SELECT s.app_id, a.name, a.executable_path, c.name AS category, c.color, s.window_title,
        s.started_at, s.ended_at, s.is_demo
      FROM sessions s JOIN apps a ON a.id = s.app_id JOIN categories c ON c.id = a.category_id
      WHERE julianday(s.started_at) < julianday(?)
        AND COALESCE(julianday(s.ended_at), julianday('now')) > julianday(?)
      ORDER BY s.started_at
    `).all(end.toISOString(), start.toISOString()) as SessionRecord[]
  }
}
