import { ipcMain } from 'electron'
import type { ActivityTracker } from './tracker'
import type { Store } from './database'

export function registerIpc(store: Store, tracker: ActivityTracker) {
  ipcMain.handle('snapshot:get', () => store.getTodaySnapshot(!tracker.getStatus().tracking ? false : true, tracker.getStatus().idle, tracker.getStatus().currentApp))
  ipcMain.handle('tracker:pause', (_event, paused: boolean) => tracker.setPaused(paused))
}
