import { contextBridge, ipcRenderer } from 'electron'
import type { StilltimeBridge, TrackerStatus } from '../shared/types'

const bridge: StilltimeBridge = {
  getDashboard: (range, selectedDate) => ipcRenderer.invoke('dashboard:get', range, selectedDate),
  getAppDirectory: () => ipcRenderer.invoke('apps:list'),
  getAppIcon: (appId) => ipcRenderer.invoke('apps:icon', appId),
  setAppCategory: (appId, category) => ipcRenderer.invoke('apps:set-category', appId, category),
  seedDemoData: () => ipcRenderer.invoke('demo:seed'),
  setPaused: (paused) => ipcRenderer.invoke('tracker:pause', paused),
  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: TrackerStatus) => callback(status)
    ipcRenderer.on('tracker:status', listener)
    return () => ipcRenderer.removeListener('tracker:status', listener)
  },
}

contextBridge.exposeInMainWorld('stilltime', bridge)
