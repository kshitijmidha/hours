import { Clock3, Moon, Search, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppAvatar, Card, EmptyState, PageHeader, Switch } from '../components'
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

  return (
    <>
      <PageHeader eyebrow="SPACE TO REST" title="Downtime" subtitle="A quiet window where Stilltime reminds you to step away — nothing is blocked" />

      <Card className="downtime-card">
        <div className="downtime-head">
          <span className="editor-icon"><Moon size={16} /></span>
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
          <span className="schedule-note"><Clock3 size={13} /> Quiet hours {start} – {end}</span>
        </div>
      </Card>

      <div className="section-head">
        <div>
          <span className="section-label">EXCEPTIONS</span>
          <h2>Always allowed</h2>
          <p>Keep the essentials reachable during downtime.</p>
        </div>
        <label className="search search-compact">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an app" />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
        </label>
      </div>

      <Card className="list-card">
        {apps.length ? apps.map((app) => {
          const allowed = controls?.alwaysAllowedIds.includes(app.id) ?? false
          return (
            <div className="allow-row" key={app.id}>
              <AppAvatar name={app.name} category={app.category} icon={icons[app.id]} size={30} />
              <div className="allow-copy">
                <strong>{app.name}</strong>
                <span><i style={{ background: app.categoryColor }} />{app.category}</span>
              </div>
              <Switch checked={allowed} label={`Always allow ${app.name}`} onChange={(next) => void onAllowChange(app.id, next)} />
            </div>
          )
        }) : <EmptyState icon={<Sparkles size={18} />} title="No apps to show" note={query ? 'Try a different search.' : 'Apps appear here once Stilltime has seen them.'} />}
      </Card>
    </>
  )
}
