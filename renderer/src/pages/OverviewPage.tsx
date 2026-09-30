import { useMemo } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { AppRow, DateStepper, DeltaChip, EmptyState, LoadingRows, Metric, PageHeader, SegmentedControl } from '../components'
import { CATEGORY_COLORS, CATEGORY_NAMES, comparison, formatDuration, periodLabel, shiftDate, todayKey } from '../lib'
import type { DashboardData, TimeRange } from '../../../shared/types'

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
  const radius = Math.min(4, width / 2, height)
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
          const height = Math.max(4, Math.round((point.seconds / max) * 50))
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

export function OverviewPage({ data, range, selectedDate, icons, onRangeChange, onDateChange, onRemoveDemo }: {
  data: DashboardData | null
  range: TimeRange
  selectedDate: string
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
  const emptyPeriod = Boolean(data && data.totalSeconds === 0 && data.averageSeconds === 0)
  const maxAppSeconds = data?.apps[0]?.seconds ?? 0
  const topCategories = data?.categories.filter((item) => item.seconds > 0) ?? []
  const hasActivity = Boolean(data && data.totalSeconds > 0)
  const forwardDisabled = selectedDate >= todayKey()

  return (
    <>
      <PageHeader title="Overview">
        <DateStepper
          label={periodLabel(selectedDate, range)}
          onBack={() => onDateChange(shiftDate(selectedDate, range === 'day' ? -1 : -7))}
          onForward={() => onDateChange(shiftDate(selectedDate, range === 'day' ? 1 : 7))}
          forwardDisabled={forwardDisabled}
          unitLabel={range === 'day' ? 'day' : 'week'}
        />
        <SegmentedControl value={range} onChange={onRangeChange} />
      </PageHeader>

      {data?.hasDemoData && (
        <div className="demo-line">
          <span>Sample activity is included in these totals.</span>
          <button onClick={onRemoveDemo}>Remove sample</button>
        </div>
      )}

      <section className="hero">
        <div>
          {data ? (
            <div className="hero-time">{formatDuration(data.totalSeconds)}</div>
          ) : (
            <div className="hero-time skeleton skeleton-hero-time" />
          )}
          {emptyPeriod ? (
            <div className="hero-delta"><span>No activity recorded yet</span></div>
          ) : (
            <div className={`hero-delta tone-${delta?.tone ?? 'even'}`}>
              <DeltaChip tone={delta?.tone ?? 'even'} />
              <span>{delta?.text ?? '—'}</span>
            </div>
          )}
        </div>
        {data ? <TrendBars data={data} /> : <span className="skeleton skeleton-strip" />}
      </section>

      <div className="metrics">
        <Metric
          label="7-DAY AVERAGE"
          value={data && data.averageSeconds > 0 ? formatDuration(data.averageSeconds) : '—'}
          note={!data ? undefined : data.averageSeconds > 0 ? 'Across the last 7 days' : 'No history yet — tracking starts now'}
        />
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{range === 'day' ? 'Usage by hour' : 'Usage by day'}</h2>
          {data && hasActivity && <span className="section-note">{formatDuration(data.totalSeconds)} total</span>}
        </div>
        {data && hasActivity ? (
          <>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={range === 'day' ? '28%' : '40%'}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }} interval={range === 'day' ? 2 : 0} dy={6} />
                  <Tooltip content={<UsageTooltip />} cursor={{ fill: 'var(--chart-grid)', radius: 4 }} />
                  {CATEGORY_NAMES.map((category) => (
                    <Bar
                      key={category}
                      dataKey={category}
                      stackId="usage"
                      fill={CATEGORY_COLORS[category]}
                      maxBarSize={range === 'day' ? 18 : 44}
                      animationDuration={450}
                      shape={(props: unknown) => <RoundedBar {...(props as BarShapeProps)} />}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {topCategories.length > 0 && (
              <div className="legend">
                {topCategories.slice(0, 4).map((item) => (
                  <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>
                ))}
              </div>
            )}
          </>
        ) : data ? (
          <EmptyState title="Nothing recorded yet" note="Hours runs quietly in your tray — activity appears within a minute of using any app." />
        ) : (
          <LoadingRows rows={5} />
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Most used</h2>
        </div>
        {data ? (
          data.apps.length ? (
            <div className="rows">
              {data.apps.slice(0, 5).map((app) => (
                <AppRow
                  key={app.id}
                  name={app.name}
                  category={app.category}
                  icon={icons[app.id]}
                  seconds={app.seconds}
                  maxSeconds={maxAppSeconds}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No apps yet" note="Spend a few minutes in any app and it shows up instantly." />
          )
        ) : (
          <LoadingRows rows={4} />
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>By category</h2>
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
          <p className="section-note">Categories appear here once you start using apps.</p>
        )}
      </section>
    </>
  )
}
