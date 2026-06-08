# Stream Deck HTTP API Guide

This guide explains how to connect Elgato Stream Deck buttons, API Ninja buttons, Stream Deck HTTP plugins, or small local scripts to BTV Hub.

## 1. What This API Is For

Use the Stream Deck HTTP API when you want physical buttons for live production actions:

- Run macros.
- Apply saved activity layouts.
- Switch OBS scenes.
- Show, hide, move, or resize OBS sources.
- Update OBS text sources.
- Trigger emergency controls.
- Read status for button labels, colors, and feedback.

BTV does not require a custom Stream Deck plugin yet. Any Stream Deck plugin that can send local HTTP requests will work.

## 2. Start BTV

1. Start the app:

```powershell
.\scripts\start.cmd
```

2. Open the Hub:

```text
http://127.0.0.1:4781
```

3. Confirm the Dashboard shows OBS, Twitch, and Browser Sources as healthy before creating OBS buttons.

## 3. Recommended Stream Deck Plugin

The easiest option is BarRaider API Ninja.

Other workable options:

- Stream Deck HTTP Request
- Advanced Launcher, if you prefer calling a script
- Any plugin that supports local HTTP `GET` or `POST`

## 4. Base URL

All production actions use the overlay/API server:

```text
http://127.0.0.1:4782/api
```

The Hub UI runs on `http://127.0.0.1:4781`, but Stream Deck buttons should call port `4782`.

## 5. Standard Button Settings

For most action buttons:

```text
Method: POST
Content-Type: application/json
Body: {}
```

For status buttons:

```text
Method: GET
Body: empty
```

### Export `.ninja` Files From BTV

The Stream Deck page can export API Ninja import files directly.

- Use **API Ninja Request Builder > Export .ninja** for custom macro, OBS, source, and status buttons.
- Use **Ready-made action buttons > Export .ninja** for common safety, alert, and test buttons.
- Import the downloaded `.ninja` file inside API Ninja, then assign it to your Stream Deck key.

### Export Full Stream Deck Actions

Use **Export Stream Deck action** or **Export action** when you want Stream Deck to import the button action and its visual key styling together.

These `.streamDeckAction` files include:

- The API Ninja plugin requirement.
- The BTV local action URL and request settings.
- A generated BTV key image using the action's suggested colour and label.
- Generic profile/action IDs so exported files can be shared with other BTV users.

### Build A Custom Action

Use **Stream Deck Action Builder** when you want a custom button instead of a ready-made one.

1. Choose a preset or action family.
2. Configure the action with BTV data such as macros, activity layouts, OBS scenes, sources, alert controls, or emergency actions.
3. Design the key title, colour, icon label, title visibility, title style, badge, subtitle, background image, image fit, opacity, and visual effect.
4. Use **Test now** to fire the local action before exporting.
5. Export either a full `.streamDeckAction` package or a lighter `.ninja` API Ninja file.

The full Stream Deck action export is recommended for sharing because it includes the visual key image and API Ninja settings together.

## 6. Response Format

Action endpoints return a response shaped for Stream Deck feedback:

```json
{
  "ok": true,
  "title": "Macro complete",
  "message": "Macro finished",
  "color": "#00f593",
  "icon": "check"
}
```

Use `title` for the key title, `message` for logs or notifications, `color` for button state, and `ok` to decide success or failure.

## 7. Run A Macro

Macros are the best Stream Deck action for multi-step production moves.

```text
POST http://127.0.0.1:4782/api/actions/macro/MACRO_ID
```

Body:

```json
{}
```

Examples:

```text
POST http://127.0.0.1:4782/api/actions/macro/start-session
POST http://127.0.0.1:4782/api/actions/macro/panic-clear
```

Find macro IDs on the Macros page or use the request builder on the Stream Deck page.

## 8. Apply An Activity Layout

Activity layouts show a saved group of OBS sources, hide non-members, and restore saved positions.

```text
POST http://127.0.0.1:4782/api/actions/source-group/SOURCE_GROUP_ID
```

Body:

```json
{}
```

Use this for buttons like:

