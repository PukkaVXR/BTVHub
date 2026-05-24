# Visual Alert Editor Tutorial

This tutorial explains how to use BTV's Visual Alert Editor to create, test, and manage cinematic Twitch alerts for OBS.

The editor is now the primary alerts source in BTV. The older alert rules and theme pages still exist for routing and legacy compatibility, but day-to-day alert design should happen in the Visual Alert Editor.

## What You Can Build

The Visual Alert Editor lets you build alerts from structured projects instead of hand-written HTML.

You can create alerts with:

- Text, shape, image, GIF, video, audio, particle, and custom HTML layers.
- Drag, resize, rotate, align, nudge, hide, lock, duplicate, and reorder controls.
- Timeline timing for when each layer appears and disappears.
- Animation presets, keyframes, easing, and timeline scrubbing.
- Local media uploads and GIPHY GIF or sticker import.
- Twitch event test buttons for follows, subs, resubs, gift subs, cheers, raids, and channel points.
- Alert variations for rare, threshold, role, event, and channel-point-specific versions.
- Chaos Engine modifiers for randomized shake, flash, hue shift, and scale punch effects.
- Safe mode for disabling risky custom JavaScript during playback.
- OBS browser-source output that uses the same alert projects as the editor.

## Requirements

Before using the editor, make sure:

1. BTV Hub is running.
2. The Hub is available at:

```text
http://127.0.0.1:4781
```

3. The overlay server is available at:

```text
http://127.0.0.1:4782
```

4. OBS Studio is installed.
5. OBS has a Browser Source for alerts.
6. Twitch is connected if you want live Twitch events to trigger alerts.
7. OBS WebSocket is connected if you want dashboard repair/status checks to manage OBS browser sources.

## Start BTV

From the project folder:

```powershell
.\scripts\start.cmd
```

Or, for development:

```powershell
.\pnpm.exe dev
```

Open the Hub:

```text
http://127.0.0.1:4781
```

Then open:

```text
Alerts
```

## OBS Browser Source Setup

The alert browser source URL is:

```text
http://127.0.0.1:4782/o/alerts.html
```

In OBS:

1. Add a new Browser Source.
2. Name it something like `BTV Alerts`.
3. Set the URL to:

```text
http://127.0.0.1:4782/o/alerts.html
```

4. Set width and height to match your alert canvas. The default is:

```text
1920 x 1080
```

5. Enable transparency by leaving the page background transparent.
6. Keep the browser source visible while testing.

You can copy the OBS URL directly from the Visual Alert Editor using `Copy OBS URL`.

## Dashboard Readiness Checks

Before relying on alerts live, open the Dashboard.

The Dashboard shows:

- Overlay server status.
- OBS browser source status.
- Browser source reachability.
- Alert queue status.
- Alert project checks.

If OBS browser sources are missing, mismatched, hidden, or not actively loading, use:

```text
Repair OBS browser sources
```

If an alert has broken media, heavy layer warnings, custom browser-layer warnings, or safe-mode warnings, it appears under Alert Project Checks.

## Editor Layout

The editor is arranged as a workspace.

Top controls:

- Project selector.
- Save project.
- Undo and redo.
- New project.
- Sample pack.
- Save as template.
- Duplicate project.
- Export JSON.
- Import JSON.
- Copy OBS URL.
- Delete.
- Advanced routing.
- Legacy themes.
- Save status.

Left panel:

- Project settings.
- Templates.
- Variations.
- Chaos Engine.
- Safety.
- Canvas settings.
- Test buttons.
- Test payload JSON.
- Layers.
- Project checks.
- Local assets.
- GIPHY.

Center panel:

- Live preview.
- Preview background controls.
- Safe-zone toggle.
- Zoom controls.
- Visual canvas.
- Timeline.
- Playhead.
- Layer tracks.

Right panel:

- Selected layer properties.
- Position, size, rotation, scale, opacity, and blend mode.
- Animation preset controls.
- Alignment controls.
- Layer-specific media, text, audio, shape, particle, and HTML controls.
- Keyframes.
- Advanced custom code controls where supported.

Many heavier sections are collapsed by default. Open them when needed.

## Create Your First Alert

1. Open `Alerts`.
2. Click `New project`, or choose an existing project from the project selector.
3. Open `Templates`.
4. Choose a starter template such as:

