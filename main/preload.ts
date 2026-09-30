import { contextBridge, ipcRenderer } from 'electron'
import type { StilltimeBridge, TrackerStatus } from '../shared/types'

const bridge: StilltimeBridge = {
  getDashboard: (range, selectedDate) => ipcRenderer.invoke('dashboard:get', range, selectedDate),
  getAppDirectory: () => ipcRenderer.invoke('apps:list'),
  getAppIcon: (appId) => ipcRenderer.invoke('apps:icon', appId),
  setAppCategory: (appId, category) => ipcRenderer.invoke('apps:set-category', appId, category),
  seedDemoData: () => ipcRenderer.invoke('demo:seed'),
  removeDemoData: () => ipcRenderer.invoke('demo:remove'),
  getControls: () => ipcRenderer.invoke('controls:get'),
  setLimit: (targetType, targetId, seconds) => ipcRenderer.invoke('limits:set', targetType, targetId, seconds),
  setDowntime: (settings) => ipcRenderer.invoke('downtime:set', settings),
  setAlwaysAllowed: (appId, allowed) => ipcRenderer.invoke('downtime:allow', appId, allowed),
  deleteAllData: () => ipcRenderer.invoke('data:delete'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setAppearance: (appearance) => ipcRenderer.invoke('settings:appearance', appearance),
  setAutoStart: (enabled) => ipcRenderer.invoke('settings:auto-start', enabled),
  completeOnboarding: () => ipcRenderer.invoke('settings:onboarding-complete'),
  syncTheme: (payload) => ipcRenderer.invoke('theme:sync', payload),
  exportCsv: () => ipcRenderer.invoke('data:export-csv'),
  setPaused: (paused) => ipcRenderer.invoke('tracker:pause', paused),
  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: TrackerStatus) => callback(status)
    ipcRenderer.on('tracker:status', listener)
    return () => ipcRenderer.removeListener('tracker:status', listener)
  },
}

contextBridge.exposeInMainWorld('stilltime', bridge)
