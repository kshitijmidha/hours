import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import type { CategoryName } from '../shared/types'

export interface ActiveSession {
  id: number
  appId: number
  startedAt: string
}

export interface SessionRow {
  appName: string
  durationSeconds: number
  startedAt: string
}

const categories: Array<{ name: CategoryName; color: string }> = [
  { name: 'Productivity', color: '#30D158' },
  { name: 'Social', color: '#BF5AF2' },
  { name: 'Entertainment', color: '#FF375F' },
  { name: 'Development', color: '#0A84FF' },
  { name: 'Browsing', color: '#64D2FF' },
  { name: 'Other', color: '#8E8E93' },
]

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
        duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0)
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
    for (const category of categories) insertCategory.run(category.name, category.color)
    // A session from a previous unclean shutdown should never keep accumulating.
    this.db.prepare("UPDATE sessions SET ended_at = COALESCE(ended_at, datetime('now')) WHERE ended_at IS NULL").run()
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
    const known = this.db.prepare('SELECT id, category_id FROM apps WHERE executable_path = ?').get(path) as { id: number; category_id: number | null } | undefined
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
      WHERE s.started_at >= ? ORDER BY s.started_at DESC
    `).all(today.toISOString()) as SessionRow[]
    const totalSeconds = rows.reduce((total, row) => total + row.durationSeconds, 0)
    const apps = new Set(rows.map((row) => row.appName))
    return {
      status: { tracking, idle, currentApp, todaySeconds: totalSeconds },
      totalSeconds,
      appCount: apps.size,
      sessions: rows.slice(0, 8),
    }
  }

  close() { this.db.close() }
}
