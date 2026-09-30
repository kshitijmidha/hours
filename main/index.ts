import { app, BrowserWindow, Menu, nativeImage, Tray, Notification, powerMonitor } from 'electron'
import { join } from 'node:path'
import { Store } from './database'
import { ActivityTracker } from './tracker'
import { registerIpc } from './ipc'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let store: Store
let tracker: ActivityTracker
let quitting = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: 'Stilltime',
    backgroundColor: '#f5f6fa',
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#f5f6fa', symbolColor: '#303747', height: 40 },
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

function createTray() {
  // Small custom mark works at Windows notification-area sizes and avoids external assets.
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAJ0lEQVR4AWP4z8Dwn4GBgYHhP4P///8ZGBgYGJgYGBh+MDAw/A8AAG8JAwGqgVwAAAAASUVORK5CYII=')
  tray = new Tray(icon)
  tray.setToolTip('Stilltime — keeping an eye on your screen time')
  const menu = Menu.buildFromTemplate([
    { label: 'Open Stilltime', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { label: 'Pause tracking', click: () => tracker.setPaused(!tracker.getStatus().tracking) },
    { type: 'separator' },
    { label: 'Quit Stilltime', click: () => { quitting = true; app.quit() } },
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

app.on('before-quit', () => {
  quitting = true
  tracker?.stop()
  store?.close()
})

app.whenReady().then(() => {
  app.setAppUserModelId('com.stilltime.desktop')
  store = new Store()
  tracker = new ActivityTracker(store)
  registerIpc(store, tracker)
  tracker.onStatus((status) => {
    mainWindow?.webContents.send('tracker:status', status)
    tray?.setToolTip(status.currentApp ? `Stilltime — tracking ${status.currentApp}` : 'Stilltime — tracking quietly')
  })
  createWindow()
  createTray()
  tracker.start()
  powerMonitor.on('suspend', () => tracker.stop())
  powerMonitor.on('resume', () => tracker.start())
  app.on('activate', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } else createWindow() })
})

app.on('window-all-closed', () => { /* Keep the tray app and tracker running. */ })

process.on('uncaughtException', (error) => {
  console.error('[stilltime] Uncaught error:', error)
  if (Notification.isSupported()) new Notification({ title: 'Stilltime', body: 'The tracker had a brief hiccup and will keep running.' }).show()
})
