import { Activity, ArrowRight, Clock3, Lock, ShieldCheck, Sparkles } from 'lucide-react'
import { useState } from 'react'

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
        <div className="onboarding-mark">
          <span className="onboarding-halo" />
          <span className="onboarding-logo"><Activity size={24} strokeWidth={2.3} /></span>
        </div>
        <span className="eyebrow">WELCOME TO STILLTIME</span>
        <h1 id="welcome-title">A calmer view of<br />your <em>screen time.</em></h1>
        <p className="onboarding-lead">Stilltime lives in your tray and quietly notes the app in front of you — so you can see where your days actually go.</p>
        <div className="onboarding-points">
          <div>
            <span className="onboarding-point-icon"><Clock3 size={15} /></span>
            <div>
              <strong>Accurate by design</strong>
              <span>Checks the foreground app twice a second and stops counting the moment you step away, lock the screen, or close the lid.</span>
            </div>
          </div>
          <div>
            <span className="onboarding-point-icon"><Lock size={15} /></span>
            <div>
              <strong>Nothing leaves this PC</strong>
              <span>No accounts, no cloud, no telemetry. Everything is stored in a local database you can wipe anytime.</span>
            </div>
          </div>
          <div>
            <span className="onboarding-point-icon"><Sparkles size={15} /></span>
            <div>
              <strong>Always there, never in the way</strong>
              <span>Starts with Windows, hides in the tray when you close it, and keeps working while you do.</span>
            </div>
          </div>
        </div>
        <button className="onboarding-continue" disabled={busy} onClick={() => void complete()}>
          Start tracking <ArrowRight size={15} />
        </button>
        <span className="onboarding-foot"><ShieldCheck size={12} /> You can pause or delete everything in Settings</span>
      </section>
    </div>
  )
}
