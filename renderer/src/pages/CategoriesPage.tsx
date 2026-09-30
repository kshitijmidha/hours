import { Card, PageHeader, ProgressBar } from '../components'
import { CATEGORY_COLORS, CATEGORY_NAMES, formatDuration } from '../lib'
import type { AppDirectoryEntry, DashboardData } from '../../../shared/types'

export function CategoriesPage({ data, directory }: { data: DashboardData | null; directory: AppDirectoryEntry[] }) {
  return (
    <>
      <PageHeader title="Categories" subtitle="Six simple buckets, filled automatically from how you spend your time" />
      <div className="category-grid">
        {CATEGORY_NAMES.map((name) => {
          const usage = data?.categories.find((item) => item.name === name)
          const color = CATEGORY_COLORS[name]
          const appCount = directory.filter((entry) => entry.category === name).length
          return (
            <Card className="category-tile" key={name}>
              <div className="category-tile-top">
                <span className="category-dot" style={{ background: color }} />
                <span className="category-tile-name">{name}</span>
              </div>
              <span className="category-tile-time">{formatDuration(usage?.seconds ?? 0)}</span>
              <ProgressBar percent={usage?.percent ?? 0} color={color} height={5} />
              <small>{usage?.seconds ? `${usage.percent}% of your ${data?.range === 'week' ? 'week' : 'day'} · ${appCount} ${appCount === 1 ? 'app' : 'apps'}` : `${appCount} ${appCount === 1 ? 'app' : 'apps'}`}</small>
            </Card>
          )
        })}
      </div>
    </>
  )
}
