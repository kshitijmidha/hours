export type CategoryName = 'Productivity' | 'Social' | 'Entertainment' | 'Development' | 'Browsing' | 'Other'
export type TimeRange = 'day' | 'week'

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

export interface TrackerStatus {
  tracking: boolean
  idle: boolean
  currentApp: string | null
  todaySeconds: number
}

export interface TodaySnapshot {
  status: TrackerStatus
  totalSeconds: number
  appCount: number
  sessions: Array<{ appName: string; durationSeconds: number; startedAt: string }>
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

export interface StilltimeBridge {
  getDashboard: (range: TimeRange, selectedDate: string) => Promise<DashboardData>
  getAppDirectory: () => Promise<AppDirectoryEntry[]>
  getAppIcon: (appId: number) => Promise<string | null>
  setAppCategory: (appId: number, category: CategoryName) => Promise<void>
  seedDemoData: () => Promise<void>
  setPaused: (paused: boolean) => Promise<void>
  onStatus: (callback: (status: TrackerStatus) => void) => () => void
}

declare global {
  interface Window {
    stilltime: StilltimeBridge
  }
}
