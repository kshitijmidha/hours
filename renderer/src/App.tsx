import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bell,
  CalendarDays, Check, ChevronDown, Clock3, Command, FolderKanban, Gauge, LayoutDashboard, Moon,
  Pause, Play, Plus, Search, Settings2, ShieldCheck, Sparkles, Sun, Timer, Trash2, X,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AppDirectoryEntry, CategoryName, ControlSnapshot, DashboardData, LimitTargetType, TimeRange, UsageApp } from '../../shared/types'

type Section = 'Overview' | 'Apps' | 'Categories' | 'Limits' | 'Downtime' | 'Settings'
const categoryNames: CategoryName[] = ['Productivity', 'Social', 'Entertainment', 'Development', 'Browsing', 'Other']
const categoryFallbacks: Record<CategoryName, string> = {
  Productivity: '#30D158', Social: '#BF5AF2', Entertainment: '#FF375F',
  Development: '#0A84FF', Browsing: '#64D2FF', Other: '#9095a3',
}
const navItems: Array<{ label: Section; icon: typeof LayoutDashboard; group?: string }> = [
  { label: 'Overview', icon: LayoutDashboard, group: 'YOUR TIME' },
  { label: 'Apps', icon: Command },
  { label: 'Categories', icon: FolderKanban },
  { label: 'Limits', icon: Gauge, group: 'YOUR BOUNDARIES' },
  { label: 'Downtime', icon: Moon },
  { label: 'Settings', icon: Settings2, group: 'PREFERENCES' },
]

