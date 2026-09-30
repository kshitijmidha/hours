export type CategoryName = 'Productivity' | 'Social' | 'Entertainment' | 'Development' | 'Browsing' | 'Other'

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

export interface StilltimeBridge {
  getSnapshot: () => Promise<TodaySnapshot>
  setPaused: (paused: boolean) => Promise<void>
  onStatus: (callback: (status: TrackerStatus) => void) => () => void
}

declare global {
  interface Window {
    stilltime: StilltimeBridge
  }
}
