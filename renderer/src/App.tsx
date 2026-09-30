import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, ChevronDown, Clock3, Command, FolderKanban, Gauge, LayoutDashboard, Moon, Pause,
  Play, Search, Settings2, ShieldCheck, Sparkles, Sun, Timer, X,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AppDirectoryEntry, CategoryName, DashboardData, TimeRange, UsageApp } from '../../shared/types'

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

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => window.stilltime.onStatus((status) => {
    setPaused(!status.tracking)
    void refresh()
  }), [refresh])
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
  const trackerText = paused ? 'Tracking paused' : data?.status.idle ? 'Taking a little break' : 'Tracking quietly'
  const currentDateLabel = dayLabel(selectedDate, range)

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
        {['Limits', 'Downtime', 'Settings'].includes(section) && <ComingSoon section={section} />}
        <footer className="page-footer"><span>Made for a little more mindful time.</span><span><ShieldCheck size={12} /> Your day, stored locally</span></footer>
      </div>
    </main>
  </div>
}

export default App
