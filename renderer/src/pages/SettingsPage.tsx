import { Activity, AlertTriangle, ArrowDownRight, BarChart3, Moon, Pause, Play, ShieldCheck, Sparkles, Sun, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Card, PageHeader, Switch } from '../components'
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
      <PageHeader eyebrow="PREFERENCES" title="Settings" subtitle="Small choices — all kept on this PC" />

      <div className="settings-stack">
        <Card className="setting-row setting-row-split">
          <div className="setting-copy">
            <span className="setting-icon tone-blue"><Sun size={15} /></span>
            <div>
              <strong>Appearance</strong>
              <span>Follow Windows, or pick a light that suits you.</span>
            </div>
          </div>
          <div className="segmented segmented-compact">
            {(['system', 'light', 'dark'] as AppearancePreference[]).map((value) => (
              <button key={value} className={settings?.appearance === value ? 'is-active' : ''} onClick={() => void onAppearance(value)}>
                {value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </Card>

        <Card className="setting-row">
          <span className="setting-icon tone-violet"><Play size={15} /></span>
          <div className="setting-copy-inline">
            <strong>Start with Windows</strong>
            <span>Stilltime launches quietly into the tray when you log in, so tracking never misses a day.</span>
          </div>
          <Switch checked={settings?.autoStart ?? true} label="Start Stilltime with Windows" onChange={(next) => void onAutoStart(next)} />
        </Card>

        <Card className="setting-row">
          <span className="setting-icon tone-green"><Activity size={15} /></span>
          <div className="setting-copy-inline">
            <strong>Tracking</strong>
            <span>{paused ? 'Paused — nothing is being recorded right now.' : 'Running quietly in the background. Idle time, locks, and sleep are skipped.'}</span>
          </div>
          <button className="ghost" onClick={onPause}>{paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}</button>
        </Card>

        <Card className="setting-row">
          <span className="setting-icon tone-violet"><Sparkles size={15} /></span>
          <div className="setting-copy-inline">
            <strong>Sample activity</strong>
            <span>Two weeks of realistic pretend usage, handy for exploring the dashboard.</span>
          </div>
          <div className="setting-actions">
            <button className="ghost" disabled={busy} onClick={() => void run(onSeedDemo)}>Add sample</button>
            <button className="ghost" disabled={busy} onClick={() => void run(onRemoveDemo)}>Remove sample</button>
          </div>
        </Card>

        <Card className="setting-row">
          <span className="setting-icon tone-blue"><BarChart3 size={15} /></span>
          <div className="setting-copy-inline">
            <strong>Export history</strong>
            <span>Save every session as a spreadsheet-friendly CSV file.</span>
          </div>
          <button className="ghost" onClick={() => void run(async () => flash((await onExport()) ? 'Export saved.' : 'Export cancelled.'))}><ArrowDownRight size={13} /> Export CSV</button>
        </Card>

        <Card className="setting-row setting-danger">
          <span className="setting-icon tone-red"><Trash2 size={15} /></span>
          <div className="setting-copy-inline">
            <strong>Delete all data</strong>
            <span>Erase sessions, apps, limits, and always-allowed lists from this PC.</span>
          </div>
          <button className="danger" onClick={() => setConfirming(true)}><Trash2 size={13} /> Delete</button>
        </Card>
      </div>

      {notice && <p className="notice">{notice}</p>}

      <Card className="about-card">
        <ShieldCheck size={16} />
        <div>
          <strong>Private by design</strong>
          <p>Stilltime reads only the foreground app and idle timer through Windows APIs, and stores everything in a local SQLite database. No accounts, no cloud, no telemetry. Version {settings?.version ?? '—'}.</p>
        </div>
      </Card>

      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <span className="modal-icon"><AlertTriangle size={19} /></span>
            <h2 id="delete-title">Delete everything?</h2>
            <p>All activity history, apps, limits, and always-allowed apps are removed from this PC. This can’t be undone.</p>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfirming(false)}>Keep my data</button>
              <button className="danger" disabled={busy} onClick={() => void run(async () => { await onDeleteAll(); setConfirming(false) })}><Trash2 size={13} /> Delete everything</button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
