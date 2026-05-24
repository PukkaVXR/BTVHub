# BTV Visual Alert Editor Plan

This document breaks Phase 2's "Visual alert editor polish" into a focused product and engineering plan.

North star:

> BTV should become the first cinematic, local-first streaming alert engine: easy enough to build a good alert in five minutes, deep enough to build something chaotic, reactive, and show-stopping.

## Secret Handling

- [x] Store the GIPHY SDK API key as an encrypted setting, not in source code or public overlay payloads.
- [x] Add a Settings/Integrations control for entering or replacing the GIPHY key.
- [x] Redact the GIPHY key from config exports and logs.
- [x] Only expose proxied search results/assets to the hub UI; do not send the raw key to browser-source overlays.

## Product Principles

- [x] Live preview first: every editor change should be visible quickly.
- [x] Layers, not forms: visual composition should be the main interaction model.
- [x] Timeline, not isolated animation dropdowns: users should understand when things happen.
- [x] Templates for speed, deep controls for power users.
- [x] OBS-native workflow: browser-source output must match the preview.
- [x] Stream-safe by design: no editor feature should make live alerts unrecoverable.
- [x] Local-first core: alerts must work without external services once assets are saved locally.

## Scope Boundaries For This Phase

In scope for this Phase 2 project:

- Visual editor shell.
- Layer-based composition.
- Timeline MVP.
- Real-time preview.
- Alert templates/presets.
- Media, sound, GIF search/import, and local assets.
- Test event buttons.
- Animation presets.
- Alert variation foundation.
- Import/export-ready alert definition schema.

Out of scope for the first editor release:

- Public marketplace.
- AI generation.
- Full node graph editor.
- Full physics engine.
- Full 3D editor.
- Cloud accounts.
- Complex multi-user collaboration.

These are future expansions once the editor core is stable.

## Milestone 1: Data Model And Runtime Contract

Goal: define alert projects as structured data instead of ad hoc HTML/CSS blobs.

- [x] Create shared `AlertProjectSchema`.
- [x] Create shared `AlertLayerSchema`.
- [x] Create shared `AlertTimelineSchema`.
- [x] Create shared `AlertKeyframeSchema`.
- [x] Support project metadata: id, name, event type, duration, canvas size, background mode.
- [x] Support layer types: text, image, video, gif, audio, shape, particle placeholder, browser/custom HTML.
- [x] Support layer properties: position, size, rotation, opacity, scale, anchor, blend mode, visibility, lock.
- [x] Support text properties: font family, size, weight, color, stroke, shadow, alignment, template string.
- [x] Support media properties: asset URL/id, fit mode, loop, volume, mute.
- [x] Support effect properties: blur, glow, saturation, hue rotate, brightness, contrast.
- [x] Support animation properties: keyframes, easing, delay, duration.
- [x] Add migration path from existing `Theme` records into `AlertProject` records.
- [x] Keep existing HTML/CSS/JS theme support as "Advanced / custom code" compatibility mode.

Acceptance criteria:

- [x] Existing alerts still render.
- [x] A new structured alert project can be saved and loaded.
- [x] Structured alert projects can render into the existing alert overlay route.
- [x] Project JSON can be exported/imported without secrets.

## Milestone 2: Editor Shell

Goal: create a serious editor workspace before adding deep controls.

Layout:

- [x] Top bar: alert name, event type, save, preview, test event, duration.
- [x] Left panel: assets and templates.
- [x] Center: live canvas/preview.
- [x] Right panel: selected layer properties.
- [x] Bottom panel: timeline.
- [x] Secondary panel/tab: layers list.

Core UI:

- [x] Add `/alerts/editor/:id` route in Hub.
- [x] Add "Open visual editor" action from Themes/Alerts page.
- [x] Add editor empty state for new alert.
- [x] Add save status and dirty-state warning.
- [x] Add undo/redo stack.
- [x] Add keyboard shortcuts for delete, duplicate, undo, redo.
- [x] Add basic zoom controls for preview canvas.
- [x] Add safe-zone toggle.
- [x] Add transparent/checkerboard preview mode.
- [x] Add 16:9 canvas presets: 1920x1080, 1280x720.

