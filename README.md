# Hours

A calm, local-first screen time tracker for Windows. It lives in the tray, starts with Windows, and keeps everything on your PC.

## Install

```bash
npm install
npm run dist
```

Then run `release\Hours-Setup-2.0.0.exe`. Hours starts with Windows automatically; you never need to launch it again.

## Develop

```bash
npm install
npm run dev
```

Closing the window hides Hours to the tray. Right-click the tray icon to open, pause, or quit.

## Notes

- Reads the foreground app and idle timer through Win32 APIs. No accounts, no cloud, no telemetry.
- Data lives in `%APPDATA%\Hours\hours.db` (SQLite).
- Requires Node.js 20+.
