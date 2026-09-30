import { useState } from 'react'
import { PageHeader, Switch } from '../components'
import type { AppearancePreference, AppSettings } from '../../../shared/types'

export function SettingsPage({ paused, settings, onPause, onAppearance, onAutoStart, onSeedDemo, onRemoveDemo, onExport, onDeleteAll }: {
  paused: boolean
  settings: AppSettings | null
  onPause: () => void
  onAppearance: (appearance: AppearancePreference) => Promise<void>
  onAutoStart: (enabled: boolean) => Promise<void>
  onSeedDemo: () => Promise<void>
  onRemoveDemo: () => Promise<void>
  onExport: () => Promise<boolean>
  onDeleteAll: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const flash = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    await action()
    setBusy(false)
  }

  return (
    <>
      <PageHeader title="Settings" />

      <div className="settings-stack">
        <div className="setting-row setting-row-split">
          <div className="setting-copy-inline">
            <strong>Appearance</strong>
            <span>Follow Windows, or pick a light that suits you.</span>
          </div>
          <div className="segmented segmented-compact">
            {(['system', 'light', 'dark'] as AppearancePreference[]).map((value) => (
              <button key={value} className={settings?.appearance === value ? 'is-active' : ''} onClick={() => void onAppearance(value)}>
                {value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-copy-inline">
            <strong>Start with Windows</strong>
            <span>Launches quietly into the tray when you log in, so tracking never misses a day.</span>
          </div>
          <Switch checked={settings?.autoStart ?? true} label="Start Hours with Windows" onChange={(next) => void onAutoStart(next)} />
        </div>

        <div className="setting-row">
          <div className="setting-copy-inline">
            <strong>Tracking</strong>
            <span>{paused ? 'Paused — nothing is being recorded right now.' : 'Running quietly. Idle time, locks, and sleep are skipped.'}</span>
          </div>
          <button className="ghost" onClick={onPause}>{paused ? 'Resume' : 'Pause'}</button>
        </div>

        <div className="setting-row">
          <div className="setting-copy-inline">
            <strong>Sample activity</strong>
            <span>Two weeks of realistic pretend usage, handy for exploring the dashboard.</span>
          </div>
          <div className="setting-actions">
            <button className="ghost" disabled={busy} onClick={() => void run(onSeedDemo)}>Add sample</button>
            <button className="ghost" disabled={busy} onClick={() => void run(onRemoveDemo)}>Remove</button>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-copy-inline">
            <strong>Export history</strong>
            <span>Save every session as a spreadsheet-friendly CSV file.</span>
          </div>
          <button className="ghost" onClick={() => void run(async () => flash((await onExport()) ? 'Export saved.' : 'Export cancelled.'))}>Export CSV</button>
        </div>

        <div className="setting-row">
          <div className="setting-copy-inline">
            <strong>Delete all data</strong>
            <span>Erase sessions, apps, limits, and always-allowed lists from this PC.</span>
          </div>
          <button className="danger" onClick={() => setConfirming(true)}>Delete</button>
        </div>
      </div>

      {notice && <p className="notice">{notice}</p>}

      <p className="about-text">
        Private by design — Hours reads only the foreground app and idle timer through Windows APIs, and stores
        everything in a local SQLite database. No accounts, no cloud, no telemetry. Version {settings?.version ?? '—'}.
      </p>

      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h2 id="delete-title">Delete everything?</h2>
            <p>All activity history, apps, limits, and always-allowed apps are removed from this PC. This can’t be undone.</p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfirming(false)}>Keep my data</button>
              <button className="danger" disabled={busy} onClick={() => void run(async () => { await onDeleteAll(); setConfirming(false) })}>Delete everything</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
