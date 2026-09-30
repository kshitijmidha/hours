# Stilltime

A calm, accurate, local-first screen time tracker for **Windows**. Stilltime lives in the tray, starts with Windows, and shows a Screen Time–inspired dashboard of where your day actually goes. No accounts, no cloud, no telemetry.

## Install (recommended)

1. Build the installer once: `npm install` then `npm run dist`.
2. Run `release\Stilltime-Setup-2.0.0.exe` — it installs per-user (no admin prompt), creates Start Menu and desktop shortcuts, and starts Stilltime in the tray.
3. From that point on, Stilltime **starts automatically with Windows** and tracks quietly in the background. You never need to launch it again manually. You can turn this off in **Settings → Start with Windows**.

Closing the window hides it to the tray; tracking continues. Use the tray icon to open, pause, or quit. Uninstall normally from Windows Settings → Apps.

## How tracking works (and why it's accurate)

- The main process reads the foreground window **directly through Win32 APIs** (`user32.dll` / `kernel32.dll`) via [koffi](https://koffi.dev) — the same information Windows itself uses. No helper processes, no PowerShell polling.
- It samples every 2 seconds and records one continuous session per foreground app, including the window title.
- Counting stops the moment input stops: sessions end at your **last keyboard/mouse activity** when you go idle for 2 minutes, and immediately on **lock, sleep, or shutdown**. Sessions resume when you do.
- Durations are computed from real `started_at`/`ended_at` overlap, so cross-midnight sessions are split correctly across hours and days.
- The app is single-instance, and open sessions are repaired on startup, so a crash can never inflate or duplicate time.
- Demo/sample sessions are marked in the database and in CSV exports, and can be removed with one click from the dashboard.

## Run from source

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

`npm install` rebuilds `better-sqlite3` for Electron. koffi ships prebuilt N-API binaries and needs nothing extra.

## Features

- **Overview** — total screen time with day/week navigation, comparison to your trailing 7-day average, 7-day mini trend, hourly/weekly stacked chart by category, most used apps with real icons, category breakdown.
- **Apps** — every tracked app with time, executable path, and instant category reassignment.
- **Categories** — six buckets (Productivity, Social, Entertainment, Development, Browsing, Other) filled by a rule-based classifier.
- **Limits** — daily budgets per app or category with native notifications at 80% and 100%.
- **Downtime** — a quiet window (e.g. 23:00–07:00) with gentle reminders, plus an always-allowed list. Nothing is blocked.
- **Settings** — system/light/dark appearance synced to the Windows title bar, start with Windows, pause, sample data, CSV export, and full local data deletion.

## Data & privacy

Everything is stored in a local SQLite database at `%APPDATA%\stilltime\stilltime.db` (WAL mode). Stilltime reads only the foreground app/window title and the system idle timer. It never captures screenshots or keystrokes, and makes no network requests at runtime.

## Build & package

```bash
npm run typecheck   # type-check main, preload, renderer
npm run build       # production bundle into out/
npm run icons       # regenerate build/icon.ico, icon.png, tray.png
npm run dist        # Windows NSIS installer into release/
```

Packaging runs on Windows and produces `release\Stilltime-Setup-<version>.exe`.

## Project layout

```text
main/       Electron main process: Win32 foreground reader, tracker, SQLite store, controls, IPC
renderer/   React + TypeScript UI (pages, components, styles)
shared/     Types and theme constants shared across processes
scripts/    Icon generation (no dependencies)
```
