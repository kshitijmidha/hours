import { Notification } from 'electron'
import type { Store } from './database'
import type { TrackerStatus } from '../shared/types'

function localDay(date: Date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function isWithinDowntime(now: Date, start: string, end: string) {
  const current = now.getHours() * 60 + now.getMinutes()
  const startAt = timeMinutes(start)
  const endAt = timeMinutes(end)
  if (startAt === endAt) return true
  return startAt < endAt ? current >= startAt && current < endAt : current >= startAt || current < endAt
}

function notify(title: string, body: string) {
  if (!Notification.isSupported()) return
  new Notification({ title, body, silent: true }).show()
}

export class BoundaryMonitor {
  private checking = false

  constructor(private store: Store) {}

  async check(status: TrackerStatus) {
    if (!status.tracking || this.checking) return
    this.checking = true
    try {
      const controls = this.store.getControls()
      const now = new Date()
      const date = localDay(now)
      for (const limit of controls.limits) {
        for (const threshold of [80, 100]) {
          if (limit.percent < threshold || !this.store.recordLimitNotification(limit.id, date, threshold)) continue
          notify(
            threshold === 100 ? 'Daily limit reached' : 'A gentle heads-up',
            threshold === 100
              ? `${limit.targetName} reached its ${Math.round(limit.dailyLimitSeconds / 60)} minute daily limit.`
              : `${limit.targetName} has used ${threshold}% of its daily limit.`,
          )
        }
      }

      if (!status.currentAppId || !controls.downtime.enabled || !isWithinDowntime(now, controls.downtime.start, controls.downtime.end)) return
      if (this.store.isAlwaysAllowed(status.currentAppId)) return
      const end = timeMinutes(controls.downtime.end)
      const beforeEnd = now.getHours() * 60 + now.getMinutes() < end
      const windowDate = new Date(now)
      if (beforeEnd && timeMinutes(controls.downtime.start) >= end) windowDate.setDate(windowDate.getDate() - 1)
      const windowKey = `${localDay(windowDate)}:${controls.downtime.start}-${controls.downtime.end}`
      if (this.store.recordDowntimeNotification(status.currentAppId, windowKey)) {
        notify('Downtime is on', `${this.store.getAppName(status.currentAppId)} is on. Your always-allowed apps are still available.`)
      }
    } catch (error) {
      console.error('[stilltime] Could not check daily boundaries:', error)
    } finally {
      this.checking = false
    }
  }
}
