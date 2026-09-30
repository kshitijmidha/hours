import { Clock3, Lock, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Logo } from './components'

export function Onboarding({ onContinue }: { onContinue: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const complete = async () => {
    setBusy(true)
    await onContinue()
    setBusy(false)
  }
  return (
    <div className="onboarding-backdrop">
      <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="onboarding-mark"><Logo size={44} /></div>
        <h1 id="welcome-title">A calmer view of<br />your <em>screen time.</em></h1>
        <p className="onboarding-lead">Stilltime lives in your tray and quietly notes the app in front of you — so you can see where your days actually go.</p>
        <div className="onboarding-points">
          <div>
            <span className="onboarding-point-icon"><Clock3 size={14} /></span>
            <div>
              <strong>Accurate by design</strong>
              <span>Stops counting the moment you step away, lock the screen, or close the lid.</span>
            </div>
          </div>
          <div>
            <span className="onboarding-point-icon"><Lock size={14} /></span>
            <div>
              <strong>Nothing leaves this PC</strong>
              <span>No accounts, no cloud, no telemetry — just a local database you can wipe anytime.</span>
            </div>
          </div>
          <div>
            <span className="onboarding-point-icon"><Sparkles size={14} /></span>
            <div>
              <strong>Always there, never in the way</strong>
              <span>Starts with Windows and hides in the tray when you close it.</span>
            </div>
          </div>
        </div>
        <button className="onboarding-continue" disabled={busy} onClick={() => void complete()}>
          Start tracking
        </button>
        <span className="onboarding-foot">Pause or delete everything anytime in Settings</span>
      </section>
    </div>
  )
}
