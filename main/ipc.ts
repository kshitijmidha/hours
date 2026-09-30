import { app, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ActivityTracker } from './tracker'
import type { Store } from './database'
import { THEME_COLORS } from '../shared/theme'
import type { AppearancePreference, CategoryName, ThemePayload, TimeRange } from '../shared/types'

export function registerIpc(store: Store, tracker: ActivityTracker, getWindow: () => Electron.BrowserWindow | null) {
  ipcMain.handle('dashboard:get', (_event, range: TimeRange, selectedDate: string) => store.getDashboardData(range, selectedDate, tracker.getStatus()))
  ipcMain.handle('apps:list', () => store.getAppDirectory())
  ipcMain.handle('apps:icon', async (_event, appId: number) => {
    const path = store.getAppPath(appId)
    if (!path || path.startsWith('demo://') || path.startsWith('unknown:')) return null
    try {
      const icon = await app.getFileIcon(path, { size: 'normal' })
      return icon.isEmpty() ? null : icon.toDataURL()
    } catch {
      return null
    }
  })
  ipcMain.handle('apps:set-category', (_event, appId: number, category: CategoryName) => store.setAppCategory(appId, category))
  ipcMain.handle('demo:seed', () => store.seedDemoData())
  ipcMain.handle('demo:remove', () => store.removeDemoData())

  ipcMain.handle('controls:get', () => store.getControls())
  ipcMain.handle('limits:set', (_event, targetType: 'app' | 'category', targetId: number, seconds: number | null) => store.setLimit(targetType, targetId, seconds))
  ipcMain.handle('downtime:set', (_event, settings: { enabled: boolean; start: string; end: string }) => store.setDowntime(settings))
  ipcMain.handle('downtime:allow', (_event, appId: number, allowed: boolean) => store.setAlwaysAllowed(appId, allowed))
  ipcMain.handle('tracker:pause', (_event, paused: boolean) => tracker.setPaused(paused))

  ipcMain.handle('data:delete', () => {
    const wasTracking = tracker.getStatus().tracking
    tracker.setPaused(true)
    store.deleteAllData()
    if (wasTracking) tracker.setPaused(false)
  })
  ipcMain.handle('data:export-csv', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Hours activity',
      defaultPath: join(app.getPath('documents'), `hours-activity-${new Date().toISOString().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV file', extensions: ['csv'] }],
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, store.exportCsv(), 'utf8')
    return true
  })

  ipcMain.handle('settings:get', () => ({
    appearance: store.getAppearance(),
    autoStart: store.getPreference('auto_start') !== 'false',
    onboardingComplete: store.isOnboardingComplete(),
    version: app.getVersion(),
  }))
  ipcMain.handle('settings:appearance', (_event, appearance: AppearancePreference) => store.setAppearance(appearance))
  ipcMain.handle('settings:auto-start', (_event, enabled: boolean) => {
    store.setPreference('auto_start', String(Boolean(enabled)))
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: ['--hidden'], path: process.execPath })
  })
  ipcMain.handle('settings:onboarding-complete', () => store.completeOnboarding())

  ipcMain.handle('theme:sync', (_event, payload: ThemePayload) => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    const safe = payload?.dark ? THEME_COLORS.dark : THEME_COLORS.light
    window.setTitleBarOverlay({ color: safe.titlebar, symbolColor: safe.symbol, height: 48 })
    window.setBackgroundColor(safe.background)
  })
}
