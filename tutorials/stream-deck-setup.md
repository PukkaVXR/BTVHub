# Stream Deck Setup Guide

This guide explains how to connect Elgato Stream Deck buttons to BTV Hub while the app is running locally.

## 1. Start BTV Hub

1. Open the project folder.
2. Start the local app:

```powershell
.\pnpm.exe dev
```

3. Open the dashboard:

```text
http://127.0.0.1:4781
```

4. Confirm the dashboard shows OBS as connected before creating Stream Deck buttons that control OBS.

## 2. Install the Stream Deck HTTP Plugin

The easiest setup is with an HTTP request plugin such as:

- BarRaider API Ninja
- Stream Deck HTTP Request
- Advanced Launcher, if you prefer calling scripts

Any plugin that can send a local HTTP `POST` request will work.

## 3. Basic URL Rules

BTV Hub actions use the local overlay/API server:

```text
http://127.0.0.1:4782/api
```

Most action buttons should use:

```text
Method: POST
Content-Type: application/json
Body: {}
```

## 4. Run a Macro

Use this for panic buttons, scene chains, source movement, alert clearing, or any saved macro.

```text
POST http://127.0.0.1:4782/api/actions/macro/panic-clear
```

Body:

```json
{}
```

Useful examples:

```text
POST http://127.0.0.1:4782/api/actions/macro/start-session
POST http://127.0.0.1:4782/api/actions/macro/panic-clear
```

The response includes `ok`, `title`, `message`, `color`, and `icon`, which can be used by Stream Deck plugins that support feedback.

## 5. Switch OBS Scene

```text
POST http://127.0.0.1:4782/api/actions/obs/scene
```

Body:

```json
{
  "sceneName": "Gameplay"
}
```

## 6. Show or Hide an OBS Source

```text
POST http://127.0.0.1:4782/api/actions/obs/source-visibility
```

Body:

```json
{
  "sceneName": "Gameplay",
  "sourceName": "Camera",
  "visible": true
}
```

Use `"visible": false` to hide it.

## 7. Move or Resize an OBS Source

```text
POST http://127.0.0.1:4782/api/actions/obs/source-motion
```

DVD bounce example:

```json
{
  "sceneName": "Gameplay",
  "sourceName": "Camera",
  "mode": "dvd",
  "durationMs": 8000,
  "boundsWidth": 3840,
  "boundsHeight": 2160,
  "speedX": 9,
  "speedY": 6,
  "randomizeStart": true,
  "restore": true
}
```

Set position/size example:

```json
{
  "sceneName": "Gameplay",
  "sourceName": "Camera",
  "mode": "set",
  "x": 2850,
  "y": 1420,
  "width": 720
}
```

## 8. Activate an Activity Layout

Activity Layouts are saved on the dashboard. They show the sources that belong to an activity, hide the rest, and restore saved positions for that layout.

```text
POST http://127.0.0.1:4782/api/actions/source-group/source-group-id-here
```

Body:

```json
{}
```

To find IDs, open the dashboard and edit or inspect the saved activity layout.

## 9. Read Stream Deck Status

Use status endpoints for Stream Deck keys that support polling.

Overall status:

```text
GET http://127.0.0.1:4782/api/stream-deck/status
```

Activity layout status:

```text
GET http://127.0.0.1:4782/api/stream-deck/source-groups
```

OBS scene/source status:

```text
GET http://127.0.0.1:4782/api/stream-deck/obs
```

These responses are designed for key labels, colors, and success/failure feedback.

## 10. Recommended Button Layout

Suggested Stream Deck page:

1. Panic Clear
2. Start Session
3. Stop Session
4. Gameplay Activity
5. Just Chatting Activity
6. Camera DVD Bounce
7. Camera Hide
8. Camera Show
9. Refresh OBS Status
10. Open Dashboard

## 11. Troubleshooting

If a button fails:

1. Make sure BTV Hub is running.
2. Make sure the URL uses port `4782` for API actions.
3. Make sure OBS WebSocket is enabled and connected in the Integrations page.
4. Check scene and source names exactly match OBS.
5. Try the same action from the dashboard.
6. Check the JSON body is valid.

If a source position looks wrong, recreate or update the Activity Layout after positioning sources correctly in OBS.

