import { app, BrowserWindow, Menu, nativeImage, Notification, powerMonitor, Tray } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { Store } from './database'
import { ActivityTracker } from './tracker'
import { BoundaryMonitor } from './controls'
import { registerIpc } from './ipc'
import { THEME_COLORS } from '../shared/theme'

// Keep the data directory stable across product renames.
app.setName('Hours')
app.setAppUserModelId('com.hours.desktop')

const gotLock = !app.isPackaged || app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let store: Store
let tracker: ActivityTracker
let boundaryMonitor: BoundaryMonitor
let quitting = false
const startHidden = process.argv.includes('--hidden')

function migrateLegacyData() {
  const userData = app.getPath('userData')
  const database = join(userData, 'hours.db')
  if (existsSync(database)) return
  const legacy = join(app.getPath('appData'), 'stilltime', 'stilltime.db')
  if (!existsSync(legacy)) return
  mkdirSync(userData, { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(legacy + suffix)) copyFileSync(legacy + suffix, database + suffix)
  }
  console.log('[hours] Migrated activity data from the previous Stilltime database.')
}

function assetPath(name: string) {
  if (app.isPackaged) return join(process.resourcesPath, name)
  return join(app.getAppPath(), 'build', name)
}

function trayImage() {
  const file = assetPath('tray.png')
  if (existsSync(file)) {
    const image = nativeImage.createFromPath(file)
    if (!image.isEmpty()) return image
  }
  return nativeImage.createEmpty()
}

function windowImage() {
  const file = assetPath('icon.png')
  return existsSync(file) ? file : undefined
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 940,
    minHeight: 620,
    title: 'Hours',
    backgroundColor: THEME_COLORS.light.background,
    icon: windowImage(),
    show: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...THEME_COLORS.light, height: 48 },
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  mainWindow.once('ready-to-show', () => {
    if (!startHidden) mainWindow?.show()
  })
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

function trayMenu() {
  const status = tracker.getStatus()
  const hours = Math.floor(status.todaySeconds / 3600)
  const minutes = Math.floor((status.todaySeconds % 3600) / 60)
  return Menu.buildFromTemplate([
    { label: `Today · ${hours}h ${minutes}m`, enabled: false },
    { type: 'separator' },
    { label: 'Open Hours', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    {
      label: status.tracking ? 'Pause tracking' : 'Resume tracking',
      click: () => tracker.setPaused(status.tracking),
    },
    { type: 'separator' },
    { label: 'Quit Hours', click: () => { quitting = true; app.quit() } },
  ])
}

function refreshTray() {
  if (!tray) return
  tray.setToolTip(tracker.getStatus().currentApp ? `Hours — ${tracker.getStatus().currentApp}` : 'Hours — tracking')
  tray.setContextMenu(trayMenu())
}

function createTray() {
  tray = new Tray(trayImage())
  refreshTray()
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function applyAutoStart(enabled: boolean) {
  if (!app.isPackaged) return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: ['--hidden'],
    path: process.execPath,
  })
}

app.on('before-quit', () => {
  quitting = true
  tracker?.stop()
  store?.close()
})

app.on('second-instance', () => {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
})

app.whenReady().then(() => {
  migrateLegacyData()
  store = new Store()
  tracker = new ActivityTracker(store)
  boundaryMonitor = new BoundaryMonitor(store)
  registerIpc(store, tracker, () => mainWindow)

  // Installs run quietly in the tray from login until the user says otherwise.
  const autoStart = store.getPreference('auto_start') !== 'false'
  applyAutoStart(autoStart)

  tracker.onStatus((status: Parameters<typeof boundaryMonitor.check>[0]) => {
    mainWindow?.webContents.send('tracker:status', status)
    refreshTray()
    void boundaryMonitor.check(status)
  })

  createWindow()
  createTray()
  tracker.start()

  powerMonitor.on('suspend', () => tracker.handleInterruption('suspend'))
  powerMonitor.on('lock-screen', () => tracker.handleInterruption('lock'))
  powerMonitor.on('resume', () => tracker.start())
  powerMonitor.on('unlock-screen', () => tracker.start())

  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => { /* tray app: keep running */ })

process.on('uncaughtException', (error) => {
  console.error('[hours] Uncaught error:', error)
  if (Notification.isSupported()) new Notification({ title: 'Hours', body: 'The tracker had a brief hiccup and will keep running.' }).show()
})
