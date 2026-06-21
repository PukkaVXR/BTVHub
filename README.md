# BTV - Personal OBS Streaming Hub

Local-first control plane for OBS overlays: alerts, widgets, webhooks, and interactive effects powered by Twitch EventSub.

## Requirements

- **Node.js 22.5+** - install from [nodejs.org](https://nodejs.org/) and verify with `node -v` in a new terminal
- **pnpm 9+** - `npm install -g pnpm` (or use the `pnpm.exe` in this repo)
- OBS Studio with Browser Sources

## Quick start

```bash
cd /path/to/ProjectBTV
pnpm start
```

Cross-platform helpers:

- `pnpm start` frees ports `4781`-`4783` and starts the Hub plus overlay server.
- `pnpm free-ports` only clears those ports.
- Windows launchers remain available at `.\scripts\start.cmd` and `.\scripts\start.ps1`.

If `start.ps1` is blocked by execution policy, use `start.cmd` (recommended) or:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
```

- **Hub dashboard**: http://127.0.0.1:4781
- **Overlays (OBS)**: http://127.0.0.1:4782
- **OAuth (Twitch)**: https://127.0.0.1:4783

## Twitch setup (HTTPS on port 4783)

Twitch requires **HTTPS** for OAuth redirect URIs. BTV uses:

| Service | URL |
|---------|-----|
| Overlays & API | `http://127.0.0.1:4782` |
| Twitch OAuth | `https://127.0.0.1:4783` |
| Spotify OAuth | `http://127.0.0.1:4782` (loopback HTTP) |

1. Start `pnpm start`, `pnpm dev`, or `.\scripts\start.ps1`.
2. Open **https://127.0.0.1:4783** in your browser and accept the certificate warning.
3. Optional: `.\scripts\trust-cert.ps1` to trust the cert on Windows.
4. In [Twitch Developer Console](https://dev.twitch.tv/console) -> **OAuth Redirect URLs**, add:
   ```
   https://127.0.0.1:4783/auth/twitch/callback
   ```
5. In BTV **Integrations** -> save Client ID/Secret -> **Connect Twitch**.

## OBS Browser Source URLs (HTTP)

| Overlay | URL |
|---------|-----|
| Alerts | http://127.0.0.1:4782/o/alerts.html |
| Chat | http://127.0.0.1:4782/o/chat.html |
| Goals | http://127.0.0.1:4782/o/goals.html |
| Ticker | http://127.0.0.1:4782/o/ticker.html |
| Now Playing | http://127.0.0.1:4782/o/now-playing.html |

Resolution: 1920x1080, transparent background.

## Tutorials

- [Visual Alert Editor Tutorial](tutorials/visual-alert-editor.md)
- [Stream Deck Setup Guide](tutorials/stream-deck-setup.md)

## Windows start script

```cmd
scripts\start.cmd
```
