import { useEffect, useState } from 'react'
import { Activity, ArrowUpRight, Clock3, Command, LayoutDashboard, Pause, Play, Sparkles } from 'lucide-react'
import type { TodaySnapshot, TrackerStatus } from '../../shared/types'

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export default function App() {
  const [snapshot, setSnapshot] = useState<TodaySnapshot | null>(null)
  const [status, setStatus] = useState<TrackerStatus | null>(null)

  useEffect(() => {
    void window.stilltime.getSnapshot().then((data) => { setSnapshot(data); setStatus(data.status) })
    return window.stilltime.onStatus((nextStatus) => {
      setStatus(nextStatus)
      void window.stilltime.getSnapshot().then(setSnapshot)
    })
  }, [])

  const paused = status ? !status.tracking : false
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Activity size={17} strokeWidth={2.5} /></div><span>stilltime</span></div>
        <div className="sidebar-label">YOUR SPACE</div>
        <button className="nav-item selected"><LayoutDashboard size={17} /><span>Overview</span></button>
        <div className="sidebar-label second-label">PREFERENCES</div>
        <div className="quiet-card"><div className="quiet-icon"><Sparkles size={15} /></div><p>A little more awareness.<br /><strong>A lot more intention.</strong></p></div>
        <div className="sidebar-bottom"><div className={`live-dot ${paused ? 'muted' : ''}`} /><div><strong>{paused ? 'Tracking paused' : status?.idle ? 'Taking a break' : 'Tracking quietly'}</strong><span>All data stays on this device</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">Your time <span>/</span> <strong>Overview</strong></div><div className="top-actions"><span className="local-pill"><span /> On this device</span><button className="icon-button" aria-label={paused ? 'Resume tracking' : 'Pause tracking'} onClick={() => void window.stilltime.setPaused(!paused)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button><div className="avatar">S</div></div></header>
        <div className="content-wrap">
          <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR DAY, IN PERSPECTIVE</div><h1>Make room for <span>what matters.</span></h1><p>A gentle look at where your attention went today.</p></div><div className="date-chip"><Clock3 size={15} /> Today <span className="date-divider" /> {new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</div></div>

          <section className="hero-card">
            <div className="hero-copy"><div className="hero-label">TOTAL SCREEN TIME <span className="today-tag">TODAY</span></div><div className="hero-total">{snapshot ? duration(snapshot.totalSeconds) : '—'}</div><div className="hero-note"><span className="trend-icon"><ArrowUpRight size={14} /></span> Your daily picture is taking shape</div></div>
            <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orb-core"><div className="orb-glow" /><Command size={27} strokeWidth={1.6} /></div><div className="orbit-dot dot-one" /><div className="orbit-dot dot-two" /></div>
            <div className="hero-footer"><span><i className="pulse" /> {paused ? 'Tracking paused' : status?.currentApp ? `Now using ${status.currentApp}` : 'Ready when you are'}</span><span>Your data never leaves this computer</span></div>
          </section>

          <div className="stats-grid"><section className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Clock3 size={16} /></span><span className="stat-caption">TIME TODAY</span></div><strong>{snapshot ? duration(snapshot.totalSeconds) : '—'}</strong><span className="stat-foot">Across all your apps</span></section><section className="stat-card"><div className="stat-top"><span className="stat-icon violet"><Command size={16} /></span><span className="stat-caption">APPS USED</span></div><strong>{snapshot?.appCount ?? '—'}</strong><span className="stat-foot">A little bit of everything</span></section><section className="stat-card"><div className="stat-top"><span className="stat-icon mint"><Activity size={16} /></span><span className="stat-caption">CURRENT FOCUS</span></div><strong className="focus-value">{status?.currentApp || 'Taking a pause'}</strong><span className="stat-foot">{status?.idle ? 'Your device is idle' : 'Foreground app'}</span></section></div>

          <section className="recent-card"><div className="section-heading"><div><span className="section-kicker">A QUICK GLANCE</span><h2>Your recent activity</h2></div><span className="local-only"><span /> Private by design</span></div>{snapshot?.sessions.length ? <div className="activity-list">{snapshot.sessions.slice(0, 5).map((item, index) => <div className="activity-row" key={`${item.startedAt}-${index}`}><div className={`app-glyph glyph-${index % 4}`}>{item.appName.slice(0, 1).toUpperCase()}</div><div className="activity-app"><strong>{item.appName}</strong><span>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(item.startedAt))}</span></div><div className="activity-time">{duration(item.durationSeconds)}</div></div>)}</div> : <div className="empty-state"><div className="empty-orbit"><Sparkles size={20} /></div><strong>Your story starts here</strong><span>As you move between apps, your day will take shape.</span></div>}</section>
          <footer className="footer-note"><span>Made for a little more mindful time.</span><span><span className="footer-lock">◆</span> Stored locally on your device</span></footer>
        </div>
      </main>
    </div>
  )
}
