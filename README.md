# Stilltime

Stilltime is a private, local-first screen time companion for Windows and macOS. It pairs a calm, Screen Time–inspired dashboard with a small background tracker. There are no accounts, cloud services, or telemetry.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

`npm install` rebuilds `better-sqlite3` for the bundled Electron runtime. A prebuilt binary is used when available. If it needs to compile from source on Windows, install Visual Studio Build Tools with **Desktop development with C++** and a Windows SDK.

The first launch includes 14 days of clearly identified sample activity, so the dashboard is useful right away. Open **Settings → Refresh sample** to regenerate it. Use **Delete all data** to remove the sample and local activity.

## What it tracks

- Every two seconds, Stilltime reads the foreground app name, executable path, and window title.
- Tracking pauses after two minutes without keyboard or mouse input, using Electron’s `powerMonitor` idle timer.
- App sessions, categories, limits, downtime preferences, and settings are stored in a SQLite database under Electron’s local `userData` directory.
- On Windows, the tracker uses `active-win` when its native binding is available and falls back to the Windows foreground-window API when it is not.
- Closing the window hides Stilltime to the system tray. Use **Quit Stilltime** from the tray menu to stop it completely.

The tracker records app/window metadata and time only. It does not capture screenshots or keystrokes. Demo sessions are marked in the CSV export.

## Permissions

### Windows

No special permissions are required. Stilltime reads the foreground-window metadata and idle duration locally. The first-run welcome screen explains what is collected and where it stays.

### macOS

macOS may require **Screen Recording** and **Accessibility** access for foreground app/window metadata. Stilltime shows an onboarding explanation and links to the corresponding System Settings privacy panels. Grant access to the Stilltime app if macOS requests it; permission availability can vary by macOS release and app signing. If access is declined, the tracker keeps running and presents an empty/limited activity view rather than interrupting the app.

## Features

- Day and week usage with category-stacked charts, daily averages, app icons, and rule-based categories.
- Manual category assignment for each app.
- Per-app and per-category daily limits with local notifications at 80% and 100%.
- Scheduled downtime notifications and an always-allowed app list. Downtime provides a reminder; it does not block apps.
- Pause/resume tracking, light/dark/system appearance, launch-at-login, CSV export, and local data deletion.

## Build and package

```bash
npm run typecheck
npm run build
npm run dist
```

`npm run dist` creates an NSIS installer on Windows and a DMG on macOS using electron-builder. Build each platform on its corresponding OS. Packaged output is written to `release/`.

## Project layout

```text
main/       Electron main process, tracker, SQLite store, controls, typed IPC handlers
renderer/   React + TypeScript interface, charts, styles
shared/     Types shared across IPC and the renderer
```

All usage processing and persistence happen on-device. The app makes no network requests at runtime.
