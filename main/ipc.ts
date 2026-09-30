import { app, ipcMain, shell, systemPreferences, dialog } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ActivityTracker } from './tracker'
import type { Store } from './database'
import type { AppearancePreference, CategoryName, TimeRange } from '../shared/types'

export function registerIpc(store: Store, tracker: ActivityTracker) {
  ipcMain.handle('dashboard:get', (_event, range: TimeRange, selectedDate: string) => store.getDashboardData(range, selectedDate, tracker.getStatus()))
  ipcMain.handle('apps:list', () => store.getAppDirectory())
  ipcMain.handle('apps:icon', async (_event, appId: number) => {
    const path = store.getAppPath(appId)
    if (!path || path.startsWith('demo://') || path.startsWith('unknown:')) return null
    try {
      const icon = await app.getFileIcon(path, { size: 'small' })
      return icon.isEmpty() ? null : icon.toDataURL()
    } catch {
      return null
    }
  })
  ipcMain.handle('apps:set-category', (_event, appId: number, category: CategoryName) => store.setAppCategory(appId, category))
  ipcMain.handle('demo:seed', () => store.seedDemoData())
  ipcMain.handle('controls:get', () => store.getControls())
  ipcMain.handle('limits:set', (_event, targetType: 'app' | 'category', targetId: number, seconds: number | null) => store.setLimit(targetType, targetId, seconds))
  ipcMain.handle('downtime:set', (_event, settings: { enabled: boolean; start: string; end: string }) => store.setDowntime(settings))
  ipcMain.handle('downtime:allow', (_event, appId: number, allowed: boolean) => store.setAlwaysAllowed(appId, allowed))
  ipcMain.handle('data:delete', () => {
    const wasTracking = tracker.getStatus().tracking
    tracker.setPaused(true)
    store.deleteAllData()
    if (wasTracking) tracker.setPaused(false)
  })
  ipcMain.handle('settings:get', () => ({
    appearance: store.getAppearance(),
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
    onboardingComplete: store.isOnboardingComplete(),
    platform: process.platform,
    screenRecording: process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'not-required',
    accessibility: process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : true,
  }))
  ipcMain.handle('settings:appearance', (_event, appearance: AppearancePreference) => store.setAppearance(appearance))
  ipcMain.handle('settings:launch-at-login', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: enabled ? ['--hidden'] : [] })
  })
  ipcMain.handle('settings:onboarding-complete', () => store.completeOnboarding())
  ipcMain.handle('settings:open-privacy', async (_event, kind: 'screen' | 'accessibility') => {
    if (process.platform === 'darwin') {
      if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true)
      const section = kind === 'screen' ? 'Privacy_ScreenCapture' : 'Privacy_Accessibility'
      await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${section}`)
      return
    }
    if (process.platform === 'win32') await shell.openExternal('ms-settings:privacy')
  })
  ipcMain.handle('data:export-csv', async () => {
    const result = await dialog.showSaveDialog({
      title: 'Export Stilltime activity',
      defaultPath: join(app.getPath('documents'), `stilltime-activity-${new Date().toISOString().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV file', extensions: ['csv'] }],
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, store.exportCsv(), 'utf8')
    return true
  })
  ipcMain.handle('tracker:pause', (_event, paused: boolean) => tracker.setPaused(paused))
}
