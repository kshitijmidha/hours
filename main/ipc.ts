import { app, ipcMain } from 'electron'
import type { ActivityTracker } from './tracker'
import type { Store } from './database'
import type { CategoryName, TimeRange } from '../shared/types'

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
  ipcMain.handle('tracker:pause', (_event, paused: boolean) => tracker.setPaused(paused))
}
