import { useEffect, useMemo, useRef, useState } from 'react'
import { Command, FolderKanban, Gauge, LayoutDashboard, Moon, Pause, Play, Settings2, Sun } from 'lucide-react'
import { Onboarding } from './Onboarding'
import { Logo } from './components'
import { OverviewPage } from './pages/OverviewPage'
import { AppsPage } from './pages/AppsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { LimitsPage } from './pages/LimitsPage'
import { DowntimePage } from './pages/DowntimePage'
import { SettingsPage } from './pages/SettingsPage'
import { formatDuration } from './lib'
import { THEME_COLORS } from '../../shared/theme'
import type {
  AppDirectoryEntry, AppSettings, AppearancePreference, CategoryName, ControlSnapshot, DashboardData,
  LimitTargetType, ThemePayload, TimeRange, TrackerStatus,
} from '../../shared/types'

type Section = 'Overview' | 'Apps' | 'Categories' | 'Limits' | 'Downtime' | 'Settings'

const NAV: Array<{ label: Section; icon: typeof LayoutDashboard }> = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Apps', icon: Command },
  { label: 'Categories', icon: FolderKanban },
  { label: 'Limits', icon: Gauge },
  { label: 'Downtime', icon: Moon },
]

function dateKey() {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`
}

export default function App() {
  const [section, setSection] = useState<Section>('Overview')
  const [range, setRange] = useState<TimeRange>('day')
  const [selectedDate, setSelectedDate] = useState(dateKey())
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [controls, setControls] = useState<ControlSnapshot | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [directory, setDirectory] = useState<AppDirectoryEntry[]>([])
  const [icons, setIcons] = useState<Record<number, string | null>>({})
  const [status, setStatus] = useState<TrackerStatus | null>(null)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const sectionRef = useRef(section)
  sectionRef.current = section
  const rangeRef = useRef(range)
  rangeRef.current = range
  const dateRef = useRef(selectedDate)
  dateRef.current = selectedDate

  const isDark = settings ? settings.appearance === 'dark' || (settings.appearance === 'system' && systemDark) : systemDark
  const paused = status ? !status.tracking : false

  const loadDashboard = async (nextRange = rangeRef.current, nextDate = dateRef.current) => {
    setDashboard(await window.hours.getDashboard(nextRange, nextDate))
  }
  const loadControls = async () => setControls(await window.hours.getControls())
  const loadDirectory = async () => setDirectory(await window.hours.getAppDirectory())

  useEffect(() => { void loadDashboard(range, selectedDate) }, [range, selectedDate])

  useEffect(() => {
    void window.hours.getSettings().then(setSettings)
    void loadControls()
    void loadDirectory()
    void window.hours.getDashboard('day', dateKey()).then((data) => setStatus(data.status))
    const unsubscribe = window.hours.onStatus((next) => {
      setStatus(next)
      const current = sectionRef.current
      if (current === 'Limits' || current === 'Downtime') void loadControls()
    })
    const interval = window.setInterval(() => {
      void loadDashboard()
      if (sectionRef.current === 'Limits' || sectionRef.current === 'Downtime') void loadControls()
    }, 20_000)
    return () => { unsubscribe(); window.clearInterval(interval) }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const colors = THEME_COLORS[isDark ? 'dark' : 'light']
    const payload: ThemePayload = { dark: isDark, ...colors }
    void window.hours.syncTheme(payload)
  }, [isDark])

  useEffect(() => {
    const known = new Set(Object.keys(icons).map(Number))
    const wanted = [...new Set([
      ...directory.map((entry) => entry.id),
      ...(dashboard?.apps ?? []).map((app) => app.id),
    ])].filter((id) => !known.has(id)).slice(0, 60)
    if (!wanted.length) return
    let cancelled = false
    void Promise.all(wanted.map(async (id) => [id, await window.hours.getAppIcon(id)] as const)).then((pairs) => {
      if (!cancelled) setIcons((current) => ({ ...current, ...Object.fromEntries(pairs) }))
    })
    return () => { cancelled = true }
  }, [directory, dashboard, icons])

  const handleCategoryChange = async (appId: number, category: CategoryName) => {
    await window.hours.setAppCategory(appId, category)
    await Promise.all([loadDirectory(), loadDashboard(), loadControls()])
  }
  const handleRemoveDemo = async () => {
    await window.hours.removeDemoData()
    setIcons({})
    await Promise.all([loadDashboard(), loadDirectory(), loadControls()])
  }
  const handleSeedDemo = async () => {
    await window.hours.seedDemoData()
    setIcons({})
    await Promise.all([loadDashboard(), loadDirectory(), loadControls()])
  }
  const handleDeleteAll = async () => {
    await window.hours.deleteAllData()
    setIcons({})
    await Promise.all([loadDashboard(), loadDirectory(), loadControls()])
  }
  const handleAppearance = async (appearance: AppearancePreference) => {
    await window.hours.setAppearance(appearance)
    setSettings((current) => (current ? { ...current, appearance } : current))
  }
  const handleAutoStart = async (enabled: boolean) => {
    await window.hours.setAutoStart(enabled)
    setSettings((current) => (current ? { ...current, autoStart: enabled } : current))
  }
  const togglePause = () => void window.hours.setPaused(!paused)

  const page = useMemo(() => {
    switch (section) {
      case 'Overview':
        return <OverviewPage data={dashboard} range={range} selectedDate={selectedDate} icons={icons} onRangeChange={setRange} onDateChange={setSelectedDate} onRemoveDemo={() => void handleRemoveDemo()} />
      case 'Apps':
        return <AppsPage directory={directory} data={dashboard} icons={icons} onCategoryChange={(id, category) => void handleCategoryChange(id, category)} />
      case 'Categories':
        return <CategoriesPage data={dashboard} directory={directory} />
      case 'Limits':
        return <LimitsPage
          controls={controls}
          onSave={async (targetType: LimitTargetType, targetId: number, seconds: number) => {
            await window.hours.setLimit(targetType, targetId, seconds)
            await loadControls()
          }}
          onRemove={async (limit) => {
            await window.hours.setLimit(limit.targetType, limit.targetId, null)
            await loadControls()
          }}
        />
      case 'Downtime':
        return <DowntimePage
          controls={controls}
          icons={icons}
          onScheduleChange={async (enabled, start, end) => {
            await window.hours.setDowntime({ enabled, start, end })
            await loadControls()
          }}
          onAllowChange={async (appId, allowed) => {
            await window.hours.setAlwaysAllowed(appId, allowed)
            await loadControls()
          }}
        />
      case 'Settings':
        return <SettingsPage
          paused={paused}
          settings={settings}
          onPause={togglePause}
          onAppearance={handleAppearance}
          onAutoStart={handleAutoStart}
          onSeedDemo={handleSeedDemo}
          onRemoveDemo={handleRemoveDemo}
          onExport={() => window.hours.exportCsv()}
          onDeleteAll={handleDeleteAll}
        />
    }
  }, [section, dashboard, controls, settings, directory, icons, range, selectedDate, status, paused])

  return (
    <div className={`app-shell ${isDark ? 'theme-dark' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <Logo size={24} />
          <span>Hours</span>
        </div>
        <nav className="nav">
          {NAV.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? 'is-active' : ''}`} onClick={() => setSection(label)}>
              <Icon size={16} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${section === 'Settings' ? 'is-active' : ''}`} onClick={() => setSection('Settings')}>
            <Settings2 size={16} strokeWidth={1.9} />
            <span>Settings</span>
          </button>
          <div className="side-status">
            <i className={`side-status-dot ${paused ? 'is-off' : ''}`} />
            <span className="side-status-name">{paused ? 'Tracking paused' : status?.idle ? 'Away' : status?.currentApp ?? 'Tracking'}</span>
            <span className="side-status-time">{formatDuration(status?.todaySeconds ?? 0)}</span>
            <button
              className="icon-button"
              onClick={togglePause}
              aria-label={paused ? 'Resume tracking' : 'Pause tracking'}
              title={paused ? 'Resume tracking' : 'Pause tracking'}
            >
              {paused ? <Play size={13} /> : <Pause size={13} />}
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => void handleAppearance(isDark ? 'light' : 'dark')} aria-label="Toggle appearance" title="Toggle appearance">
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>
        <div className="content">
          {page}
        </div>
      </main>

      {settings && !settings.onboardingComplete && (
        <Onboarding onContinue={async () => {
          await window.hours.completeOnboarding()
          setSettings((current) => (current ? { ...current, onboardingComplete: true } : current))
        }} />
      )}
    </div>
  )
}
