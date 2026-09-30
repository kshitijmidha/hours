import { powerMonitor } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Store, ActiveSession } from './database'
import type { TrackerStatus } from '../shared/types'

const POLL_INTERVAL_MS = 2_000
const IDLE_AFTER_SECONDS = 120
const execFileAsync = promisify(execFile)

interface ActiveWindowInfo {
  title?: string
  owner?: { name?: string; path?: string }
}

async function readWindowsActiveWindow(): Promise<ActiveWindowInfo | undefined> {
  const script = `$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class StilltimeWindow {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
Add-Type -TypeDefinition $source -ErrorAction SilentlyContinue
$handle = [StilltimeWindow]::GetForegroundWindow()
$processId = 0
[void][StilltimeWindow]::GetWindowThreadProcessId($handle, [ref]$processId)
$p = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($p) {
  $text = New-Object System.Text.StringBuilder 1024
  [void][StilltimeWindow]::GetWindowText($handle, $text, $text.Capacity)
  $path = ''
  try { $path = $p.Path } catch {}
  [PSCustomObject]@{ title = $text.ToString(); owner = @{ name = $p.ProcessName; path = $path } } | ConvertTo-Json -Compress -Depth 3
}`
  const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    timeout: 1_500,
    maxBuffer: 64 * 1024,
  })
  if (!stdout.trim()) return undefined
  return JSON.parse(stdout) as ActiveWindowInfo
}

export class ActivityTracker {
  private timer: NodeJS.Timeout | undefined
  private activeSession: ActiveSession | null = null
  private currentTitle = ''
  private currentApp: string | null = null
  private paused = false
  private idle = false
  private listeners = new Set<(status: TrackerStatus) => void>()
  private lastStatusPush = 0
  private polling = false

  constructor(private store: Store) {}

  start() {
    void this.poll()
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.closeActive()
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) this.closeActive()
    else void this.poll()
    this.emit()
  }

  onStatus(listener: (status: TrackerStatus) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus(): TrackerStatus {
    const snapshot = this.store.getTodaySnapshot(!this.paused, this.idle, this.currentApp)
    return snapshot.status
  }

  private async poll() {
    if (this.paused || this.polling) return
    this.polling = true
    try {
      const idleNow = powerMonitor.getSystemIdleTime() >= IDLE_AFTER_SECONDS
      if (idleNow) {
        this.idle = true
        this.closeActive()
        this.emit()
        return
      }
      this.idle = false
      // active-win is ESM-only; load lazily so Electron can start immediately.
      const { default: activeWin } = await import('active-win')
      let active = await activeWin() as ActiveWindowInfo | undefined
      // active-win ships a native addon which can be unavailable in unsigned/dev builds.
      // Use the Windows foreground-window API as a transparent local fallback.
      if (!active && process.platform === 'win32') active = await readWindowsActiveWindow()
      if (!active?.owner?.name) {
        this.closeActive()
        this.emit()
        return
      }
      const name = active.owner.name.replace(/\.exe$/i, '') || 'Unknown app'
      const executablePath = active.owner.path || `unknown:${name.toLowerCase()}`
      const appId = this.store.upsertApp(name, executablePath)
      const title = active.title || ''
      if (!this.activeSession || this.activeSession.appId !== appId) {
        this.closeActive()
        this.activeSession = this.store.startSession(appId, title)
      } else {
        this.store.updateSession(this.activeSession, title)
      }
      this.currentTitle = title
      this.currentApp = name
      this.emit()
    } catch (error) {
      // A denied OS permission or a transient API error should not stop the tracker.
      console.warn('[stilltime] Could not read the active window:', error)
      this.closeActive()
      this.emit()
    } finally {
      this.polling = false
    }
  }

  private closeActive() {
    if (this.activeSession) this.store.endSession(this.activeSession, this.currentTitle)
    this.activeSession = null
    this.currentTitle = ''
    this.currentApp = null
  }

  private emit() {
    const now = Date.now()
    if (now - this.lastStatusPush < 1500) return
    this.lastStatusPush = now
    const status = this.getStatus()
    for (const listener of this.listeners) listener(status)
  }
}
