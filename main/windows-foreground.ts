import { execFile } from 'node:child_process'
import { basename } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ForegroundWindowInfo {
  processId: number
  path: string | null
  executable: string
  name: string
  title: string
}

const FRIENDLY_NAMES: Record<string, string> = {
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  firefox: 'Firefox',
  brave: 'Brave',
  opera: 'Opera',
  opera_gx: 'Opera GX',
  vivaldi: 'Vivaldi',
  arc: 'Arc',
  code: 'Visual Studio Code',
  'code - insiders': 'Visual Studio Code Insiders',
  devenv: 'Visual Studio',
  idea64: 'IntelliJ IDEA',
  pycharm64: 'PyCharm',
  webstorm64: 'WebStorm',
  rider64: 'Rider',
  goland64: 'GoLand',
  clion64: 'CLion',
  datagrip64: 'DataGrip',
  androidstudio64: 'Android Studio',
  sublime_text: 'Sublime Text',
  notepad: 'Notepad',
  notepadpp: 'Notepad++',
  windowsterminal: 'Windows Terminal',
  wt: 'Windows Terminal',
  powershell: 'Windows PowerShell',
  pwsh: 'PowerShell',
  cmd: 'Command Prompt',
  explorer: 'File Explorer',
  applicationframehost: 'Windows App',
  shellhost: 'Shell Experience Host',
  systemsettings: 'Settings',
  spotify: 'Spotify',
  discord: 'Discord',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  'ms-teams': 'Microsoft Teams',
  zoom: 'Zoom',
  notion: 'Notion',
  obsidian: 'Obsidian',
  figma: 'Figma',
  steam: 'Steam',
  epicgameslauncher: 'Epic Games Launcher',
  vlc: 'VLC media player',
  winword: 'Microsoft Word',
  excel: 'Microsoft Excel',
  powerpnt: 'Microsoft PowerPoint',
  outlook: 'Microsoft Outlook',
  onenote: 'Microsoft OneNote',
  mspaint: 'Paint',
  snippingtool: 'Snipping Tool',
  calculator: 'Calculator',
  hours: 'Hours',
}

interface KoffiApi {
  getForeground: () => { hwnd: unknown; pid: number } | null
  title: (hwnd: unknown) => string
  imageName: (pid: number) => string | null
  imagePath: (pid: number) => string | null
}

let cachedApi: KoffiApi | null | undefined

