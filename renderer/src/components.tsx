import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'
import { CATEGORY_COLORS, formatDuration, initials } from './lib'
import type { CategoryName, TimeRange } from '../../shared/types'

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <rect width="32" height="32" rx="7.2" fill="#0a84ff" />
      <path
        d="M5.76 16.64 L10.88 16.64 L13.76 10.56 L16.96 22.4 L19.84 13.76 L22.4 16.64 L26.24 16.64"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
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

export function AppAvatar({ name, category, icon, size = 26 }: { name: string; category: CategoryName; icon?: string | null; size?: number }) {
  if (icon) {
    return <span className="avatar avatar-image" style={{ width: size, height: size }}><img src={icon} alt="" /></span>
  }
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
  return (
    <span className="avatar" style={{ width: size, height: size, background: `${color}1f`, color }}>
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
  return <span className={`delta-chip delta-${tone}`}><Icon size={12} /></span>
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function AppRow({ name, category, icon, seconds, maxSeconds }: {
  name: string
  category: CategoryName
  icon?: string | null
  seconds: number
  maxSeconds: number
}) {
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
  return (
    <div className="row">
      <AppAvatar name={name} category={category} icon={icon} />
      <div className="row-body">
        <div className="row-title">
          <strong>{name}</strong>
        </div>
        <ProgressBar percent={maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0} color={color} height={4} />
      </div>
      <span className="row-time">{formatDuration(seconds)}</span>
    </div>
  )
}

export function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="empty-state">
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
