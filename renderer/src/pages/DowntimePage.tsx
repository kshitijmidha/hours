import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppAvatar, EmptyState, PageHeader, Switch } from '../components'
import type { ControlSnapshot } from '../../../shared/types'

export function DowntimePage({ controls, icons, onScheduleChange, onAllowChange }: {
  controls: ControlSnapshot | null
  icons: Record<number, string | null>
  onScheduleChange: (enabled: boolean, start: string, end: string) => Promise<void>
  onAllowChange: (appId: number, allowed: boolean) => Promise<void>
}) {
  const [start, setStart] = useState('23:00')
  const [end, setEnd] = useState('07:00')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!controls) return
    setStart(controls.downtime.start)
    setEnd(controls.downtime.end)
  }, [controls?.downtime.start, controls?.downtime.end])

  const apps = (controls?.apps ?? []).filter((app) => app.name.toLowerCase().includes(query.trim().toLowerCase()))
  const update = (enabled: boolean, nextStart: string, nextEnd: string) => void onScheduleChange(enabled, nextStart, nextEnd)

  const minutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number)
    return hour * 60 + minute
  }
  const startAt = minutes(start)
  const endAt = minutes(end)
  const now = new Date()
  const nowPercent = ((now.getHours() * 60 + now.getMinutes()) / 1440) * 100
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const value = hour * 60
    if (startAt === endAt) return true
    return startAt < endAt ? value >= startAt && value < endAt : value >= startAt || value < endAt
  })

  return (
    <>
      <PageHeader title="Downtime" />

      <div className="downtime-head">
        <div className="downtime-copy">
          <strong>Scheduled downtime</strong>
          <span>Get a gentle notification when you open an app during your quiet hours.</span>
        </div>
        <Switch
          checked={controls?.downtime.enabled ?? false}
          label="Enable scheduled downtime"
          onChange={(next) => update(next, start, end)}
        />
      </div>
      <div className="timeline">
        {hours.map((active, hour) => <span key={hour} className={active ? 'is-active' : ''} />)}
        <i className="timeline-now" style={{ left: `${nowPercent}%` }} title="Current time" />
      </div>
      <div className="timeline-labels">
        <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>12 AM</span>
      </div>
      <div className="schedule">
        <label className="field">
          <span>STARTS</span>
          <input type="time" value={start} onChange={(event) => { setStart(event.target.value); update(Boolean(controls?.downtime.enabled), event.target.value, end) }} />
        </label>
        <span className="schedule-to">to</span>
        <label className="field">
          <span>ENDS</span>
          <input type="time" value={end} onChange={(event) => { setEnd(event.target.value); update(Boolean(controls?.downtime.enabled), start, event.target.value) }} />
        </label>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Always allowed</h2>
          <label className="search search-compact">
            <Search size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an app" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
          </label>
        </div>
        {apps.length ? (
          <div className="rows">
            {apps.map((app) => {
              const allowed = controls?.alwaysAllowedIds.includes(app.id) ?? false
              return (
                <div className="allow-row" key={app.id}>
                  <AppAvatar name={app.name} category={app.category} icon={icons[app.id]} size={24} />
                  <div className="allow-copy">
                    <strong>{app.name}</strong>
                  </div>
                  <Switch checked={allowed} label={`Always allow ${app.name}`} onChange={(next) => void onAllowChange(app.id, next)} />
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState title="No apps to show" note={query ? 'Try a different search.' : 'Apps appear here once Stilltime has seen them.'} />
        )}
      </section>
    </>
  )
}