function loadKoffiApi(): KoffiApi | null {
  if (cachedApi !== undefined) return cachedApi
  cachedApi = null
  if (process.platform !== 'win32') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require('koffi')
    const user32 = koffi.load('user32.dll')
    const kernel32 = koffi.load('kernel32.dll')

    const HANDLE = koffi.pointer('HANDLE', koffi.opaque())
    const HWND = koffi.alias('HWND', HANDLE)

    const GetForegroundWindow = user32.func('HWND __stdcall GetForegroundWindow()')
    const GetWindowThreadProcessId = user32.func('uint32_t __stdcall GetWindowThreadProcessId(HWND hWnd, _Out_ uint32_t *lpdwProcessId)')
    const GetWindowTextW = user32.func('int __stdcall GetWindowTextW(HWND hWnd, _Out_ char16_t *lpString, int nMaxCount)')

    const OpenProcess = kernel32.func('HANDLE __stdcall OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)')
    const QueryFullProcessImageNameW = kernel32.func('bool __stdcall QueryFullProcessImageNameW(HANDLE hProcess, uint32_t dwFlags, _Inout_ char16_t *lpExeName, _Inout_ uint32_t *lpdwSize)')
    const CloseHandle = kernel32.func('bool __stdcall CloseHandle(HANDLE hObject)')
    const CreateToolhelp32Snapshot = kernel32.func('HANDLE __stdcall CreateToolhelp32Snapshot(uint32_t dwFlags, uint32_t th32ProcessID)')

    const PROCESSENTRY32W = koffi.struct('PROCESSENTRY32W', {
      dwSize: 'uint32_t',
      cntUsage: 'uint32_t',
      th32ProcessID: 'uint32_t',
      th32DefaultHeapID: 'uintptr_t',
      th32ModuleID: 'uint32_t',
      cntThreads: 'uint32_t',
      th32ParentProcessID: 'uint32_t',
      pcPriClassBase: 'int32_t',
      dwFlags: 'uint32_t',
      szExeFile: koffi.array('char16_t', 260, 'String'),
    })
    const Process32FirstW = kernel32.func('bool __stdcall Process32FirstW(HANDLE hSnapshot, _Inout_ PROCESSENTRY32W *lppe)')
    const Process32NextW = kernel32.func('bool __stdcall Process32NextW(HANDLE hSnapshot, _Inout_ PROCESSENTRY32W *lppe)')

    cachedApi = {
      getForeground() {
        const hwnd = GetForegroundWindow()
        if (!hwnd) return null
        const pidRef: Array<number | null> = [null]
        const threadId = GetWindowThreadProcessId(hwnd, pidRef)
        const pid = pidRef[0]
        if (!threadId || !pid) return null
        return { hwnd, pid }
      },
      title(hwnd) {
        const buffer = Buffer.allocUnsafe(2048)
        const length = GetWindowTextW(hwnd, buffer, 1024)
        if (!length || length < 0) return ''
        return String(koffi.decode(buffer, 'char16_t', Math.min(length, 1024)))
      },
      imageName(pid) {
        const snapshot = CreateToolhelp32Snapshot(0x00000002, 0)
        if (!snapshot) return null
        try {
          const entry: Record<string, unknown> = { dwSize: koffi.sizeof(PROCESSENTRY32W) }
          if (Process32FirstW(snapshot, entry)) {
            do {
              if (entry.th32ProcessID === pid) return typeof entry.szExeFile === 'string' ? entry.szExeFile : null
            } while (Process32NextW(snapshot, entry))
          }
          return null
        } finally {
          CloseHandle(snapshot)
        }
      },
      imagePath(pid) {
        const handle = OpenProcess(0x1000, false, pid)
        if (!handle) return null
        try {
          const buffer = Buffer.allocUnsafe(4096)
          const sizeRef = [2048]
          if (!QueryFullProcessImageNameW(handle, 0, buffer, sizeRef)) return null
          const length = Number(sizeRef[0])
          if (!length) return null
          return String(koffi.decode(buffer, 'char16_t', Math.min(length, 2048)))
        } finally {
          CloseHandle(handle)
        }
      },
    }
  } catch (error) {
    console.warn('[hours] Fast Win32 bindings unavailable, using PowerShell fallback:', error)
    cachedApi = null
  }
  return cachedApi
}

function friendlyName(executable: string) {
  const base = executable.replace(/\.exe$/i, '').toLowerCase()
  const known = FRIENDLY_NAMES[base]
  if (known) return known
  const words = base.replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  const label = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  return label || 'Unknown app'
}

async function readViaPowerShell(): Promise<ForegroundWindowInfo | null> {
  const script = `$source = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class HoursWindow {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
Add-Type -TypeDefinition $source -ErrorAction SilentlyContinue
$handle = [HoursWindow]::GetForegroundWindow()
$processId = 0
[void][HoursWindow]::GetWindowThreadProcessId($handle, [ref]$processId)
$p = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($p) {
  $text = New-Object System.Text.StringBuilder 1024
  [void][HoursWindow]::GetWindowText($handle, $text, $text.Capacity)
  $path = ''
  try { $path = $p.Path } catch {}
  [PSCustomObject]@{ title = $text.ToString(); pid = $processId; exe = $p.ProcessName; path = $path } | ConvertTo-Json -Compress -Depth 3
}`
  const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    timeout: 1_500,
    maxBuffer: 64 * 1024,
  })
  if (!stdout.trim()) return null
  const parsed = JSON.parse(stdout) as { title?: string; pid?: number; exe?: string; path?: string }
  if (!parsed.exe) return null
  const executable = basename(parsed.exe)
  return {
    processId: parsed.pid ?? 0,
    path: parsed.path || null,
    executable,
    name: friendlyName(executable),
    title: parsed.title ?? '',
  }
}

export async function getForegroundWindow(): Promise<ForegroundWindowInfo | null> {
  if (process.platform !== 'win32') return null
  const api = loadKoffiApi()
  if (api) {
    const foreground = api.getForeground()
    if (!foreground) return null
    const path = api.imagePath(foreground.pid)
    const rawExecutable = path ? basename(path) : api.imageName(foreground.pid)
    const executable = rawExecutable ?? `pid-${foreground.pid}`
    return {
      processId: foreground.pid,
      path,
      executable,
      name: friendlyName(executable),
      title: api.title(foreground.hwnd),
    }
  }
  return readViaPowerShell()
}