Acceptance criteria:

- [x] User can create/open an alert editor screen.
- [x] User can add, select, duplicate, delete, lock, hide, and reorder layers.
- [x] User can save and reload the alert without losing layer state.

## Milestone 3: Layer-Based Composition

Goal: make alerts feel like a small creative scene editor.

Layer actions:

- [x] Add text layer.
- [x] Add image layer.
- [x] Add GIF layer.
- [x] Add video layer.
- [x] Add audio layer.
- [x] Add shape layer.
- [x] Duplicate layer.
- [x] Delete layer.
- [x] Rename layer.
- [x] Reorder layer.
- [x] Lock layer.
- [x] Hide layer.

Canvas manipulation:

- [x] Drag layer position.
- [x] Resize layer.
- [x] Rotate layer.
- [x] Snap to center.
- [x] Snap to safe-zone edges.
- [x] Nudge with arrow keys.
- [x] Align left/center/right/top/middle/bottom.
- [ ] Multi-select later; single-select is acceptable for MVP.

Properties panel:

- [x] Position X/Y.
- [x] Width/height.
- [x] Scale.
- [x] Rotation.
- [x] Opacity.
- [x] Blend mode.
- [x] Z order.
- [x] Text style controls.
- [x] Media fit controls.
- [x] Shadow/glow controls.
- [x] Filter controls.

Acceptance criteria:

- [x] User can visually compose a layered alert without editing code.
- [x] Canvas preview and saved overlay output match closely.

## Milestone 4: Timeline MVP

Goal: users can control when layers appear, move, animate, and disappear.

Timeline shell:

- [x] Horizontal timeline with duration ruler.
- [x] Playhead.
- [x] Play/pause.
- [x] Restart.
- [x] Scrub preview by dragging playhead.
- [x] Zoom timeline.
- [x] Track per layer.
- [x] Audio track display placeholder.

Layer timing:

- [x] Start time.
- [x] End time.
- [x] Duration.
- [x] Entrance animation.
- [x] Exit animation.
- [x] Delay.

Keyframes:

- [x] Add keyframe for opacity.
- [x] Add keyframe for position.
- [x] Add keyframe for scale.
- [x] Add keyframe for rotation.
- [x] Move keyframe on timeline.
- [x] Delete keyframe.
- [x] Easing dropdown.
- [x] Linear/ease-in/ease-out/ease-in-out/bounce/elastic presets.

Acceptance criteria:

- [x] User can build a two-stage alert sequence.
- [x] Timeline playback matches browser-source alert playback.

## Milestone 5: Animation Presets

Goal: give streamers dramatic results without needing to understand keyframes.

Entrance presets:

- [x] Fade in.
- [x] Pop in.
- [x] Slide in.
- [x] Bounce in.
- [x] Elastic in.
- [x] Spin in.
- [x] Screen slam.
- [x] Glitch reveal.

Loop/active presets:

- [x] Pulse.
- [x] Float.
- [x] Wiggle.
- [x] RGB split.
- [x] VHS jitter.
- [x] Bass shake placeholder.
- [x] Glow pulse.

Exit presets:

- [x] Fade out.
- [x] Pop out.
- [x] Slide out.
- [x] Glitch out.
- [x] Explode out placeholder.

Preset UX:

- [x] Preset gallery with thumbnails or mini previews.
- [x] One-click apply to selected layer.
- [x] Presets translate into timeline/keyframe data.
- [x] User can tweak preset duration/easing/intensity.

Acceptance criteria:

- [x] User can create a polished animated alert in under five minutes.

## Milestone 6: Real-Time OBS-Accurate Preview

Goal: preview should behave like the final browser source.