- Clean Follow.
- Neon Sub.
- Raid Warning.
- Gift Bomb.
- Cheer Burst.
- Channel Point Chaos.
- Cozy Minimal.
- Horror Glitch.
- Ocean/Sci-Fi.
- Meme Pop.

5. Click `Use this template`, or reset the current alert to a template.
6. Set the alert name.
7. Set the event type.
8. Set the duration in milliseconds.
9. Click `Save project`.
10. Click one of the test buttons, such as `Test follow`.

You should see the alert fire in OBS if your alert browser source is active.

## Save Often

The editor shows whether the current project is saved or has unsaved changes.

Use:

```text
Save project
```

after meaningful edits.

Undo and redo are available for project edits.

Keyboard shortcuts:

| Shortcut | Action |
| --- | --- |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+D | Duplicate selected layer |
| Delete | Delete selected layer |
| Arrow keys | Nudge selected layer by 1 px |
| Shift+Arrow keys | Nudge selected layer by 10 px |

## Layers

Alerts are built from layers. Each layer has position, size, timing, visibility, and style.

Layer types:

| Type | Use |
| --- | --- |
| Text | Names, messages, labels, callouts, event text |
| Shape | Cards, panels, bars, flashes, backgrounds |
| Image | PNG, JPG, WebP, and other still images |
| GIF | Animated GIFs, including imported GIPHY GIFs and stickers |
| Video | MP4, WebM, MOV, and other supported video assets |
| Audio | Sound effects and music stings |
| Particles | Lightweight particle placeholder effects |
| HTML | Custom HTML/CSS/JS browser-style layer |

To add a layer:

1. Find the Layers section.
2. Click `Text`, `Shape`, `Image`, `GIF`, `Video`, `Audio`, `Particles`, or `HTML`.
3. Select the new layer in the layer list.
4. Edit it in the Properties panel.

Layer actions:

- `Up`: move the layer earlier in the stack.
- `Down`: move the layer later in the stack.
- `Duplicate`: copy the selected layer.
- `Delete layer`: remove the selected layer.

Layer list states:

- `Shown` means the layer is visible.
- `Hidden` means the layer is not rendered.
- The type label shows what kind of layer it is.

## Canvas Editing

You can edit directly in the Live Preview.

Select a layer, then:

- Drag it to move it.
- Use corner handles to resize it.
- Use the rotation handle to rotate it.
- Use arrow keys to nudge it.
- Use alignment buttons in Properties to align it to the canvas.

Useful alignment buttons:

- Left.
- Center.
- Right.
- Top.
- Middle.
- Bottom.

Use safe zones to avoid placing important alert content too close to the edge of the canvas.

## Canvas Settings

The default canvas is:

```text
1920 x 1080
```

Available presets:

- 1080p: 1920 x 1080.
- 720p: 1280 x 720.
- Custom.

Use 1920 x 1080 for most OBS alert sources.

## Preview Controls

The Live Preview has:

- Play.
- Pause.
- Restart.
- Preview background.
- Safe zones.
- Fit zoom.
- 25 percent zoom.
- 50 percent zoom.
- 100 percent zoom.

Preview backgrounds:

| Background | Use |
| --- | --- |
| Checkerboard | Best for transparent alerts |
| Dark | Best for bright alert elements |
| Transparent | Best for checking actual transparency |

The preview is meant to match the OBS browser source closely. If something differs in OBS, check browser source size, transparency, project checks, and safe mode.

## Timeline Basics

The timeline controls when each layer appears.

Each layer has:

- Start time.
- End time.
- Duration.
- Animation preset.
- Keyframes.

The timeline ruler uses milliseconds.

Example:

```text
0 ms to 5000 ms = 5 seconds
```

To make a two-stage alert:

1. Set the project duration to something like `8000`.
2. Put the intro layers from `0` to `3000`.
3. Put the main message layers from `2500` to `8000`.
4. Add entrance presets to the main message.
5. Scrub the timeline to verify the transition.

Use the timeline zoom slider when the project has many layers or precise timing.

## Animation Presets

Animation presets let you create polished motion without manually building every keyframe.

Entrance presets:

- Fade in.
- Pop in.
- Slide in.
- Bounce in.
- Elastic in.
- Spin in.
- Screen slam.
- Glitch reveal.

Loop or active presets:

- Pulse.
- Float.
- Wiggle.
- RGB split.
- VHS jitter.
- Bass shake placeholder.
- Glow pulse.

