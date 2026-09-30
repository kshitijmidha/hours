import { powerMonitor } from 'electron'
import type { Store } from './database'
import type { TrackerStatus } from '../shared/types'
import { getForegroundWindow } from './windows-foreground'

const POLL_INTERVAL_MS = 2_000
const FLUSH_INTERVAL_MS = 10_000
const IDLE_AFTER_SECONDS = 120
const STATUS_THROTTLE_MS = 1_500

interface OpenSession {
  id: number
  appId: number
  startedAt: number
  title: string
}

export class ActivityTracker {
  private pollTimer: NodeJS.Timeout | undefined
  private flushTimer: NodeJS.Timeout | undefined
  private session: OpenSession | null = null
  private paused = false
  private idle = false
  private currentAppId: number | null = null
  private currentApp: string | null = null
  private listeners = new Set<(status: TrackerStatus) => void>()
  private lastStatusPush = 0
  private polling = false
  private lifecycle = 0

  constructor(private store: Store) {}

  start() {
    if (this.pollTimer) return
    const lifecycle = ++this.lifecycle
    void this.poll(lifecycle)
    this.pollTimer = setInterval(() => void this.poll(this.lifecycle), POLL_INTERVAL_MS)
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
  }

  stop() {
    this.lifecycle++
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.pollTimer = undefined
    this.flushTimer = undefined
    this.endSession(Date.now())
    this.emit(true)
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    this.lifecycle++
    if (paused) {
      this.endSession(Date.now())
      this.flush()
    } else {
      void this.poll(this.lifecycle)
    }
    this.emit(true)
  }

  onStatus(listener: (status: TrackerStatus) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): TrackerStatus {
    return this.store.getTodayStatus(!this.paused, this.idle, this.currentApp, this.currentAppId)
  }

  handleInterruption(reason: 'suspend' | 'lock') {
    this.endSession(Date.now())
    this.idle = true
    this.flush()
    this.emit(true)
    void reason
  }

  private isSelf(processId: number, path: string | null) {
    if (processId === process.pid) return true
    if (!path) return false
    return path.toLowerCase() === process.execPath.toLowerCase()
  }

  private async poll(lifecycle: number) {
    if (this.paused || this.polling) return
    this.polling = true
    try {
      const idleSeconds = powerMonitor.getSystemIdleTime()
      if (idleSeconds >= IDLE_AFTER_SECONDS) {
        if (!this.idle || this.session) {
          // Stop exactly when input stopped, not when the poll noticed it.
          this.endSession(Date.now() - idleSeconds * 1000)
          this.flush()
        }
        this.idle = true
        this.emit()
        return
      }
      this.idle = false

      const foreground = await getForegroundWindow()
      if (this.paused || this.lifecycle !== lifecycle) return
      if (!foreground) {
        this.endSession(Date.now())
        this.emit()
        return
      }
      // Stilltime should never count its own window: it is not something you "use".
      if (this.isSelf(foreground.processId, foreground.path)) {
        this.endSession(Date.now())
        this.currentApp = null
        this.currentAppId = null
        this.emit()
        return
      }

      const appId = this.store.upsertApp(foreground.name, foreground.path ?? `unknown:${foreground.executable.replace(/\.exe$/i, '').toLowerCase()}`)
      if (!this.session || this.session.appId !== appId) {
        this.endSession(Date.now())
        this.session = {
          id: this.store.startSession(appId, foreground.title),
          appId,
          startedAt: Date.now(),
          title: foreground.title,
        }
      } else if (this.session.title !== foreground.title) {
        this.session.title = foreground.title
      }

      this.currentAppId = appId
      this.currentApp = foreground.name
      this.emit()
    } catch (error) {
      console.warn('[stilltime] Could not read the foreground window:', error)
      this.endSession(Date.now())
      this.emit()
    } finally {
      this.polling = false
    }
  }

  private flush() {
    if (!this.session) return
    const durationSeconds = Math.max(0, Math.floor((Date.now() - this.session.startedAt) / 1000))
    this.store.progressSession(this.session.id, this.session.title, durationSeconds)
  }

  private endSession(endedAt: number) {
    if (!this.session) return
    const durationSeconds = Math.max(0, Math.floor((endedAt - this.session.startedAt) / 1000))
    this.store.finishSession(this.session.id, this.session.title, new Date(endedAt), durationSeconds)
    this.session = null
    this.currentAppId = null
    this.currentApp = null
  }

  private emit(force = false) {
    const now = Date.now()
    if (!force && now - this.lastStatusPush < STATUS_THROTTLE_MS) return
    this.lastStatusPush = now
    const status = this.getStatus()
    for (const listener of this.listeners) listener(status)
  }
}
