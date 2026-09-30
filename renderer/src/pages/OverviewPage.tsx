import { Activity, BarChart3, Clock3, Command, Sparkles, Trash2, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AppRow, Card, DateStepper, DeltaChip, EmptyState, LoadingRows, PageHeader, SegmentedControl, StatCard } from '../components'
import { CATEGORY_COLORS, CATEGORY_NAMES, comparison, formatDuration, periodLabel, shiftDate, todayKey } from '../lib'
import type { DashboardData, TimeRange, TrackerStatus } from '../../../shared/types'

interface ChartRow {
  label: string
  totalSeconds: number
  top: string
  [key: string]: string | number
}

interface BarShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  name?: string
  payload?: ChartRow
}

function RoundedBar({ x = 0, y = 0, width = 0, height = 0, fill, name, payload }: BarShapeProps) {
  if (height <= 0.5 || width <= 0) return null
  if (payload?.top !== name) {
    return <rect x={x} y={y} width={width} height={height} fill={fill} />
  }
  const radius = Math.min(5, width / 2, height)
  return (
    <path
      d={`M${x},${y + height} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + width - radius},${y} Q${x + width},${y} ${x + width},${y + radius} L${x + width},${y + height} Z`}
      fill={fill}
    />
  )
}

function UsageTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((item) => Number(item.value) > 0).sort((a, b) => Number(b.value) - Number(a.value))
  const total = rows.reduce((sum, item) => sum + Number(item.value ?? 0), 0)
  if (!total) return null
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-head">
        <span>{label}</span>
        <strong>{formatDuration(total)}</strong>
      </div>
      {rows.slice(0, 6).map((item) => (
        <div className="chart-tooltip-row" key={item.name}>
          <i style={{ background: item.color }} />
          <span>{item.name}</span>
          <em>{formatDuration(Number(item.value))}</em>
        </div>
      ))}
    </div>
  )
}