- Gameplay layout
- Just Chatting layout
- BRB layout
- Starting Soon layout

## 9. Switch OBS Scene

```text
POST http://127.0.0.1:4782/api/actions/obs/scene
```

Body:

```json
{
  "sceneName": "Gameplay"
}
```

Scene names must match OBS exactly.

## 10. Show Or Hide An OBS Source

```text
POST http://127.0.0.1:4782/api/actions/obs/source-visibility
```

Show source:

```json
{
  "sceneName": "Gameplay",
  "sourceName": "Camera",
  "visible": true
}
```

Hide source:

```json
{
  "sceneName": "Gameplay",
  "sourceName": "Camera",
  "visible": false
}
```

## 11. Move Or Resize An OBS Source

```text
POST http://127.0.0.1:4782/api/actions/obs/source-motion
```

Set position and size:

```json
{
  "sceneName": "Gameplay",
  "sourceName": "Camera",
  "mode": "set",
  "x": 2850,
  "y": 1420,
  "width": 720,
  "height": 405
}
```

DVD bounce:

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

Path animation:

```json
{
  "sceneName": "Gameplay",
  "sourceName": "Camera",
  "mode": "path",
  "durationMs": 3000,
  "path": [
    { "x": 100, "y": 100, "scale": 1 },
    { "x": 1500, "y": 800, "scale": 1.2 },
    { "x": 2850, "y": 1420, "scale": 1 }
  ],
  "restore": true
}
```

## 12. Update OBS Text

```text
POST http://127.0.0.1:4782/api/actions/obs/text
```

Body:

```json
{
  "inputName": "Stream Title",
  "text": "Boss run starts now"
}
```

## 13. Emergency Buttons

Emergency actions are designed for big, easy-to-hit buttons.

```text
POST http://127.0.0.1:4782/api/emergency/stop-sounds
POST http://127.0.0.1:4782/api/emergency/hide-overlays
POST http://127.0.0.1:4782/api/emergency/reset-overlays
POST http://127.0.0.1:4782/api/emergency/disable-automations
POST http://127.0.0.1:4782/api/emergency/enable-automations
POST http://127.0.0.1:4782/api/emergency/disable-channel-points
POST http://127.0.0.1:4782/api/emergency/enable-channel-points
POST http://127.0.0.1:4782/api/emergency/reconnect-obs
POST http://127.0.0.1:4782/api/emergency/reconnect-twitch
POST http://127.0.0.1:4782/api/emergency/all
```

Use `all` as your true panic button.

## 14. Ready-Made Action Buttons

The Stream Deck page in BTV includes ready-made action button configs you can copy, export as `.ninja`, or export as full `.streamDeckAction` packages.

Recommended first buttons:

| Button | Method | URL |
|--------|--------|-----|
| Stop all | `POST` | `http://127.0.0.1:4782/api/emergency/all` |
| Stop sounds | `POST` | `http://127.0.0.1:4782/api/emergency/stop-sounds` |
| Hide overlays | `POST` | `http://127.0.0.1:4782/api/emergency/hide-overlays` |
| Reset overlays | `POST` | `http://127.0.0.1:4782/api/emergency/reset-overlays` |
| Pause alerts | `POST` | `http://127.0.0.1:4782/api/alerts/pause` |
| Resume alerts | `POST` | `http://127.0.0.1:4782/api/alerts/resume` |
| Skip alert | `POST` | `http://127.0.0.1:4782/api/alerts/skip` |
| Replay alert | `POST` | `http://127.0.0.1:4782/api/alerts/replay-last` |
| Clear alerts | `POST` | `http://127.0.0.1:4782/api/alerts/clear` |
| Test follow | `POST` | `http://127.0.0.1:4782/api/test/alert/follow` |

For each of these, use:

```json
{}
```

as the request body.

## 15. Button Icons And Colours

Use consistent colours so you can identify button intent without reading.

