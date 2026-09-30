import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { CATEGORY_COLORS, formatDuration, initials } from './lib'
import type { CategoryName, TimeRange } from '../../shared/types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow: string; title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  )
}

export function SegmentedControl({ value, onChange }: { value: TimeRange; onChange: (next: TimeRange) => void }) {
  return (
    <div className="segmented" role="tablist" aria-label="Time range">
      {(['day', 'week'] as TimeRange[]).map((range) => (
        <button
          key={range}
          role="tab"
          aria-selected={value === range}
          className={value === range ? 'is-active' : ''}
          onClick={() => onChange(range)}
        >
          {range === 'day' ? 'Day' : 'Week'}
        </button>
      ))}
    </div>
  )
}

export function DateStepper({ label, onBack, onForward, forwardDisabled }: { label: string; onBack: () => void; onForward: () => void; forwardDisabled: boolean }) {
  return (
    <div className="stepper">
      <button onClick={onBack} aria-label="Previous period"><ArrowLeft size={14} /></button>
      <span>{label}</span>
      <button onClick={onForward} disabled={forwardDisabled} aria-label="Next period"><ArrowRight size={14} /></button>
    </div>
  )
}

export function ProgressBar({ percent, color, height = 6 }: { percent: number; color: string; height?: number }) {
  return (
    <div className="progress" style={{ height }}>
      <span style={{ width: `${Math.max(percent > 0 ? 2 : 0, Math.min(100, percent))}%`, background: color }} />
    </div>
  )
}

export function AppAvatar({ name, category, icon, size = 32 }: { name: string; category: CategoryName; icon?: string | null; size?: number }) {
  if (icon) {
    return <span className="avatar avatar-image" style={{ width: size, height: size }}><img src={icon} alt="" /></span>
  }
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
  return (
    <span className="avatar" style={{ width: size, height: size, background: `${color}22`, color }}>
      {initials(name)}
    </span>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  )
}

export function DeltaChip({ tone }: { tone: 'above' | 'below' | 'even' }) {
  const Icon = tone === 'above' ? ArrowUpRight : tone === 'below' ? ArrowDownRight : Minus
  return <span className={`delta-chip delta-${tone}`}><Icon size={13} /></span>
}

export function StatCard({ icon, label, value, note, tone = 'blue' }: { icon: ReactNode; label: string; value: string; note: string; tone?: 'blue' | 'violet' | 'green' }) {
  return (
    <Card className="stat-card">
      <span className={`stat-icon tone-${tone}`}>{icon}</span>
      <div className="stat-copy">
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </Card>
  )
}

export function AppRow({ name, category, icon, seconds, maxSeconds, trailing }: {
  name: string
  category: CategoryName
  icon?: string | null
  seconds: number
  maxSeconds: number
  trailing?: ReactNode
}) {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
  return (
    <div className="app-row">
      <AppAvatar name={name} category={category} icon={icon} />
      <div className="app-row-body">
        <div className="app-row-title">
          <strong>{name}</strong>
          <span className="app-row-category">{category}</span>
        </div>
        <ProgressBar percent={maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0} color={color} height={5} />
      </div>
      <span className="app-row-time">{formatDuration(seconds)}</span>
      {trailing}
    </div>
  )
}

export function EmptyState({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <span>{note}</span>
    </div>
  )
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="loading-rows">
      {Array.from({ length: rows }, (_, index) => <span key={index} className="skeleton" />)}
    </div>
  )
}