Exit presets:

- Fade out.
- Pop out.
- Slide out.
- Glitch out.
- Explode out placeholder.

To apply a preset:

1. Select a layer.
2. Open Properties.
3. Choose an animation preset.
4. Adjust delay, duration, intensity, and loop.

Tips:

- Use entrance presets for text and key media.
- Use loop presets sparingly so the alert does not feel noisy.
- Use exit presets for dramatic endings.
- Use intensity to make motion stronger or calmer.

## Keyframes

Keyframes give you more control than presets.

Supported keyframe properties:

- Opacity.
- Position.
- Scale.
- Rotation.

Supported easing:

- Linear.
- Ease in.
- Ease out.
- Ease in out.
- Bounce.
- Elastic.

Example: slide and fade a name into place.

1. Select the text layer.
2. Add a position keyframe near `0 ms`.
3. Move the text slightly off-screen.
4. Add a position keyframe around `600 ms`.
5. Move the text into its final position.
6. Add an opacity keyframe at `0 ms` with low opacity.
7. Add an opacity keyframe at `600 ms` with full opacity.
8. Set easing to `ease-out` or `elastic`.

## Text Layers

Text layers can use template variables.

Common variables:

| Variable | Meaning |
| --- | --- |
| `{user}` | Display name or user |
| `{login}` | Login name |
| `{event}` | Event type |
| `{amount}` | Amount, count, bits, or similar numeric value |
| `{message}` | Event message |
| `{payload.rewardTitle}` | Channel point reward title |
| `{var:hype}` | Automation state variable named `hype` |

Example:

```text
{user} just followed!
```

Example:

```text
{user} cheered {amount} bits
```

Example:

```text
Hype level: {var:hype}
```

Text styling includes:

- Font family.
- Font size.
- Font weight.
- Color.
- Stroke.
- Shadow.
- Alignment.
- Glow and filters.

## Media Layers

Media layers use local asset URLs.

Examples:

```text
/assets/media/my-alert.gif
/assets/media/intro.mp4
/assets/sounds/sting.wav
```

Media controls can include:

- Asset URL.
- Fit mode.
- Loop.
- Volume.
- Mute.
- Start offset.
- Fade in.
- Fade out.

If media does not render:

1. Confirm the URL starts with `/assets/media/` or `/assets/sounds/`.
2. Open Project Checks.
3. Confirm the file exists in the assets folder.
4. Re-upload or re-import the media if needed.

## Upload Local Assets

Open `Assets`.

You can:

- Search local assets.
- Filter by type.
- Upload media.
- Upload sound.
- Apply assets to selected layers.
- Delete unused assets.

Use `Upload media` for:

- Images.
- GIFs.
- Videos.

Use `Upload sound` for:

- MP3.
- WAV.
- OGG.
- M4A.
- WebM audio.

When you apply an asset to a selected layer, the editor references the local asset URL in the layer.

## GIPHY GIF And Sticker Import

Open `GIPHY`.

You can search:

- GIFs.
- Stickers.

To import:

1. Choose `GIFs` or `Stickers`.
2. Search for a term like `explosion`, `hype`, `sparkle`, or `raid`.
3. Click a result.
4. BTV downloads the asset locally.
5. The selected layer's asset URL updates to the local `/assets/media/...` path.

Important:

- The GIPHY API key is stored as an encrypted setting.
- The raw key is not sent to overlay browser sources.
- Imported GIFs and stickers become local assets.
- Once imported, the alert can keep working from the local file.

If a GIPHY asset imports but does not show:

1. Check the selected layer type is `GIF` or image-compatible.
2. Confirm the asset URL points to `/assets/media/...`.
3. Open Dashboard and check Alert Project Checks.
4. Confirm the file exists in `assets/media`.
5. Re-import if the local file was deleted.

## Templates

Templates speed up alert creation.

Built-in templates:

- Clean Follow.
- Neon Sub.
- Raid Warning.
- Gift Bomb.
- Cheer Burst.
- Channel Point Chaos.
- Cozy Minimal.
- Horror Glitch.
- Ocean/Sci-Fi.
- Meme Pop.

Template actions:

- Use a template to create a project.
- Reset the current project to a template.
- Save the current project as a local template.
- Create a new project from a local template.
- Delete local templates.

Local templates are stored in your browser's local storage, so they are convenient for personal reuse on the same machine.