| Button type | Suggested colour | Suggested icon keyword |
|-------------|------------------|------------------------|
| Panic / destructive | `#ff3b5f` | `octagon-alert` |
| Warning / temporary safety | `#ff9f1c` | `volume-x`, `eye-off` |
| Reset / utility | `#5b8cff` | `refresh-cw`, `skip-forward` |
| Ready / resume | `#00f593` | `play`, `check` |
| Pause / hold | `#ffcf5a` | `pause` |
| Replay / repeat | `#a78bfa` | `rotate-ccw` |
| Test / sample alerts | `#38bdf8` or `#f472b6` | `user-plus`, `star` |

The Stream Deck page includes these values in each copied action-button config.

## 16. Status And Dynamic Button State

Use these endpoints for Stream Deck plugins that support polling.

Overall readiness:

```text
GET http://127.0.0.1:4782/api/stream-deck/status
```

Macros list:

```text
GET http://127.0.0.1:4782/api/stream-deck/macros
```

Activity layout list:

```text
GET http://127.0.0.1:4782/api/stream-deck/source-groups
```

OBS state:

```text
GET http://127.0.0.1:4782/api/stream-deck/obs
```

`/api/stream-deck/source-groups` includes each layout's `active`, `color`, `icon`, and `url`, which makes it useful for active-state keys.

## 17. Button State Recipes

Use button states when a key should visually reflect the current stream condition.

| Key type | Polling endpoint | Suggested active state |
|----------|------------------|------------------------|
| Readiness key | `/api/stream-deck/status` | Green when `ok` is true, red when false |
| OBS key | `/api/stream-deck/obs` | Green when `ok` is true, red when false |
| Activity layout key | `/api/stream-deck/source-groups` | Highlight the layout where `active` is true |
| Macro key | `/api/stream-deck/macros` | Green when `enabled` is true, muted when false |
| Alert pause key | `/api/stream-deck/status` | Show paused/live based on `states.alertsQueued` and alert queue state in Hub |

For plugins that support dynamic titles, use `title` or `message`.

For plugins that support dynamic colors, use `color`.

For plugins that support icons, use `icon`.

## 18. Multi-Page Deck Blueprint

Use the Stream Deck page in BTV to copy these page blueprints. Each page assumes a 15-key layout and reserves the final three keys for navigation: Back, Home, and Next page.

### Page 1: Live Safety

1. Stop all
2. Stop sounds
3. Hide overlays
4. Reset overlays
5. Disable automations
6. Enable automations
7. Disable channel points
8. Enable channel points
9. Reconnect OBS
10. Reconnect Twitch
11. Status
12. OBS status
13. Back
14. Home
15. Next page

### Page 2: Stream Flow

1. Start Session macro
2. Stop Session macro
3. Starting Soon layout
4. Gameplay layout
5. Just Chatting layout
6. BRB layout
7. Pause alerts
8. Resume alerts
9. Skip alert
10. Replay alert
11. Clear alerts
12. Test follow
13. Back
14. Home
15. Next page

### Page 3: Camera Chaos

1. Camera show
2. Camera hide
3. Camera corner
4. Camera fullscreen
5. Camera DVD bounce
6. Camera wiggle macro
7. Camera reset layout
8. Zoom face macro
9. Fake disconnect macro
10. Deep fry macro
11. Webcam effect off
12. OBS status
13. Back
14. Home
15. Next page

### Page 4: Testing Lab

1. Test follow
2. Test sub
3. Test raid
4. Test cheer
5. Test channel points
6. Replay alert
7. Clear alerts
8. Status
9. OBS status
10. Macro list status
11. Activity layout status
12. Open Hub
13. Back
14. Home
15. Next page

## 19. Troubleshooting

If a button fails:

1. Make sure BTV is running.
2. Make sure the URL uses port `4782`.
3. Make sure OBS WebSocket is connected in Integrations.
4. Check scene and source names exactly match OBS.
5. Try the same action from the Hub page.
6. Check that JSON bodies use double quotes and valid commas.
7. Use the Stream Deck page request builder to copy a known-good request.

If a source position looks wrong:

1. Set the source where you want it in OBS.
2. Open Browser Sources or Dashboard in BTV.
3. Capture or update the Activity Layout again.
4. Re-test the Stream Deck button.

If status polling works but actions fail, your plugin may be sending `GET` instead of `POST`.