function formatDuration(seconds: number, compact = false) {
  const wholeMinutes = Math.max(0, Math.round(seconds / 60))
  const hours = Math.floor(wholeMinutes / 60)
  const minutes = wholeMinutes % 60
  if (hours === 0) return `${wholeMinutes}m`
  if (compact && minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatAxisTime(seconds: number) {
  if (seconds < 60) return '0m'
  const hours = seconds / 3600
  return hours >= 1 ? `${Math.round(hours * 10) / 10}h` : `${Math.round(seconds / 60)}m`
}

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
}

function dayLabel(dateKey: string, range: TimeRange) {
  const date = new Date(`${dateKey}T12:00:00`)
  const today = todayKey()
  if (dateKey === today) return range === 'week' ? 'This week' : 'Today'
  if (dateKey === shiftDate(today, -1)) return 'Yesterday'
  return range === 'week'
    ? `Week of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

function SegmentedControl({ value, onChange }: { value: TimeRange; onChange: (next: TimeRange) => void }) {
  return <div className="segmented-control" role="tablist" aria-label="Time range">
    {(['day', 'week'] as TimeRange[]).map((range) => <button key={range} className={value === range ? 'active' : ''} role="tab" aria-selected={value === range} onClick={() => onChange(range)}>{range === 'day' ? 'Day' : 'Week'}</button>)}
  </div>
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return <div className="progress-track"><span style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: color }} /></div>
}

function AppAvatar({ name, category, icon }: { name: string; category: CategoryName; icon?: string | null }) {
  if (icon) return <div className="app-avatar app-avatar-image"><img src={icon} alt="" /></div>
  const color = categoryFallbacks[category]
  return <div className="app-avatar" style={{ '--app-color': color } as React.CSSProperties}>{name.trim().slice(0, 1).toUpperCase() || '•'}</div>
}

function AppRow({
  app, maxSeconds, icon, editable = false, onCategoryChange,
}: {
  app: UsageApp | AppDirectoryEntry
  maxSeconds: number
  icon?: string | null
  editable?: boolean
  onCategoryChange?: (category: CategoryName) => void
}) {
  const seconds = 'seconds' in app ? app.seconds : 0
  const color = app.categoryColor || categoryFallbacks[app.category]
  return <div className={`app-row ${editable ? 'app-row-editable' : ''}`}>
    <AppAvatar name={app.name} category={app.category} icon={icon} />
    <div className="app-row-main">
      <div className="app-row-title"><strong>{app.name}</strong><span className="app-category-tag"><i style={{ background: color }} />{app.category}</span></div>
      <ProgressBar percent={maxSeconds ? (seconds / maxSeconds) * 100 : 0} color={color} />
    </div>
    {editable ? <label className="category-select-wrap"><span className="sr-only">Category for {app.name}</span><select value={app.category} onChange={(event) => onCategoryChange?.(event.target.value as CategoryName)}>{categoryNames.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={13} /></label> : <span className="app-time">{formatDuration(seconds)}</span>}
  </div>
}

function StatCard({ label, value, note, icon: Icon, color }: { label: string; value: string; note: string; icon: typeof Clock3; color: string }) {
  return <Card className="stat-card"><div className="stat-icon" style={{ '--stat-color': color } as React.CSSProperties}><Icon size={16} /></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></Card>
}

function EmptyChart() {
  return <div className="chart-empty"><div className="chart-empty-icon"><BarChart3 size={21} /></div><strong>Nothing recorded yet</strong><span>When you spend a little time on your device, it’ll show up here.</span></div>
}

function UsageTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, item) => sum + Number(item.value || 0), 0)
  return <div className="chart-tooltip"><strong>{label}</strong><span className="tooltip-total">{formatDuration(total)}</span>{payload.filter((item) => Number(item.value) > 0).map((item) => <div key={item.name} className="tooltip-line"><i style={{ background: item.color }} />{item.name}<span>{formatDuration(Number(item.value))}</span></div>)}</div>
}

function Overview({ data, range, selectedDate, setRange, setSelectedDate, icons }: {
  data: DashboardData | null
  range: TimeRange
  selectedDate: string
  setRange: (range: TimeRange) => void
  setSelectedDate: (date: string) => void
  icons: Record<number, string | null>
}) {
  const chartData = useMemo(() => (data?.buckets ?? []).map((bucket) => ({
    label: bucket.label,
    totalSeconds: bucket.totalSeconds,
    ...bucket.categories,
  })), [data])
  const maxAppSeconds = data?.apps[0]?.seconds ?? 0
  const today = todayKey()
  const isFuture = selectedDate >= today
  const comparison = data ? data.totalSeconds - data.averageSeconds : 0
  return <>
    <div className="page-heading-row">
      <div className="page-heading-copy"><div className="eyebrow"><span className="eyebrow-spark"><Sparkles size={12} /></span> YOUR DAY, IN PERSPECTIVE</div><h1>Make room for <em>what matters.</em></h1><p>A gentle look at where your attention went.</p></div>
      <div className="range-picker">
        <div className="date-stepper"><button aria-label="Previous date" onClick={() => setSelectedDate(shiftDate(selectedDate, range === 'day' ? -1 : -7))}><ArrowLeft size={15} /></button><div className="date-stepper-label"><CalendarDays size={14} /><span>{dayLabel(selectedDate, range)}</span></div><button aria-label="Next date" disabled={isFuture} onClick={() => setSelectedDate(shiftDate(selectedDate, range === 'day' ? 1 : 7))}><ArrowRight size={15} /></button></div>
        <SegmentedControl value={range} onChange={setRange} />
      </div>
    </div>

    <section className="hero-card">
      <div className="hero-grain" />
      <div className="hero-copy"><div className="hero-overline">TOTAL SCREEN TIME <span>{range === 'day' ? 'DAY VIEW' : 'WEEK VIEW'}</span></div><div className="hero-time">{data ? formatDuration(data.totalSeconds) : <span className="skeleton skeleton-time" />}</div>
        <div className="hero-comparison">{data && (range === 'day' ? <><span className={`comparison-icon ${comparison <= 0 ? 'down' : ''}`}>{comparison > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span><span>{comparison === 0 ? 'Right around your daily average' : `${formatDuration(Math.abs(comparison))} ${comparison > 0 ? 'above' : 'below'} your daily average`}</span></> : <><span className="comparison-icon neutral"><Activity size={14} /></span><span>Daily average <strong>{formatDuration(data.averageSeconds)}</strong> this week</span></>)}</div>
      </div>
      <div className="hero-visual" aria-hidden="true"><div className="hero-ring ring-a" /><div className="hero-ring ring-b" /><div className="hero-ring ring-c" /><div className="hero-spark spark-a" /><div className="hero-spark spark-b" /><div className="hero-center"><div><Activity size={27} /></div></div></div>
      <div className="hero-bottom"><span><i className={`tracker-light ${data?.status.tracking ? 'is-live' : ''}`} />{data?.status.tracking ? data.status.idle ? 'You’re taking a break' : data.status.currentApp ? `Now using ${data.status.currentApp}` : 'Tracking quietly' : 'Tracking paused'}</span><span>{data?.hasDemoData && <span className="sample-label"><Sparkles size={11} /> Sample week</span>}<span className="local-label"><ShieldCheck size={12} /> Only on this device</span></span></div>
    </section>

    <div className="stats-row">
      <StatCard label={range === 'day' ? 'SCREEN TIME' : 'THIS WEEK'} value={data ? formatDuration(data.totalSeconds) : '—'} note={range === 'day' ? 'Across all your apps' : 'Across the last 7 days'} icon={Clock3} color="#5388ec" />
      <StatCard label="DAILY AVERAGE" value={data ? formatDuration(data.averageSeconds) : '—'} note="A steady, thoughtful rhythm" icon={BarChart3} color="#9473df" />
      <StatCard label="APPS USED" value={data ? `${data.appCount}` : '—'} note={data?.status.currentApp ? `Focused on ${data.status.currentApp}` : 'A little bit of everything'} icon={Command} color="#38a779" />
    </div>

    <div className="dashboard-grid">
      <Card className="usage-chart-card">
        <div className="card-heading chart-heading"><div><div className="section-kicker">YOUR ACTIVITY</div><h2>{range === 'day' ? 'A day in your apps' : 'Your week, at a glance'}</h2></div><div className="chart-period">{range === 'day' ? 'BY HOUR' : 'BY DAY'}<span><i /> Time used</span></div></div>
        {data && data.totalSeconds > 0 ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 2, left: -22, bottom: 0 }} barCategoryGap={range === 'day' ? '24%' : '42%'}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={range === 'day' ? 2 : 0} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 9 }} tickFormatter={formatAxisTime} width={38} />
          <Tooltip content={<UsageTooltip />} cursor={{ fill: 'var(--chart-hover)', radius: 6 }} />
          {categoryNames.map((category, index) => <Bar key={category} dataKey={category} stackId="time" fill={categoryFallbacks[category]} radius={index === categoryNames.length - 1 ? [6, 6, 0, 0] : 0} maxBarSize={range === 'day' ? 16 : 40} animationDuration={450} />)}
        </BarChart></ResponsiveContainer></div> : data ? <EmptyChart /> : <div className="chart-loading"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>}
        <div className="chart-legend">{data?.categories.filter((item) => item.seconds > 0).map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}</div>
      </Card>

      <Card className="most-used-card">
        <div className="card-heading"><div><div className="section-kicker">WHERE TIME GOES</div><h2>Most used</h2></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('stilltime:navigate', { detail: 'Apps' }))}>All apps <ArrowRight size={13} /></button></div>
        {data?.apps.length ? <div className="most-used-list">{data.apps.slice(0, 5).map((item) => <AppRow key={item.id} app={item} maxSeconds={maxAppSeconds} icon={icons[item.id]} />)}</div> : data ? <div className="small-empty"><Sparkles size={17} /><span>Your favorite apps will find their way here.</span></div> : <div className="app-loading"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>}
        {data?.apps.length ? <div className="most-used-foot"><span>Keeping it all in perspective</span><span>{data.apps.length} apps</span></div> : null}
      </Card>
    </div>

    <Card className="category-strip-card"><div className="category-strip-head"><div><div className="section-kicker">THE BIG PICTURE</div><h2>Time well-spent, by category</h2></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('stilltime:navigate', { detail: 'Categories' }))}>Explore categories <ArrowRight size={13} /></button></div>
      {data?.categories.some((item) => item.seconds > 0) ? <><div className="category-stacks">{data.categories.filter((item) => item.seconds > 0).map((item) => <div className="category-stack" key={item.name} style={{ flexGrow: Math.max(item.seconds, 1), '--stack-color': item.color } as React.CSSProperties} title={`${item.name}: ${formatDuration(item.seconds)}`}><span /></div>)}</div><div className="category-summary">{data.categories.filter((item) => item.seconds > 0).slice(0, 4).map((item) => <div className="category-summary-item" key={item.name}><span className="category-dot" style={{ background: item.color }} /><span>{item.name}</span><strong>{formatDuration(item.seconds)}</strong><small>{item.percent}%</small></div>)}</div></> : <p className="category-empty">Your categories will appear here as you use your apps.</p>}
    </Card>
  </>
}

function AppsPage({ directory, data, icons, onCategoryChange }: {
  directory: AppDirectoryEntry[]
  data: DashboardData | null
  icons: Record<number, string | null>
  onCategoryChange: (id: number, category: CategoryName) => void
}) {
  const [query, setQuery] = useState('')
  const currentUsage = new Map(data?.apps.map((item) => [item.id, item]) ?? [])
  const filtered = directory.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
  const maxSeconds = Math.max(0, ...[...currentUsage.values()].map((item) => item.seconds))
  return <>
    <div className="subpage-heading"><div className="eyebrow"><span className="eyebrow-spark"><Command size={12} /></span> YOUR DIGITAL LIFE</div><h1>All your apps, <em>in view.</em></h1><p>See what’s getting your attention, and put each app in its right place.</p></div>
    <div className="subpage-toolbar"><div className="toolbar-copy"><strong>{directory.length} apps tracked</strong><span>Categories are automatic. You can change them anytime.</span></div><label className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an app" /><kbd>⌘ K</kbd>{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}</label></div>
    <Card className="apps-directory-card"><div className="apps-table-head"><span>APPLICATION</span><span>TIME SPENT</span><span>CATEGORY</span></div>{filtered.length ? filtered.map((item) => <AppRow key={item.id} app={{ ...item, seconds: currentUsage.get(item.id)?.seconds ?? 0 }} maxSeconds={maxSeconds} icon={icons[item.id]} editable onCategoryChange={(category) => onCategoryChange(item.id, category)} />) : <div className="empty-directory"><Search size={20} /><strong>No apps found</strong><span>Try another name.</span></div>}</Card>
    <p className="privacy-caption"><ShieldCheck size={14} /> App activity and categories are saved only on this device.</p>
  </>
}

function CategoriesPage({ data, directory }: { data: DashboardData | null; directory: AppDirectoryEntry[] }) {
  return <>
    <div className="subpage-heading"><div className="eyebrow"><span className="eyebrow-spark"><FolderKanban size={12} /></span> A HEALTHIER BALANCE</div><h1>Your time has <em>different colors.</em></h1><p>Group your apps by what you do, and see the shape of your attention.</p></div>
    <div className="category-overview-grid">{categoryNames.map((name) => {
      const usage = data?.categories.find((item) => item.name === name)
      const apps = directory.filter((item) => item.category === name)
      return <Card className="category-overview-card" key={name}><div className="category-card-top"><span className="category-big-dot" style={{ background: categoryFallbacks[name] }} /><span className="category-app-count">{apps.length} {apps.length === 1 ? 'app' : 'apps'}</span></div><strong className="category-name">{name}</strong><span className="category-time">{formatDuration(usage?.seconds ?? 0)}</span><ProgressBar percent={usage?.percent ?? 0} color={categoryFallbacks[name]} /><span className="category-description">{usage?.percent ?? 0}% of your {data?.range === 'week' ? 'week' : 'day'}</span></Card>
    })}</div>
    <Card className="category-note-card"><div className="category-note-icon"><Sparkles size={17} /></div><div><strong>A little context goes a long way.</strong><p>Apps are sorted automatically from their name and executable. You can fine-tune any app on the Apps page.</p></div><button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('stilltime:navigate', { detail: 'Apps' }))}>Organize apps <ArrowRight size={13} /></button></Card>
  </>
}

function LimitsPage({ controls, onSave, onRemove }: {
  controls: ControlSnapshot | null
  onSave: (targetType: LimitTargetType, targetId: number, seconds: number) => Promise<void>
  onRemove: (limit: ControlSnapshot['limits'][number]) => Promise<void>
}) {
  const defaultTarget = controls?.apps[0] ? `app|${controls.apps[0].id}` : controls?.categories[0] ? `category|${controls.categories[0].id}` : ''
  const [target, setTarget] = useState(defaultTarget)
  const [minutes, setMinutes] = useState('120')
  useEffect(() => { if (!target && defaultTarget) setTarget(defaultTarget) }, [defaultTarget, target])
  const [targetType = 'app', rawId = ''] = target.split('|')
  const targetId = Number(rawId)
  const canSave = targetId > 0 && Number(minutes) >= 15 && Number(minutes) <= 1440
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    await onSave(targetType as LimitTargetType, targetId, Math.round(Number(minutes) * 60))
  }
  return <>
    <div className="subpage-heading"><div className="eyebrow"><span className="eyebrow-spark"><Gauge size={12} /></span> KINDER BOUNDARIES</div><h1>Set a limit, <em>not a hard stop.</em></h1><p>Get a small nudge at 80%, and a clear one when your daily time is up.</p></div>
    <Card className="limit-editor-card"><div className="limit-editor-heading"><span className="limit-editor-icon"><Bell size={16} /></span><div><strong>A daily reminder</strong><span>Your apps keep working. You just get a moment to choose.</span></div></div><form className="limit-form" onSubmit={(event) => void save(event)}><label className="limit-target"><span>SET A LIMIT FOR</span><select value={target} onChange={(event) => setTarget(event.target.value)}><optgroup label="Apps">{controls?.apps.map((item) => <option key={item.id} value={`app|${item.id}`}>{item.name}</option>)}</optgroup><optgroup label="Categories">{controls?.categories.map((item) => <option key={item.id} value={`category|${item.id}`}>{item.name}</option>)}</optgroup></select><ChevronDown size={13} /></label><label className="limit-minutes"><span>DAILY BUDGET</span><div><input type="number" min="15" max="1440" step="15" value={minutes} onChange={(event) => setMinutes(event.target.value)} /><span>minutes</span></div></label><button className="primary-button" type="submit" disabled={!canSave}><Plus size={14} /> Add limit</button></form><div className="limit-editor-foot"><span><i className="threshold-dot threshold-80" /> A heads-up at 80%</span><span><i className="threshold-dot threshold-100" /> Daily limit reached at 100%</span><span><ShieldCheck size={12} /> Notices stay on this device</span></div></Card>
    <div className="control-section-heading"><div><span className="section-kicker">YOUR DAILY BUDGETS</span><h2>Limits in place</h2></div><span>{controls?.limits.length ?? 0} active</span></div>
    {controls?.limits.length ? <div className="limits-list">{controls.limits.map((limit) => {
      const progressColor = limit.percent >= 100 ? '#ff375f' : limit.percent >= 80 ? '#ff9f0a' : limit.color
      return <Card className="limit-row-card" key={limit.id}><span className="limit-target-dot" style={{ background: limit.color }} /><div className="limit-row-main"><div className="limit-row-title"><strong>{limit.targetName}</strong><span>{limit.targetType === 'app' ? 'App limit' : 'Category limit'}</span></div><ProgressBar percent={limit.percent} color={progressColor} /><div className="limit-row-usage"><span>{formatDuration(limit.usedSeconds)} used today</span><span>{formatDuration(limit.dailyLimitSeconds)} daily</span></div></div><div className={`limit-percent ${limit.percent >= 80 ? 'near-limit' : ''}`}>{Math.min(limit.percent, 999)}<small>%</small></div><button className="remove-limit" title={`Remove ${limit.targetName} limit`} onClick={() => void onRemove(limit)}><Trash2 size={14} /></button></Card>
    })}</div> : <Card className="controls-empty"><div className="controls-empty-icon"><Gauge size={19} /></div><strong>Nothing to limit, yet.</strong><span>Add a daily budget above and we’ll give you a gentle reminder when it matters.</span></Card>}
  </>
}

function DowntimePage({ controls, icons, onScheduleChange, onAllowChange }: {
  controls: ControlSnapshot | null
  icons: Record<number, string | null>
  onScheduleChange: (enabled: boolean, start: string, end: string) => Promise<void>
  onAllowChange: (appId: number, allowed: boolean) => Promise<void>
}) {
  const [start, setStart] = useState(controls?.downtime.start ?? '23:00')
  const [end, setEnd] = useState(controls?.downtime.end ?? '07:00')
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!controls) return
    setStart(controls.downtime.start)
    setEnd(controls.downtime.end)
  }, [controls?.downtime.start, controls?.downtime.end])
  const eligibleApps = (controls?.apps ?? []).filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
  return <>
    <div className="subpage-heading"><div className="eyebrow"><span className="eyebrow-spark"><Moon size={12} /></span> SPACE TO REST</div><h1>Make space for <em>offline time.</em></h1><p>Choose a quiet window. If you open an app, we’ll gently remind you why you set it.</p></div>
    <Card className="downtime-card"><div className="downtime-top"><div className="downtime-orb"><Moon size={18} /></div><div className="downtime-copy"><strong>Scheduled downtime</strong><span>Get a gentle notification when you open an app during your quiet hours.</span></div><button className={`switch ${controls?.downtime.enabled ? 'switch-on' : ''}`} role="switch" aria-checked={controls?.downtime.enabled ?? false} aria-label="Enable scheduled downtime" onClick={() => void onScheduleChange(!controls?.downtime.enabled, start, end)}><i /></button></div><div className="schedule-picker"><label><span>STARTS</span><input type="time" value={start} onChange={(event) => { setStart(event.target.value); void onScheduleChange(Boolean(controls?.downtime.enabled), event.target.value, end) }} /></label><span className="schedule-arrow">to</span><label><span>ENDS</span><input type="time" value={end} onChange={(event) => { setEnd(event.target.value); void onScheduleChange(Boolean(controls?.downtime.enabled), start, event.target.value) }} /></label><span className="schedule-preset"><Clock3 size={13} /> A quiet {start} – {end}</span></div><div className="downtime-helper"><Sparkles size={13} /><span>Downtime never blocks an app — it just gives you a moment to pause.</span></div></Card>
    <div className="control-section-heading allow-heading"><div><span className="section-kicker">A FEW EXCEPTIONS</span><h2>Always allowed</h2><p>Keep the essentials close, even during downtime.</p></div><label className="search-field allow-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an app" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}</label></div>
    <Card className="allow-list">{eligibleApps.length ? eligibleApps.map((item) => {
      const allowed = controls?.alwaysAllowedIds.includes(item.id) ?? false
      return <div className="allow-row" key={item.id}><AppAvatar name={item.name} category={item.category} icon={icons[item.id]} /><div className="allow-app"><strong>{item.name}</strong><span><i style={{ background: item.categoryColor }} />{item.category}</span></div><label className="allow-check"><input type="checkbox" checked={allowed} onChange={(event) => void onAllowChange(item.id, event.target.checked)} /><span><Check size={11} /></span><strong>{allowed ? 'Always allowed' : 'Allow during downtime'}</strong></label></div>
    }) : <div className="controls-empty compact"><strong>No apps match that search.</strong></div>}</Card>
  </>
}

function SettingsPage({ paused, onPause, onSeedDemo, onDeleteAll }: {
  paused: boolean
  onPause: () => void
  onSeedDemo: () => Promise<void>
  onDeleteAll: () => Promise<void>
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const seedDemo = async () => { setBusy(true); await onSeedDemo(); setBusy(false) }
  const deleteAll = async () => { setBusy(true); await onDeleteAll(); setBusy(false); setConfirming(false) }
  return <>
    <div className="subpage-heading"><div className="eyebrow"><span className="eyebrow-spark"><Settings2 size={12} /></span> YOUR SPACE</div><h1>Make it feel <em>like yours.</em></h1><p>Small choices, thoughtfully kept on your device.</p></div>
    <div className="settings-list">
      <Card className="settings-row"><span className="settings-row-icon tracking"><Activity size={16} /></span><div className="settings-row-copy"><strong>Screen time tracking</strong><span>{paused ? 'Paused — your day is not being recorded.' : 'Running quietly in the background.'}</span></div><button className="settings-action-button" onClick={onPause}>{paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}</button></Card>
      <Card className="settings-row"><span className="settings-row-icon sample"><Sparkles size={16} /></span><div className="settings-row-copy"><strong>Sample activity</strong><span>Fill your dashboard with a believable two-week sample.</span></div><button className="settings-action-button" disabled={busy} onClick={() => void seedDemo()}><Activity size={13} /> Refresh sample</button></Card>
      <Card className="settings-row danger-setting"><span className="settings-row-icon danger"><Trash2 size={15} /></span><div className="settings-row-copy"><strong>Delete all data</strong><span>Remove tracked sessions, apps, limits, and allowed apps from this device.</span></div><button className="danger-button" onClick={() => setConfirming(true)}><Trash2 size={13} /> Delete data</button></Card>
    </div>
    <Card className="settings-privacy"><ShieldCheck size={16} /><div><strong>Private by design.</strong><span>Stilltime has no accounts, cloud sync, or telemetry. Your SQLite database stays in this computer’s local app data folder.</span></div></Card>
    {confirming && <div className="modal-backdrop" role="presentation"><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span className="confirm-icon"><AlertTriangle size={19} /></span><h2 id="delete-title">Delete everything?</h2><p>Your activity history, app list, limits, and always-allowed apps will be removed from this device. This can’t be undone.</p><div className="confirm-actions"><button className="cancel-button" onClick={() => setConfirming(false)}>Keep my data</button><button className="danger-button" disabled={busy} onClick={() => void deleteAll()}><Trash2 size={13} /> Delete everything</button></div></section></div>}
  </>
}

function ComingSoon({ section }: { section: Section }) {
  const detail = section === 'Limits'
    ? ['Gentle app limits', 'Create daily time budgets and get a thoughtful nudge when you’re close.']
    : section === 'Downtime'
      ? ['A little offline space', 'Choose a quiet window in your day, with the apps that can always stay close.']
      : ['Your space, your pace', 'Choose the small details that make Stilltime feel like yours.']
  return <div className="coming-page"><div className="coming-orb"><Timer size={28} /></div><div className="eyebrow"><span className="eyebrow-spark"><Sparkles size={12} /></span> MORE MINDFUL TOOLS</div><h1>{detail[0]}</h1><p>{detail[1]}</p><span className="coming-badge"><Check size={12} /> Coming in the next update</span></div>
}

function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [range, setRange] = useState<TimeRange>('day')
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [data, setData] = useState<DashboardData | null>(null)
  const [controls, setControls] = useState<ControlSnapshot | null>(null)
  const [directory, setDirectory] = useState<AppDirectoryEntry[]>([])
  const [icons, setIcons] = useState<Record<number, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [appearance, setAppearance] = useState<'light' | 'dark'>('light')

  const refresh = useCallback(async () => {
    const next = await window.stilltime.getDashboard(range, selectedDate)
    setData(next)
    setPaused(!next.status.tracking)
    setLoading(false)
  }, [range, selectedDate])

  const refreshControls = useCallback(async () => {
    setControls(await window.stilltime.getControls())
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { void refreshControls() }, [refreshControls])
  useEffect(() => window.stilltime.onStatus((status) => {
    setPaused(!status.tracking)
    void refresh()
    if (section === 'Limits' || section === 'Downtime') void refreshControls()
  }), [refresh, refreshControls, section])
  useEffect(() => { void window.stilltime.getAppDirectory().then(setDirectory) }, [])
  useEffect(() => {
    let cancelled = false
    const uncached = directory.filter((item) => !(item.id in icons)).slice(0, 42)
    if (!uncached.length) return
    void Promise.all(uncached.map(async (item) => [item.id, await window.stilltime.getAppIcon(item.id)] as const)).then((pairs) => {
      if (cancelled) return
      setIcons((current) => ({ ...current, ...Object.fromEntries(pairs) }))
    })
    return () => { cancelled = true }
  }, [directory, icons])
  useEffect(() => {
    const handler = (event: Event) => setSection((event as CustomEvent<Section>).detail)
    window.addEventListener('stilltime:navigate', handler)
    return () => window.removeEventListener('stilltime:navigate', handler)
  }, [])

  const handleCategoryChange = async (id: number, category: CategoryName) => {
    await window.stilltime.setAppCategory(id, category)
    setDirectory((items) => items.map((item) => item.id === id ? { ...item, category, categoryColor: categoryFallbacks[category] } : item))
    await refresh()
  }
  const handleLimitSave = async (type: LimitTargetType, id: number, seconds: number) => {
    await window.stilltime.setLimit(type, id, seconds)
    await refreshControls()
  }
  const handleLimitRemove = async (limit: ControlSnapshot['limits'][number]) => {
    await window.stilltime.setLimit(limit.targetType, limit.targetId, null)
    await refreshControls()
  }
  const handleDowntimeChange = async (enabled: boolean, start: string, end: string) => {
    await window.stilltime.setDowntime({ enabled, start, end })
    await refreshControls()
  }
  const handleAlwaysAllowed = async (appId: number, allowed: boolean) => {
    await window.stilltime.setAlwaysAllowed(appId, allowed)
    await refreshControls()
  }
  const handleSeedDemo = async () => {
    await window.stilltime.seedDemoData()
    setDirectory(await window.stilltime.getAppDirectory())
    setIcons({})
    await Promise.all([refresh(), refreshControls()])
  }
  const handleDeleteAll = async () => {
    await window.stilltime.deleteAllData()
    setDirectory(await window.stilltime.getAppDirectory())
    setIcons({})
    await Promise.all([refresh(), refreshControls()])
  }
  const trackerText = paused ? 'Tracking paused' : data?.status.idle ? 'Taking a little break' : 'Tracking quietly'

  return <div className={`app-shell theme-${appearance}`}>
    <aside className="sidebar">
      <div className="brand"><span className="brand-logo"><Activity size={17} strokeWidth={2.4} /></span><span>stilltime</span><span className="brand-edition">PRIVATE</span></div>
      <div className="nav-groups">{navItems.map(({ label, icon: Icon, group }, index) => <div key={label}>{group && <div className={`nav-group-label ${index > 0 ? 'nav-group-spaced' : ''}`}>{group}</div>}<button className={`nav-item ${section === label ? 'is-selected' : ''}`} onClick={() => setSection(label)}><span className="nav-icon"><Icon size={16} strokeWidth={section === label ? 2.2 : 1.8} /></span><span>{label}</span>{label === 'Limits' && <span className="nav-soon">NEW</span>}</button></div>)}</div>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><Sparkles size={14} /></span><div><strong>Time, with intention.</strong><span>Your data stays yours.</span></div></div><div className="sidebar-status"><i className={`status-indicator ${paused ? 'paused' : ''}`} /><span>{trackerText}</span><button onClick={() => void window.stilltime.setPaused(!paused)} aria-label={paused ? 'Resume tracking' : 'Pause tracking'}>{paused ? <Play size={13} /> : <Pause size={13} />}</button></div></div>
      <div className="sidebar-footer"><ShieldCheck size={12} /><span>Stored only on this device</span></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="topbar-left"><span className="breadcrumb">Your time</span><span className="breadcrumb-slash">/</span><strong>{section}</strong></div><div className="topbar-right"><span className="private-pill"><i /> Private by design</span><button className="appearance-toggle" aria-label="Toggle appearance" onClick={() => setAppearance(appearance === 'light' ? 'dark' : 'light')}>{appearance === 'light' ? <Moon size={15} /> : <Sun size={15} />}</button><span className="top-avatar">S</span></div></header>
      <div className={`content-wrap ${section !== 'Overview' ? 'content-wrap-subpage' : ''}`}>
        {loading && !data ? <div className="page-skeleton"><span className="skeleton skeleton-title" /><span className="skeleton skeleton-hero" /><span className="skeleton skeleton-chart" /></div> : null}
        {section === 'Overview' && <Overview data={data} range={range} selectedDate={selectedDate} setRange={setRange} setSelectedDate={setSelectedDate} icons={icons} />}
        {section === 'Apps' && <AppsPage directory={directory} data={data} icons={icons} onCategoryChange={(id, category) => void handleCategoryChange(id, category)} />}
        {section === 'Categories' && <CategoriesPage data={data} directory={directory} />}
        {section === 'Limits' && <LimitsPage controls={controls} onSave={handleLimitSave} onRemove={handleLimitRemove} />}
        {section === 'Downtime' && <DowntimePage controls={controls} icons={icons} onScheduleChange={handleDowntimeChange} onAllowChange={handleAlwaysAllowed} />}
        {section === 'Settings' && <SettingsPage paused={paused} onPause={() => void window.stilltime.setPaused(!paused)} onSeedDemo={handleSeedDemo} onDeleteAll={handleDeleteAll} />}
        <footer className="page-footer"><span>Made for a little more mindful time.</span><span><ShieldCheck size={12} /> Your day, stored locally</span></footer>
      </div>
    </main>
  </div>
}

export default App
