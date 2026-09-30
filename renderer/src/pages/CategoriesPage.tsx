import { FolderKanban, Sparkles } from 'lucide-react'
import { Card, EmptyState, PageHeader, ProgressBar } from '../components'
import { CATEGORY_COLORS, CATEGORY_NAMES, formatDuration } from '../lib'
import type { AppDirectoryEntry, DashboardData } from '../../../shared/types'

export function CategoriesPage({ data, directory }: { data: DashboardData | null; directory: AppDirectoryEntry[] }) {
  const describe = (seconds: number, percent: number) => {
    if (!seconds) return 'No time yet'
    return `${percent}% of your ${data?.range === 'week' ? 'week' : 'day'}`
  }
  return (
    <>
      <PageHeader eyebrow="A HEALTHIER BALANCE" title="Categories" subtitle="Six simple buckets, filled automatically from how you spend your time" />
      <div className="category-grid">
        {CATEGORY_NAMES.map((name) => {
          const usage = data?.categories.find((item) => item.name === name)
          const appCount = directory.filter((entry) => entry.category === name).length
          const color = CATEGORY_COLORS[name]
          const topApp = (data?.apps ?? []).filter((app) => app.category === name).sort((a, b) => b.seconds - a.seconds)[0]
          return (
            <Card className="category-tile" key={name}>
              <div className="category-tile-top">
                <span className="category-dot" style={{ background: color }} />
                <span>{appCount} {appCount === 1 ? 'app' : 'apps'}</span>
              </div>
              <strong className="category-tile-name">{name}</strong>
              <span className="category-tile-time">{formatDuration(usage?.seconds ?? 0)}</span>
              <ProgressBar percent={usage?.percent ?? 0} color={color} height={6} />
              <small>{describe(usage?.seconds ?? 0, usage?.percent ?? 0)}</small>
              {topApp && (
                <span className="category-top-app"><i style={{ background: color }} />Top: {topApp.name} · {formatDuration(topApp.seconds)}</span>
              )}
            </Card>
          )
        })}
      </div>

      {data && data.totalSeconds === 0 && (
        <Card className="note-card">
          <EmptyState icon={<FolderKanban size={18} />} title="No activity in this period" note="Switch days above or use an app for a minute — categorization is automatic." />
        </Card>
      )}

      <Card className="note-card note-inline">
        <Sparkles size={15} />
        <p><strong>Automatic, but yours to change.</strong> Stilltime classifies apps from their name and executable. Fine-tune any of them on the Apps page.</p>
      </Card>
    </>
  )
}