function TrendBars({ data }: { data: DashboardData }) {
  const max = Math.max(60, ...data.trend.map((point) => point.seconds))
  return (
    <div className="hero-trend">
      <span className="hero-trend-label">LAST 7 DAYS</span>
      <div className="hero-bars">
        {data.trend.map((point, index) => {
          const height = Math.max(4, Math.round((point.seconds / max) * 62))
          const isCurrent = index === data.trend.length - 1
          const isEmpty = point.seconds < 60
          return (
            <div className={`hero-bar-slot ${isEmpty ? 'is-empty' : ''}`} key={point.date} title={`${point.date} · ${formatDuration(point.seconds)}`}>
              <span className={`hero-bar ${isCurrent ? 'is-current' : ''}`} style={{ height: isEmpty ? 4 : height }} />
              <span className="hero-bar-label">{point.label.slice(0, 1)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function OverviewPage({ data, range, selectedDate, status, icons, onRangeChange, onDateChange, onRemoveDemo }: {
  data: DashboardData | null
  range: TimeRange
  selectedDate: string
  status: TrackerStatus | null
  icons: Record<number, string | null>
  onRangeChange: (range: TimeRange) => void
  onDateChange: (date: string) => void
  onRemoveDemo: () => void
}) {
  const chartData = useMemo<ChartRow[]>(() => (data?.buckets ?? []).map((bucket) => {
    let top = ''
    for (const name of CATEGORY_NAMES) if ((bucket.categories[name] ?? 0) > 0.5) top = name
    return { label: bucket.label, totalSeconds: bucket.totalSeconds, top, ...bucket.categories }
  }), [data])

  const delta = data ? comparison(data.totalSeconds, data.averageSeconds) : null
  const maxAppSeconds = data?.apps[0]?.seconds ?? 0
  const topCategories = data?.categories.filter((item) => item.seconds > 0) ?? []
  const hasActivity = Boolean(data && data.totalSeconds > 0)
  const forwardDisabled = selectedDate >= todayKey()

  const peak = useMemo(() => {
    if (!data || data.totalSeconds <= 0) return null
    return data.buckets.reduce((best, bucket) => (bucket.totalSeconds > best.totalSeconds ? bucket : best), data.buckets[0])
  }, [data])

  const currentState = status && !status.tracking
    ? 'Tracking paused'
    : status?.idle
      ? 'Away from keyboard'
      : status?.currentApp ?? 'Ready for whatever is next'

  return (
    <>
      <PageHeader
        eyebrow="YOUR DAY, IN PERSPECTIVE"
        title={<>Still<span>time</span> overview</>}
        subtitle={`${periodLabel(selectedDate, range)} · a gentle look at where your attention went`}
      >
        <DateStepper
          label={periodLabel(selectedDate, range)}
          onBack={() => onDateChange(shiftDate(selectedDate, range === 'day' ? -1 : -7))}
          onForward={() => onDateChange(shiftDate(selectedDate, range === 'day' ? 1 : 7))}
          forwardDisabled={forwardDisabled}
        />
        <SegmentedControl value={range} onChange={onRangeChange} />
      </PageHeader>

      {data?.hasDemoData && (
        <div className="demo-banner">
          <Sparkles size={15} />
          <span>You’re viewing <strong>sample activity</strong> from the first run. Real tracking is blended in as you use your PC.</span>
          <button onClick={onRemoveDemo}><Trash2 size={13} /> Remove sample</button>
        </div>
      )}

      <section className="hero">
        <span className="hero-blob hero-blob-a" aria-hidden="true" />
        <span className="hero-blob hero-blob-b" aria-hidden="true" />
        <div className="hero-copy">
          <span className="hero-overline">TOTAL SCREEN TIME</span>
          {data ? (
            <div className="hero-time">{formatDuration(data.totalSeconds)}</div>
          ) : (
            <div className="hero-time skeleton skeleton-hero-time" />
          )}
          <div className={`hero-delta tone-${delta?.tone ?? 'even'}`}>
            <DeltaChip tone={delta?.tone ?? 'even'} />
            <span>{delta?.text ?? '—'}</span>
          </div>
          {data && (
            <div className="hero-substats">
              <span><em>7-day average</em><strong>{formatDuration(data.averageSeconds)}</strong></span>
              <span className="hero-subdiv" />
              <span><em>Most used</em><strong>{data.apps[0]?.name ?? '—'}</strong></span>
              <span className="hero-subdiv" />
              <span><em>Right now</em><strong>{currentState}</strong></span>
            </div>
          )}
        </div>
        {data ? <TrendBars data={data} /> : <span className="skeleton skeleton-strip" />}
      </section>

      <div className="stats-row">
        <StatCard tone="blue" icon={<BarChart3 size={17} />} label="DAILY AVERAGE" value={data ? formatDuration(data.averageSeconds) : '—'} note="Across the last 7 days" />
        <StatCard tone="violet" icon={<Command size={17} />} label="APPS USED" value={data ? `${data.appCount}` : '—'} note={range === 'day' ? 'in this day' : 'this week'} />
        <StatCard tone="green" icon={<Activity size={17} />} label="FOCUS NOW" value={currentState} note={status?.idle ? 'Counting resumes when you’re back' : 'Foreground app, updated live'} />
      </div>

      <div className="grid-2">
        <Card className="chart-card">
          <div className="card-head">
            <div>
              <span className="section-label">ACTIVITY</span>
              <h2>{range === 'day' ? 'Usage by hour' : 'Usage by day'}</h2>
            </div>
            <div className="chart-tools">
              {peak && <span className="peak-pill"><TrendingUp size={12} /> {range === 'day' ? `Busiest around ${peak.label}` : `Busiest ${peak.label}`}</span>}
              {topCategories.length > 0 && (
                <div className="legend">
                  {topCategories.slice(0, 3).map((item) => (
                    <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {data && hasActivity ? (
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap={range === 'day' ? '26%' : '38%'}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 6" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} interval={range === 'day' ? 2 : 0} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={(value: number) => formatDuration(value, 'coarse')} width={42} />
                  <Tooltip content={<UsageTooltip />} cursor={{ fill: 'var(--chart-hover)', radius: 6 }} />
                  {CATEGORY_NAMES.map((category) => (
                    <Bar
                      key={category}
                      dataKey={category}
                      stackId="usage"
                      fill={CATEGORY_COLORS[category]}
                      maxBarSize={range === 'day' ? 18 : 42}
                      animationDuration={500}
                      shape={(props: unknown) => <RoundedBar {...(props as BarShapeProps)} />}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : data ? (
            <EmptyState icon={<Clock3 size={18} />} title="Nothing recorded yet" note="Leave Stilltime running in your tray — activity appears within a minute of using any app." />
          ) : (
            <LoadingRows rows={5} />
          )}
        </Card>

        <Card className="most-used-card">
          <div className="card-head">
            <div>
              <span className="section-label">WHERE TIME GOES</span>
              <h2>Most used</h2>
            </div>
            {data && data.apps.length > 0 && <span className="card-note">share of {range === 'day' ? 'day' : 'week'}</span>}
          </div>
          {data ? (
            data.apps.length ? (
              <div className="most-used-list">
                {data.apps.slice(0, 5).map((app) => (
                  <AppRow
                    key={app.id}
                    name={app.name}
                    category={app.category}
                    icon={icons[app.id]}
                    seconds={app.seconds}
                    maxSeconds={maxAppSeconds}
                    trailing={<span className="app-share">{data.totalSeconds > 0 ? Math.round((app.seconds / data.totalSeconds) * 100) : 0}%</span>}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={<Sparkles size={18} />} title="Your favorites will appear here" note="Spend a few minutes in any app and it shows up instantly." />
            )
          ) : (
            <LoadingRows rows={4} />
          )}
        </Card>
      </div>

      <Card className="categories-card">
        <div className="card-head">
          <div>
            <span className="section-label">THE BIG PICTURE</span>
            <h2>By category</h2>
          </div>
          <span className="card-note">{data ? formatDuration(data.totalSeconds) : '—'} total</span>
        </div>
        {data && topCategories.length ? (
          <>
            <div className="category-bar">
              {topCategories.map((item) => (
                <span key={item.name} style={{ flexGrow: Math.max(item.seconds, 1), background: item.color }} title={`${item.name} · ${formatDuration(item.seconds)}`} />
              ))}
            </div>
            <div className="category-legend">
              {topCategories.map((item) => (
                <div className="category-legend-item" key={item.name}>
                  <i style={{ background: item.color }} />
                  <span>{item.name}</span>
                  <strong>{formatDuration(item.seconds)}</strong>
                  <small>{item.percent}%</small>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="card-note">Categories appear here once you start using apps.</p>
        )}
      </Card>
    </>
  )
}
