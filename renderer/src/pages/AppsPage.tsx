import { ChevronDown, Search, ShieldCheck, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppAvatar, Card, EmptyState, LoadingRows, PageHeader, ProgressBar } from '../components'
import { CATEGORY_COLORS, CATEGORY_NAMES, formatDuration } from '../lib'
import type { AppDirectoryEntry, CategoryName, DashboardData } from '../../../shared/types'

export function AppsPage({ directory, data, icons, onCategoryChange }: {
  directory: AppDirectoryEntry[]
  data: DashboardData | null
  icons: Record<number, string | null>
  onCategoryChange: (appId: number, category: CategoryName) => void
}) {
  const [query, setQuery] = useState('')
  const usage = useMemo(() => new Map((data?.apps ?? []).map((app) => [app.id, app.seconds])), [data])
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return directory
      .filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
      .map((entry) => ({ ...entry, seconds: usage.get(entry.id) ?? 0 }))
      .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name))
  }, [directory, query, usage])
  const maxSeconds = Math.max(1, ...rows.map((row) => row.seconds))

  return (
    <>
      <PageHeader
        title="Apps"
        subtitle={`${directory.length} apps seen · categories are automatic and always adjustable`}
      >
        <label className="search">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search apps" />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
        </label>
      </PageHeader>

      <Card className="list-card">
        {!data ? (
          <LoadingRows rows={6} />
        ) : rows.length ? (
          rows.map((row) => {
            const color = CATEGORY_COLORS[row.category] ?? CATEGORY_COLORS.Other
            return (
              <div className="app-row app-row-manage apps-list-grid" key={row.id}>
                <div className="app-row-id">
                  <AppAvatar name={row.name} category={row.category} icon={icons[row.id]} />
                  <div className="app-row-title-col">
                    <strong>{row.name}</strong>
                  </div>
                </div>
                <div className="app-row-usage">
                  <span>{formatDuration(row.seconds)}</span>
                  <ProgressBar percent={row.seconds > 0 ? (row.seconds / maxSeconds) * 100 : 0} color={color} height={4} />
                </div>
                <label className="select">
                  <select
                    aria-label={`Category for ${row.name}`}
                    value={row.category}
                    onChange={(event) => onCategoryChange(row.id, event.target.value as CategoryName)}
                  >
                    {CATEGORY_NAMES.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <ChevronDown size={13} />
                </label>
              </div>
            )
          })
        ) : (
          <EmptyState title="No apps found" note={query ? 'Try a different search.' : 'Apps appear here as soon as Stilltime sees them in front.'} />
        )}
      </Card>

      <p className="privacy-line"><ShieldCheck size={13} /> App activity never leaves this computer.</p>
    </>
  )
}
