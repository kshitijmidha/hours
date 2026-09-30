import type { CategoryName, TimeRange } from '../../shared/types'

export const CATEGORY_NAMES: CategoryName[] = ['Productivity', 'Social', 'Entertainment', 'Development', 'Browsing', 'Other']

export const CATEGORY_COLORS: Record<CategoryName, string> = {
  Productivity: '#30D158',
  Social: '#BF5AF2',
  Entertainment: '#FF375F',
  Development: '#0A84FF',
  Browsing: '#64D2FF',
  Other: '#8E8E93',
}

export function formatDuration(seconds: number, style: 'full' | 'coarse' = 'full') {
  const minutes = Math.max(0, Math.round(seconds / 60))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (style === 'coarse') {
    if (hours > 0) return `${hours}.${Math.round((rest / 60) * 10)}h`
    return `${minutes}m`
  }
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function formatClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}:${`${minutes}`.padStart(2, '0')}`
}

export function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`
}

export function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
}

export function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function periodLabel(selectedDate: string, range: TimeRange) {
  const today = todayKey()
  if (range === 'week') {
    const [year, month, day] = selectedDate.split('-').map(Number)
    const start = new Date(year, month - 1, day)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    if (selectedDate >= shiftDate(today, -((new Date().getDay() + 6) % 7))) return 'This week'
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const sameMonth = start.getMonth() === end.getMonth()
    const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })
    return `${startLabel} – ${endLabel}`
  }
  if (selectedDate === today) return 'Today'
  if (selectedDate === shiftDate(today, -1)) return 'Yesterday'
  const date = dateFromKey(selectedDate)
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function longDate(value: string) {
  return dateFromKey(value).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function comparison(current: number, average: number) {
  const delta = current - average
  const magnitude = Math.abs(delta)
  if (magnitude < 60) return { tone: 'even' as const, text: 'Right in line with your daily average' }
  return {
    tone: delta > 0 ? ('above' as const) : ('below' as const),
    text: `${formatDuration(magnitude)} ${delta > 0 ? 'above' : 'below'} your daily average`,
  }
}

export function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || '•'
}