For long-term backup, also export important projects as JSON.

## Import And Export

Use `Export JSON` to save a project definition.

Exported alert projects are useful for:

- Backups.
- Sharing between machines.
- Versioning.
- Moving from test to production.

Use `Import JSON` to bring a project back into BTV.

Notes:

- Exports should not contain secret keys.
- GIPHY API keys are not included.
- Local asset URLs may need matching files in the assets folder.
- If imported media is missing, Project Checks will warn you.

## Sample Pack

`Sample pack` creates starter alert projects from the built-in templates.

Use this when:

- Setting up a fresh BTV install.
- Testing the editor quickly.
- Creating a baseline pack before customizing.

## Testing Alerts In OBS

Test buttons fire alerts into the OBS alert browser source.

Available tests:

- Test follow.
- Test sub.
- Test resub.
- Test gift_sub.
- Test cheer.
- Test raid.
- Test channel_points.

Testing workflow:

1. Save the project.
2. Make sure OBS is open.
3. Make sure the `BTV Alerts` browser source is visible.
4. Click the test button for the event.
5. Watch OBS.
6. If nothing appears, open the Dashboard and inspect readiness.

The Setup page test buttons and the Alerts page test buttons should both use the new visual alert projects.

## Test Payload JSON

Open `Test payload JSON` to customize test data.

Default example:

```json
{
  "user": "TestUser",
  "login": "testuser",
  "amount": 100,
  "message": "Test visual alert from hub",
  "variables": {
    "hype": 10
  },
  "payload": {
    "rewardTitle": "Hydrate",
    "streak": 3
  }
}
```

Use this to test variables in text layers.

Example text layer:

```text
{user} redeemed {payload.rewardTitle}
```

With the default payload, this renders like:

```text
TestUser redeemed Hydrate
```

If the JSON is invalid, test buttons are disabled until it is fixed.

## Alert Variations

Variations let one alert project have multiple possible versions.

Use variations for:

- Rare alerts.
- High donation alerts.
- Big cheer alerts.
- VIP or moderator alerts.
- Channel-point-specific alerts.
- Legendary versions.

To create a variation:

1. Design the base alert.
2. Open `Variations`.
3. Click `Capture current`.
4. Rename the variation.
5. Edit its condition.
6. Adjust the variation's layers.
7. Test selected variation.
8. Save the project.

Variation condition fields:

| Field | Meaning |
| --- | --- |
| Enabled | Whether the variation can be used |
| Legendary | Marks this as a special rare variant |
| Priority | Higher-priority matching rules can win |
| Random chance percent | Chance that this variation is selected |
| Event type | Restrict to a specific event type |
| Min amount | Restrict to events at or above a numeric value |
| User role | Restrict by broadcaster, moderator, subscriber, or VIP |
| Channel point title | Restrict to a specific reward title |

Example: rare raid variant.

1. Create a Raid Warning project.
2. Open `Variations`.
3. Click `Capture current`.
4. Name it `Legendary Raid`.
5. Set event type to `raid`.
6. Set random chance to `5`.
7. Enable `Legendary`.
8. Add stronger colors, shake, or a bigger GIF.
9. Test selected variation.

## Chaos Engine

The Chaos Engine applies optional randomized modifiers during alert playback.

Modifiers:

- Shake.
- Flash.
- Hue shift.
- Scale punch.

Controls:

- Enable random modifiers.
- Chaos intensity.
- Legendary boost percent.
- Modifier toggles.

Use chaos when you want alerts to feel less predictable.

Suggested settings:

| Use case | Intensity |
| --- | --- |
| Cozy stream | 10 to 20 percent |
| Standard alert pack | 25 to 40 percent |
| High energy stream | 45 to 70 percent |
| Rare special alerts | 70 to 100 percent |

Avoid enabling every modifier at maximum intensity on every alert. Save the wild settings for rare variants, channel points, raids, or big events.

## Safe Mode

Safe mode disables custom browser-layer JavaScript during playback.

Use safe mode when:

- A custom HTML layer behaves differently in OBS.
- You are going live and want fewer surprises.
- An alert has custom JS that is not essential.
- Dashboard checks warn about browser/custom-code behavior.

Safe mode does not remove the layer. It prevents custom scripts from running during playback.

## Custom HTML Layers

HTML layers are the power-user escape hatch.

They can include:

- Custom HTML.
- Custom CSS.
- Custom JS hook.
- Notes.
- Sandbox options.

Use HTML layers for advanced custom effects that are not yet built into the visual editor.

Best practices:

- Prefer visual layers first.
- Use custom HTML only for effects the editor cannot express yet.
- Keep JavaScript minimal.
- Test in OBS, not just the editor.
- Enable safe mode before going live if the layer is risky.
- Watch Dashboard checks for warnings.

## Project Checks

Project Checks appear in the editor and Dashboard.

They can warn about:

- Missing local media.
- Broken asset references.
- Too many media layers.
- Too many video layers.
- Heavy blur or glow effects.
- Browser/custom HTML layer compatibility.
- Custom JS behavior.
- Safe mode disabling scripts.
- Alert duration above recommended limits.

Treat errors as must-fix before going live.

Treat warnings as review-needed. Some warnings are acceptable for intentional advanced alerts.

## Performance Tips

OBS browser sources are powerful, but they are not unlimited.

For smoother alerts:

- Keep project duration reasonable.
- Avoid too many large video layers.
- Compress large media files.
- Use GIFs and stickers intentionally.
- Prefer short WebM or MP4 clips for video effects.
- Avoid stacking many heavy blur/glow effects.
- Keep custom JavaScript minimal.
- Test on the same PC that will stream.

Recommended starting limits:

| Item | Guideline |
| --- | --- |
| Alert duration | 3 to 8 seconds for most alerts |
| Media layers | Keep under 8 when possible |
| Video layers | Keep under 2 or 3 for stream PCs |
| Heavy glow/blur layers | Use sparingly |
| Rare variants | Good place for heavier effects |

## Live Stream Workflow

Before stream:

1. Start BTV.
2. Open Dashboard.
3. Confirm overlay server is online.
4. Confirm OBS WebSocket is connected.
5. Confirm browser sources are connected or reachable.
6. Open Alerts.
7. Test follow, sub, cheer, raid, and channel points.
8. Review Alert Project Checks.
9. Fix errors.
10. Keep the alerts browser source visible in OBS.

During stream:

1. Use normal Twitch events to trigger alerts.
2. Use Dashboard to monitor alert queue and browser-source health.
3. Use emergency clear controls if needed.

After stream:

1. Export any important finished alerts.
2. Save polished alerts as local templates.
3. Review which alerts felt too loud, too long, or too subtle.
4. Adjust timing, volume, and chaos intensity.

## Common Recipes

### Simple Follow Alert

1. Create a project from `Clean Follow`.
2. Set event type to `follow`.
3. Edit title text to:

```text
{user}
```

4. Edit body text to:

```text
Thanks for the follow!
```

5. Add a subtle pop-in preset.
6. Test follow.
7. Save.

### High-Energy Raid Alert

1. Create a project from `Raid Warning`.
2. Set event type to `raid`.
3. Add a GIF or video background.
4. Add text:

```text
RAID INCOMING
```

5. Add a second text layer:

```text
{user} brought the squad
```

6. Add screen slam or glitch reveal.
7. Add timeline staging so the warning appears first and the raider name appears second.
8. Test raid.
9. Save.

### Channel Point Chaos Alert

1. Create a project from `Channel Point Chaos`.
2. Set event type to `channel_points`.
3. Add text:

```text
{user} redeemed {payload.rewardTitle}
```

4. Add a sticker from GIPHY.
5. Open Chaos Engine.
6. Enable random modifiers.
7. Set intensity around 35 percent.
8. Test channel_points.
9. Save.

### Rare Legendary Variant

1. Create the normal alert first.
2. Open Variations.
3. Click `Capture current`.
4. Rename it `Legendary`.
5. Set random chance to `1`.
6. Enable Legendary.
7. Add stronger media, colors, animations, or sounds.
8. Open Chaos Engine.
9. Add legendary boost if desired.
10. Test selected variation.
11. Save.

### Audio Sting

1. Add an Audio layer.
2. Open Assets.
3. Upload sound.
4. Apply the sound to the selected audio layer.
5. Set start and end time.
6. Adjust volume.
7. Add fade in or fade out if needed.
8. Test in OBS.

## Troubleshooting

### Test Button Does Nothing In OBS

Check:

1. OBS is open.
2. The alert browser source is visible.
3. The browser source URL is:

```text
http://127.0.0.1:4782/o/alerts.html
```

