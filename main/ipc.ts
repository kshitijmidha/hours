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
  ipcMain.handle('tracker:pause', (_event, paused: boolean) => tracker.setPaused(paused))
}
