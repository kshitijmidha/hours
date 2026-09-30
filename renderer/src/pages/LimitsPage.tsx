import { ChevronDown, Plus, Trash2 } from 'lucide-react'
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
      <PageHeader title="Limits" subtitle="A daily budget per app or category, with a quiet nudge when you reach it" />

      <Card className="editor-card">
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
          <span>Notifies at 80% and 100%. Nothing is ever blocked.</span>
        </div>
      </Card>

      {controls?.limits.length ? (
        <div className="limits-list" style={{ marginTop: 14 }}>
          {controls.limits.map((limit) => {
            const color = limit.percent >= 100 ? '#FF453A' : limit.percent >= 80 ? '#FF9F0A' : limit.color
            return (
              <Card className="limit-row" key={limit.id}>
                <span className="limit-dot" style={{ background: limit.color }} />
                <div className="limit-body">
                  <div className="limit-title">
                    <strong>{limit.targetName}</strong>
                    <span className="limit-used">{formatDuration(limit.usedSeconds)} of {formatDuration(limit.dailyLimitSeconds)}</span>
                  </div>
                  <ProgressBar percent={limit.percent} color={color} height={5} />
                </div>
                <span className={`limit-percent ${limit.percent >= 80 ? 'is-near' : ''}`}>{limit.percent}<small>%</small></span>
                <button className="ghost-danger" onClick={() => void onRemove(limit)} aria-label={`Remove limit for ${limit.targetName}`}><Trash2 size={14} /></button>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="note-card">
          <EmptyState title="No limits yet" note="Add a daily budget above and Stilltime will remind you when it matters." />
        </Card>
      )}
    </>
  )
}
