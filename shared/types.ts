export type CategoryName = 'Productivity' | 'Social' | 'Entertainment' | 'Development' | 'Browsing' | 'Other'
export type TimeRange = 'day' | 'week'
export type LimitTargetType = 'app' | 'category'
export type AppearancePreference = 'system' | 'light' | 'dark'

export interface TrackerStatus {
  tracking: boolean
  idle: boolean
  currentApp: string | null
  currentAppId: number | null
  todaySeconds: number
}

export interface TrendPoint {
  date: string
  label: string
  seconds: number
}

export interface UsageApp {
  id: number
  name: string
  executablePath: string
  category: CategoryName
  categoryColor: string
  seconds: number
  sessionCount: number
  lastTitle: string
}

export interface CategoryUsage {
  name: CategoryName
  color: string
  seconds: number
  percent: number
}

export interface UsageBucket {
  key: string
  label: string
  totalSeconds: number
  categories: Record<CategoryName, number>
}

export interface DashboardData {
  range: TimeRange
  selectedDate: string
  startDate: string
  endDate: string
  totalSeconds: number
  averageSeconds: number
  appCount: number
  apps: UsageApp[]
  categories: CategoryUsage[]
  buckets: UsageBucket[]
  trend: TrendPoint[]
  hasDemoData: boolean
  status: TrackerStatus
}

export interface AppDirectoryEntry {
  id: number
  name: string
  executablePath: string
  category: CategoryName
  categoryColor: string
}

export interface AppLimit {
  id: number
  targetType: LimitTargetType
  targetId: number
  targetName: string
  color: string
  dailyLimitSeconds: number
  usedSeconds: number
  percent: number
}

export interface DowntimeSettings {
  enabled: boolean
  start: string
  end: string
}

export interface ControlSnapshot {
  limits: AppLimit[]
  apps: AppDirectoryEntry[]
  categories: Array<{ id: number; name: CategoryName; color: string }>
  alwaysAllowedIds: number[]
  downtime: DowntimeSettings
}

export interface AppSettings {
  appearance: AppearancePreference
  autoStart: boolean
  onboardingComplete: boolean
  version: string
}

export interface ThemePayload {
  dark: boolean
  titlebar: string
  symbol: string
  background: string
}

export interface HoursBridge {
  getDashboard: (range: TimeRange, selectedDate: string) => Promise<DashboardData>
  getAppDirectory: () => Promise<AppDirectoryEntry[]>
  getAppIcon: (appId: number) => Promise<string | null>
  setAppCategory: (appId: number, category: CategoryName) => Promise<void>
  seedDemoData: () => Promise<void>
  removeDemoData: () => Promise<void>
  getControls: () => Promise<ControlSnapshot>
  setLimit: (targetType: LimitTargetType, targetId: number, dailyLimitSeconds: number | null) => Promise<void>
  setDowntime: (settings: DowntimeSettings) => Promise<void>
  setAlwaysAllowed: (appId: number, allowed: boolean) => Promise<void>
  deleteAllData: () => Promise<void>
  getSettings: () => Promise<AppSettings>
  setAppearance: (appearance: AppearancePreference) => Promise<void>
  setAutoStart: (enabled: boolean) => Promise<void>
  completeOnboarding: () => Promise<void>
  syncTheme: (payload: ThemePayload) => Promise<void>
  exportCsv: () => Promise<boolean>
  setPaused: (paused: boolean) => Promise<void>
  onStatus: (callback: (status: TrackerStatus) => void) => () => void
}

declare global {
  interface Window {
    hours: HoursBridge
  }
}