- [ ] Use the same renderer component for editor preview and overlay playback where practical.
- [x] Add preview event payload selector.
- [x] Add buttons: Test Follow, Test Sub, Test Resub, Test Gift Sub, Test Raid, Test Cheer, Test Channel Point.
- [x] Add custom payload JSON editor for edge cases.
- [x] Add transparent background mode.
- [x] Add checkerboard background mode.
- [x] Add OBS-safe-zone overlay.
- [x] Add preview at 100%, fit, and custom zoom.
- [x] Add performance warning when too many media layers or heavy effects are used.
- [x] Add "copy OBS browser source URL" action.

Acceptance criteria:

- [x] User can test every supported alert event without leaving the editor.
- [x] Saved alert renders the same in preview and overlay route.

## Milestone 7: Asset Library And GIPHY Integration

Goal: users can quickly add media without leaving BTV.

Local asset library:

- [x] Show uploaded images.
- [x] Show uploaded GIFs.
- [x] Show uploaded videos.
- [x] Show uploaded sounds.
- [x] Upload image.
- [x] Upload GIF.
- [x] Upload video.
- [x] Upload sound.
- [x] Delete asset.
- [x] Filter by type.
- [x] Search local assets.

GIPHY:

- [x] Add encrypted GIPHY API key setting.
- [x] Add backend GIPHY search endpoint.
- [x] Add GIPHY trending endpoint.
- [x] Add GIPHY Sticker search/trending/import support.
- [x] Add GIPHY search UI in asset panel.
- [x] Add import selected GIF into local media library.
- [x] Store attribution/source metadata for imported GIPHY assets.
- [x] Handle missing/invalid API key gracefully.
- [x] Rate-limit/protect GIPHY proxy endpoint.

Acceptance criteria:

- [x] User can search GIPHY from BTV, pick a GIF, import it locally, and use it as an alert layer.
- [x] Alerts still work if GIPHY is offline after assets are imported.

## Milestone 8: Sound And Audio Layer Polish

Goal: sound is first-class, not an afterthought.

- [x] Add audio layers to timeline.
- [x] Add waveform placeholder or simple duration bar.
- [x] Add volume control.
- [x] Add mute toggle.
- [x] Add start offset.
- [x] Add fade in/out.
- [x] Add test sound button.
- [x] Add sound asset picker.
- [x] Add "stop all alert sounds" compatibility with emergency controls.
- [x] Prepare data model for future audio-reactive effects.

Acceptance criteria:

- [x] User can add sound to an alert and time it against visuals.

## Milestone 9: Templates And Presets

Goal: make the editor useful before users become experts.

Starter templates:

- [x] Clean Follow.
- [x] Neon Sub.
- [x] Raid Warning.
- [x] Gift Bomb.
- [x] Cheer Burst.
- [x] Channel Point Chaos.
- [x] Cozy Minimal.
- [x] Horror Glitch.
- [x] Ocean/Sci-Fi.
- [x] Meme Pop.

Template UX:

- [x] Template gallery.
- [x] Preview template before applying.
- [x] Create alert from template.
- [x] Save current alert as local template.
- [x] Reset alert to template defaults.

Acceptance criteria:

- [x] A new streamer can build a full basic alert set from templates without touching advanced controls.

## Milestone 10: Alert Variations Foundation

Goal: bridge visual editor polish into the rest of Phase 2.

- [x] Define alert variation schema.
- [x] Support variations per event type.
- [x] Support condition fields: amount threshold, user role, random chance, channel point title.
- [x] Support variant priority.
- [x] Support rare/legendary chance.
- [x] Add variation picker in editor.
- [x] Add duplicate variation action.
- [x] Add test selected variation action.

Acceptance criteria:

- [x] User can create one alert project with multiple event-specific variants.
- [x] Rare alert variants can be tested intentionally.

## Milestone 11: Reactive And Chaos Foundation

Goal: plant the seeds for BTV's signature features without overbuilding too early.

- [x] Add "random chance" variation support.
- [x] Add chaos intensity variable in alert project settings.
- [x] Add modifiers: shake, flash, hue shift, scale punch.
- [x] Add random modifier action.
- [x] Add "legendary variant" flag.
- [x] Add event payload template variables: user, amount, message, event type.
- [x] Add variable template support from automation state: `{var:hype}`.