4. Dashboard shows the overlay server online.
5. Dashboard shows OBS browser sources connected or reachable.
6. Project is saved.
7. Test payload JSON is valid.

Then try:

1. Click `Repair OBS browser sources`.
2. Refresh the OBS browser source.
3. Restart BTV.
4. Restart OBS.

### Alert Shows In Preview But Not OBS

Check:

1. OBS browser source URL.
2. OBS source width and height.
3. Source visibility.
4. Browser source cache.
5. Dashboard browser source reachability.
6. Alert Project Checks.

If needed, recreate the OBS browser source.

### Alert Shows Black Background

Check:

1. OBS browser source URL uses `http://127.0.0.1:4782`.
2. Canvas background is transparent if you want transparency.
3. Preview background is not being mistaken for actual output.
4. OBS browser source is not using custom CSS that forces a background.

### Media Does Not Render

Check:

1. The asset URL is local.
2. The file exists in `assets/media` or `assets/sounds`.
3. The layer type matches the asset.
4. Project Checks does not report missing media.
5. The media format is supported by OBS browser sources.

### GIPHY Search Fails

Check:

1. The GIPHY key is configured in Integrations.
2. The key was saved successfully.
3. BTV overlay server is running.
4. Search terms are not empty unless using Trending.
5. Network access is available.

### Imported GIPHY Asset Does Not Show

Check:

1. The asset was downloaded into `assets/media`.
2. The selected layer URL changed to `/assets/media/...`.
3. The selected layer is visible.
4. The selected layer is active during the current timeline playhead.
5. The layer is not hidden behind another opaque layer.

### Custom HTML Layer Misbehaves

Try:

1. Enable Safe mode.
2. Disable custom JS.
3. Keep only HTML and CSS.
4. Test in OBS.
5. Check Dashboard warnings.

### Alert Feels Too Busy

Try:

1. Reduce animation intensity.
2. Reduce chaos intensity.
3. Remove one or two effects.
4. Shorten or simplify GIF/video usage.
5. Make the most important text larger and calmer.

### Alert Feels Too Slow

Try:

1. Shorten duration.
2. Move layer start times earlier.
3. Reduce animation duration.
4. Use pop-in or slide-in instead of long fades.
5. Keep the key message visible by the first second.

## Best Practices

Design rules:

- Make the username readable.
- Make the event type obvious.
- Keep the first second visually clear.
- Use chaos for special moments, not every frame.
- Use rare variants to create surprise.
- Make audio short and not too loud.
- Test on the same OBS canvas size you stream with.
- Export final alerts as backups.

Layer rules:

- Use shapes to frame text.
- Use GIFs and stickers as accents.
- Put text above busy media.
- Lock finished background layers.
- Hide experiments instead of deleting immediately.
- Name layers clearly.

Timeline rules:

- Stage alerts like tiny scenes.
- Give the viewer time to read.
- Avoid every layer starting at exactly `0 ms`.
- Use exits to cleanly finish the alert.
- Scrub the timeline before testing in OBS.

OBS rules:

- Use one dedicated BTV Alerts browser source.
- Keep it at 1920 x 1080 unless your canvas differs.
- Keep the source active.
- Use Dashboard checks before going live.

## Glossary

| Term | Meaning |
| --- | --- |
| Alert project | A saved visual alert definition |
| Layer | One visual or audio element in an alert |
| Canvas | The alert design area, usually 1920 x 1080 |
| Timeline | The time-based layer playback editor |
| Playhead | The current timeline time in preview |
| Keyframe | A saved property value at a specific time |
| Preset | A ready-made animation pattern |
| Variation | A conditional alternate version of an alert |
| Legendary | A special rare variation flag |
| Chaos Engine | Randomized modifier system for alert playback |
| Safe mode | Playback mode that disables custom browser-layer JavaScript |
| Browser source | OBS source that loads the BTV overlay page |
| Project checks | Warnings and errors for alert readiness |

## Suggested Learning Path

1. Build a Clean Follow alert.
2. Add a GIF layer.
3. Add a sound layer.
4. Add entrance and exit presets.
5. Build a two-stage timeline.
6. Test in OBS.
7. Save as a local template.
8. Add a rare variation.
9. Enable mild Chaos Engine settings.
10. Export the finished project JSON.

Once that feels comfortable, move into advanced HTML layers, custom code, and more ambitious multi-stage alert sequences.

