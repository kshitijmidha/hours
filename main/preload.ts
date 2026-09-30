import { contextBridge, ipcRenderer } from 'electron'
import type { StilltimeBridge, TrackerStatus } from '../shared/types'

const bridge: StilltimeBridge = {
  getSnapshot: () => ipcRenderer.invoke('snapshot:get'),
  setPaused: (paused) => ipcRenderer.invoke('tracker:pause', paused),
  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: TrackerStatus) => callback(status)
    ipcRenderer.on('tracker:status', listener)
    return () => ipcRenderer.removeListener('tracker:status', listener)
  },
}

contextBridge.exposeInMainWorld('stilltime', bridge)