Acceptance criteria:

- [x] User can make an alert that occasionally chooses a rare variant.

## Milestone 12: Advanced Code Escape Hatch

Goal: keep power users happy without making code the default path.

- [x] Advanced tab for custom CSS.
- [x] Advanced tab for custom JS hook.
- [x] Show warning when custom code disables visual editing for some fields.
- [x] Document event payload shape.
- [x] Document lifecycle hooks: onShow, onHide, onEvent.
- [x] Keep custom code sandboxed to overlay page context.

Acceptance criteria:

- [x] Existing custom themes remain supported.
- [x] Power users can extend alerts without blocking the visual editor roadmap.

## Milestone 13: Performance And Safety

Goal: no cinematic alert should take down the stream.

- [x] Add max media size warnings.
- [x] Add alert duration validation.
- [x] Add missing asset warnings.
- [x] Add broken layer warnings.
- [x] Add unsupported browser feature warning.
- [x] Add preview render error boundary.
- [x] Add overlay render error logging.
- [x] Add "safe mode" playback that disables custom JS/heavy effects.
- [x] Add fallback visual for failed media.

Acceptance criteria:

- [x] Broken alerts fail visibly in the dashboard, not silently on stream.
- [x] Emergency controls still clear/stop alerts created by the visual editor.

## Milestone 14: Documentation And Creator Workflow

Goal: make the feature teach itself.

- [x] Add "Create your first alert" mini tutorial.
- [x] Add template descriptions.
- [x] Add tooltips for timeline/layers/properties.
- [x] Add keyboard shortcut reference.
- [x] Add OBS setup note.
- [x] Add troubleshooting guide for transparent browser source rendering.
- [x] Add sample alert pack.

Acceptance criteria:

- [x] A user can create, test, and add an alert to OBS without asking how.

## Technical Recommendations

Frontend:

- [x] Use React for editor UI.
- [ ] Consider Zustand or local reducer for editor state once state becomes too nested.
- [ ] Use a single renderer component for preview and overlay playback.
- [x] Prefer CSS transforms for MVP animation playback.
- [ ] Consider canvas/Konva/Fabric only when DOM transforms become limiting.
- [ ] Defer Three.js/physics until the 2D timeline is stable.

Backend:

- [x] Store alert projects in SQLite.
- [x] Keep media assets in local asset folders.
- [x] Add asset metadata table when import sources/attribution matter.
- [x] Add GIPHY proxy route in overlay-server.
- [x] Keep alert project schemas in `packages/shared`.

Renderer:

- [x] Render layer tree into positioned DOM.
- [x] Convert timeline/keyframes into CSS animations or runtime interpolation.
- [x] Keep renderer deterministic for preview/testing.
- [x] Keep overlay runtime independent from Hub-only editor dependencies.

## Suggested Build Order

1. Data model and renderer MVP.
2. Editor shell with layer list and preview.
3. Text/image/GIF layers.
4. Save/load structured alert projects.
5. Timeline MVP.
6. Test event preview buttons.
7. Animation presets.
8. GIPHY import.
9. Sound timeline.
10. Templates.
11. Variations.
12. Chaos/reactive foundation.
13. Advanced code escape hatch.
14. Performance/safety polish.
15. Documentation.

## Definition Of Done For Visual Alert Editor Polish

- [x] User can create a new alert from a template.
- [x] User can visually add text, image/GIF/video, and sound layers.
- [x] User can reorder, hide, lock, move, resize, rotate, and style layers.
- [x] User can animate layers with presets and timeline controls.
- [x] User can preview exactly what OBS browser source will show.
- [x] User can test all core Twitch event types.
- [x] User can import GIFs from GIPHY through a secret-safe backend proxy.
- [x] User can save, reload, duplicate, and export alert projects.
- [x] Existing custom HTML/CSS/JS alerts continue to work.
- [x] Broken assets or render errors are visible in the dashboard.
- [x] Alert output remains compatible with the current alert queue.
- [x] The main Phase 2 checklist item "Visual alert editor polish" can be checked off.
