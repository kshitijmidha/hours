import { Bell, ChevronDown, Gauge, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card, EmptyState, PageHeader, ProgressBar } from '../components'
import { formatDuration } from '../lib'
import type { ControlSnapshot, LimitTargetType } from '../../../shared/types'

export function LimitsPage({ controls, onSave, onRemove }: {
  controls: ControlSnapshot | null
  onSave: (targetType: LimitTargetType, targetId: number, seconds: number) => Promise<void>
  onRemove: (limit: ControlSnapshot['limits'][number]) => Promise<void>
}) {
  const defaultTarget = controls?.apps.length
    ? `app|${controls.apps[0].id}`
    : controls?.categories.length
      ? `category|${controls.categories[0].id}`
      : ''
  const [target, setTarget] = useState(defaultTarget)
  const [minutes, setMinutes] = useState('120')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!target && defaultTarget) setTarget(defaultTarget) }, [defaultTarget, target])

  const [targetType = 'app', rawId = ''] = target.split('|')
  const targetId = Number(rawId)
  const minutesValue = Number(minutes)
  const canSave = targetId > 0 && minutesValue >= 15 && minutesValue <= 1440

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    setBusy(true)
    await onSave(targetType as LimitTargetType, targetId, Math.round(minutesValue * 60))
    setBusy(false)
  }

  return (
    <>
      <PageHeader eyebrow="KINDER BOUNDARIES" title="App limits" subtitle="A daily budget per app or category, with a gentle nudge at 80% and a clear one at 100%" />

      <Card className="editor-card">
        <div className="editor-intro">
          <span className="editor-icon"><Bell size={16} /></span>
          <div>
            <strong>Daily limit</strong>
            <span>Apps keep working — you just get a moment to choose.</span>
          </div>
        </div>
        <form className="editor-form" onSubmit={(event) => void save(event)}>
          <label className="field field-grow">
            <span>APPLIES TO</span>
            <div className="select select-flat">
              <select value={target} onChange={(event) => setTarget(event.target.value)}>
                <optgroup label="Apps">
                  {controls?.apps.map((app) => <option key={app.id} value={`app|${app.id}`}>{app.name}</option>)}
                </optgroup>
                <optgroup label="Categories">
                  {controls?.categories.map((category) => <option key={category.id} value={`category|${category.id}`}>{category.name}</option>)}
                </optgroup>
              </select>
              <ChevronDown size={13} />
            </div>
          </label>
          <label className="field field-minutes">
            <span>BUDGET</span>
            <div className="minutes-input">
              <input type="number" min={15} max={1440} step={15} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
              <span>min</span>
            </div>
          </label>
          <button className="primary" type="submit" disabled={!canSave || busy}><Plus size={14} /> Add limit</button>
        </form>
        <div className="preset-row">
          <span>QUICK PICKS</span>
          {[30, 60, 120, 180, 240].map((preset) => (
            <button
              type="button"
              key={preset}
              className={`preset ${minutesValue === preset ? 'is-active' : ''}`}
              onClick={() => setMinutes(String(preset))}
            >
              {preset < 60 ? `${preset}m` : `${preset / 60}h`}
            </button>
          ))}
        </div>
        <div className="editor-foot">
          <span><i className="threshold threshold-80" /> Heads-up at 80%</span>
          <span><i className="threshold threshold-100" /> Limit reached at 100%</span>
          <span><ShieldCheck size={12} /> Notices stay on this PC</span>
        </div>
      </Card>

      <div className="section-head">
        <div>
          <span className="section-label">TODAY’S BUDGETS</span>
          <h2>{controls?.limits.length ? `${controls.limits.length} active` : 'No limits yet'}</h2>
        </div>
      </div>

      {controls?.limits.length ? (
        <div className="limits-list">
          {controls.limits.map((limit) => {
            const color = limit.percent >= 100 ? '#FF375F' : limit.percent >= 80 ? '#FF9F0A' : limit.color
            return (
              <Card className="limit-row" key={limit.id}>
                <span className="limit-dot" style={{ background: limit.color }} />
                <div className="limit-body">
                  <div className="limit-title">
                    <strong>{limit.targetName}</strong>
                    <span>{limit.targetType === 'app' ? 'App' : 'Category'}</span>
                  </div>
                  <ProgressBar percent={limit.percent} color={color} height={6} />
                  <div className="limit-meta">
                    <span>{formatDuration(limit.usedSeconds)} used today</span>
                    <span>{formatDuration(limit.dailyLimitSeconds)} daily</span>
                  </div>
                </div>
                <span className={`limit-percent ${limit.percent >= 80 ? 'is-near' : ''}`}>{limit.percent}<small>%</small></span>
                <button className="ghost-danger" onClick={() => void onRemove(limit)} aria-label={`Remove limit for ${limit.targetName}`}><Trash2 size={14} /></button>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="note-card">
          <EmptyState icon={<Gauge size={18} />} title="No limits yet" note="Add a daily budget above and Stilltime will remind you when it matters." />
        </Card>
      )}
    </>
  )
}
