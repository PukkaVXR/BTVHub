# BTV Roadmap Checklist

Use this as the working progress tracker for the roadmap in `btv_top_tool_roadmap.md`.

## Recently Completed Foundation Work

- [x] Add route modules so `apps/overlay-server/src/index.ts` is mostly bootstrap.
- [x] Add route-specific schema/helper files under `apps/overlay-server/src/schemas`.
- [x] Add shared source-group service for routes, Stream Deck, and automations.
- [x] Add initial event-driven automation rule schemas.
- [x] Add event automation rule persistence.
- [x] Add initial event automation engine.
- [x] Wire stream events into event automation rules.
- [x] Add event automation rule API endpoints.
- [x] Add manual test event endpoint.
- [x] Add automation builder UI for triggers, conditions, actions, cooldowns, and manual runs.
- [x] Add automation run history UI.

## Priority Sanity Pass: Beta Readiness Blockers

Goal: pause feature expansion long enough to harden the trust boundary, reliability baseline, and engineering process. These items came from the current project review and should take priority before more marketplace/plugin growth.

### P0: Security And Trust Boundary

- [x] Require `X-BTV-Token`, local PIN/session cookie, or equivalent auth on all mutating `/api/*` routes.
- [x] Update the Hub API client to send the selected auth/session credential automatically.
- [x] Separate public overlay pages and overlay WebSocket access from admin API access.
- [x] Ensure OBS browser-source pages cannot call admin mutating APIs.
- [x] Gate `run_command` macro/effect actions behind auth and an explicit allowlist or confirmation flow.
- [x] Make webhook secrets mandatory for enabled webhooks.
- [x] Add webhook HMAC/signature validation.
- [x] Add webhook rate limiting.
- [x] Log unknown, unsigned, failed, and rate-limited webhook attempts.
- [x] Move the master encryption key away from a plaintext `data/.key` file where possible.
- [x] Add per-install random salt handling for local encryption.

### P1: Reliability And Recovery

- [x] Add Fastify `setErrorHandler` and `setNotFoundHandler` with structured logging.
- [x] Add process-level `unhandledRejection` and `uncaughtException` logging.
- [x] Add graceful shutdown for timers, WebSocket clients, OBS, Twitch EventSub, and background pollers.
- [x] Add OBS auto-reconnect with backoff after connection close.
- [x] Persist or explicitly document restart loss for alert queue state.
- [x] Persist or explicitly document restart loss for automation/chat cooldown state.
- [x] Wrap multi-step database operations in transactions.
- [x] Guard remaining `JSON.parse` setting reads so corrupt settings do not crash routes.

### P2: Maintainability And Architecture

- [x] Split `apps/overlay-server/src/db.ts` into per-domain repository modules.
  - [x] Extract automation persistence into `apps/overlay-server/src/repositories/automation.repository.ts`.
  - [x] Extract source group persistence into `apps/overlay-server/src/repositories/source-groups.repository.ts`.
  - [x] Extract activity and system log persistence into `apps/overlay-server/src/repositories/logs.repository.ts`.
  - [x] Extract stream session and OBS scene span persistence into `apps/overlay-server/src/repositories/stream-sessions.repository.ts`.
  - [x] Extract webhook persistence and request logs into `apps/overlay-server/src/repositories/webhooks.repository.ts`.
  - [x] Extract goals persistence into `apps/overlay-server/src/repositories/goals.repository.ts`.
  - [x] Extract widget persistence into `apps/overlay-server/src/repositories/widgets.repository.ts`.
  - [x] Extract alert rule persistence into `apps/overlay-server/src/repositories/alert-rules.repository.ts`.
  - [x] Extract effect persistence into `apps/overlay-server/src/repositories/effects.repository.ts`.
  - [x] Extract settings persistence into `apps/overlay-server/src/repositories/settings.repository.ts`.
  - [x] Extract theme and alert project persistence into `apps/overlay-server/src/repositories/alert-projects.repository.ts`.
  - [x] Extract macro persistence into `apps/overlay-server/src/repositories/macros.repository.ts`.
  - [x] Extract chat command, timer, and quote persistence into `apps/overlay-server/src/repositories/chat.repository.ts`.
  - [x] Extract loyalty viewer persistence into `apps/overlay-server/src/repositories/loyalty.repository.ts`.
  - [x] Extract viewer queue persistence into `apps/overlay-server/src/repositories/viewer-queue.repository.ts`.
  - [x] Extract giveaway persistence into `apps/overlay-server/src/repositories/giveaways.repository.ts`.
  - [x] Extract mini-game run persistence into `apps/overlay-server/src/repositories/mini-games.repository.ts`.
- [x] Decompose `AlertEditorPage.tsx` into canvas, layers, assets, preview, persistence, and inspector modules.
  - [x] Extract preview rendering, media URL resolution, keyframe interpolation, selection handles, and the preview error boundary into `apps/hub/src/components/alerts/AlertPreview.tsx`.
  - [x] Extract local asset browsing, uploads, media previews, and GIPHY discovery into `apps/hub/src/components/alerts/AlertAssetLibrary.tsx`.
  - [x] Extract layer creation, selection, ordering, duplication, deletion, and project checks into `apps/hub/src/components/alerts/AlertLayersPanel.tsx`.
  - [x] Extract the canvas workspace, fit-to-window behavior, preview controls, safe zones, and timeline into `apps/hub/src/components/alerts/AlertCanvasWorkspace.tsx`.
  - [x] Extract OBS event testing, variation targeting, audio testing, and payload validation into `apps/hub/src/components/alerts/AlertTestInspector.tsx`.
  - [x] Extract common layer transforms, alignment, animation, appearance, timing, and keyframe controls into `apps/hub/src/components/alerts/AlertLayerInspector.tsx`.
  - [x] Extract text, shape, particle, browser, media, audio/reactive, and video controls into `apps/hub/src/components/alerts/AlertLayerTypeInspector.tsx`.
  - [x] Extract project metadata, event, duration, canvas size, and canvas presets into `apps/hub/src/components/alerts/AlertProjectInspector.tsx`.
  - [x] Extract project normalization, resource loading, save/test persistence, import validation, export downloads, and dirty signatures into `apps/hub/src/components/alerts/alertProjectPersistence.ts`.
- [x] Split large multi-feature pages such as `AutomationsPage`, `CommandsPage`, and `StreamDeckRequestBuilder`.
  - [x] Extract the scheduled automation editor and configured jobs table into `apps/hub/src/components/automations/ScheduledAutomationsPanel.tsx`.
  - [x] Extract automation run history into `apps/hub/src/components/automations/AutomationRunHistory.tsx`.
  - [x] Extract the event-rule navigator and rule summary formatting into `apps/hub/src/components/automations/EventRuleList.tsx`.
  - [x] Extract the typed event-rule conditions builder into `apps/hub/src/components/automations/EventRuleConditionsEditor.tsx`.
  - [x] Extract the event-rule trigger and chat-command selector into `apps/hub/src/components/automations/EventRuleTriggerEditor.tsx`.
  - [x] Extract event-rule testing, save/run controls, results, and advanced payload editing into `apps/hub/src/components/automations/EventRuleTestControls.tsx`.
  - [x] Extract the complete typed event-rule action builder into `apps/hub/src/components/automations/EventRuleActionsEditor.tsx`.
  - [x] Extract the mini-game overview and recent results from `CommandsPage` into `apps/hub/src/components/commands/CommandsMiniGamesPanel.tsx`.
  - [x] Extract the loyalty leaderboard and balance manager from `CommandsPage` into `apps/hub/src/components/commands/CommandsLoyaltyPanel.tsx`.
  - [x] Extract giveaway management and raffle controls from `CommandsPage` into `apps/hub/src/components/commands/CommandsGiveawayPanel.tsx`.
  - [x] Extract viewer queue management and manual entry controls from `CommandsPage` into `apps/hub/src/components/commands/CommandsViewerQueuePanel.tsx`.
  - [x] Extract the quote book list and editor from `CommandsPage` into `apps/hub/src/components/commands/CommandsQuotesPanel.tsx`.
  - [x] Extract chat timer scheduling, testing, and editing from `CommandsPage` into `apps/hub/src/components/commands/CommandsTimersPanel.tsx`.
  - [x] Extract command navigation, editing, testing, and deletion from `CommandsPage` into `apps/hub/src/components/commands/CommandsManagerPanel.tsx`.
  - [x] Extract generated request details, exports, clipboard status, and test results from `StreamDeckRequestBuilder` into `apps/hub/src/components/streamDeck/StreamDeckExportPanel.tsx`.
  - [x] Extract Stream Deck action presets and grouped action navigation into `apps/hub/src/components/streamDeck/StreamDeckActionPicker.tsx` with shared builder contracts.
  - [x] Extract macro, alert, emergency, OBS, motion, text, and status behaviour controls from `StreamDeckRequestBuilder` into `apps/hub/src/components/streamDeck/StreamDeckBehaviorConfigurator.tsx`.
  - [x] Extract Stream Deck key preview, visual presets, text, background images, focal controls, colours, and effects into `apps/hub/src/components/streamDeck/StreamDeckKeyDesigner.tsx`.
  - [x] Extract Stream Deck HTTP request generation, warnings, API Ninja configuration, and export payload mapping into `apps/hub/src/components/streamDeck/streamDeckRequestGenerator.ts`.
- [x] Extract a shared action executor for macros, automations, effects, and scheduled actions.
- [x] Consolidate duplicated template interpolation and command parsing helpers.
- [x] Add a data-fetching layer or shared fetch hooks to reduce duplicate polling and retry logic.
- [x] Add shared frontend helpers for overlay origin resolution and JSON downloads.
- [x] Add Zod schemas for remaining route bodies that still use unchecked `req.body` casts.
- [x] Continue UI system migration and retire legacy `.btn` usage.
- [x] Split `styles.css` into smaller feature/style-system files.
- [x] Add Vite manual chunks for large optional editor surfaces.

### P3: Engineering Process And Product Polish

- [x] Add Vitest and first coverage for rules, automation, macro, and action execution logic.
- [x] Add API client tests for high-risk request/response helpers.
- [x] Add linting and formatting with ESLint/Prettier or Biome.
- [x] Add GitHub Actions CI for typecheck, lint, and tests.
- [ ] Add cross-platform start and port helper scripts.
- [x] Reconcile documented Node version requirements.
- [x] Remove or re-route orphaned `ThemesPage.tsx`.
- [x] Drop Monaco dependency if it is no longer used.
- [ ] Add `LICENSE`.
- [ ] Add `CONTRIBUTING.md`.
- [x] Add a short architecture document for services, routes, event flow, overlays, and persistence.

## Phase 0: Stabilise the Foundation

Goal: make the current system reliable, understandable, and easier to debug.

- [x] BTV Doctor / preflight health endpoint.
- [x] Twitch connection status.
- [x] OBS connection status.
- [x] Overlay connection status snapshot.
- [x] Event/activity log.
- [x] Global alert queue clear endpoint.
- [x] Test alert actions.
- [x] Full BTV Doctor page polish.
- [x] Overlay heartbeat messages with stale/disconnected detection.
- [x] Browser source reachability checks.
- [x] Global emergency controls panel.
- [x] Stop all sounds.
- [x] Hide all overlays.
- [x] Disable all automations toggle.
- [x] Disable channel point actions toggle.
- [x] Reset overlay state action.
- [x] Reconnect OBS action.
- [x] Reconnect Twitch action.
- [x] Structured config management improvements.
- [x] Setup wizard improvements.
- [x] Clear human-readable logs for overlay errors, auth issues, OBS calls, and Twitch reconnects.

## Phase 1: Build the Automation Core

Goal: compete with the most useful parts of Streamer.bot.

- [x] Automation rule data model.
- [x] Trigger support: stream event.
- [x] Trigger support: chat command.
- [x] Trigger support: manual run.
- [x] Condition support: minimum amount.
- [x] Condition support: message includes.
- [x] Condition support: user role.
- [x] Action support: macro.
- [x] Action support: effect.
- [x] Action support: activity/source group.
- [x] Action support: Twitch chat.
- [x] Action support: overlay event.
- [x] Action support: wait/delay.
- [x] Cooldowns.
- [x] Automation run history.
- [x] Automation builder MVP.
- [x] Manual test event dispatcher.
- [x] Central event bus abstraction beyond current stream event handling.
- [x] Normalize all event sources into one `BtvEvent` format.
- [x] Core Twitch triggers: follow.
- [x] Core Twitch triggers: subscription.
- [x] Core Twitch triggers: resub.
- [x] Core Twitch triggers: gift sub.
- [x] Core Twitch triggers: raid.
- [x] Core Twitch triggers: cheer.
- [x] Core Twitch triggers: channel point redemption.
- [x] Core OBS trigger: scene changed.
- [x] Core timer trigger.
- [x] Core webhook trigger.
- [x] Core dashboard button trigger.
- [x] OBS action: switch scene.
- [x] OBS action: show/hide/toggle source.
- [x] OBS action: set source transform.
- [x] OBS action: enable/disable source filter.
- [x] OBS action: set source text.
- [x] OBS action: mute/unmute source.
- [x] OBS action: start/stop recording.
- [x] OBS action: start/stop streaming.
- [x] Overlay action: trigger alert.
- [x] Overlay action: trigger animation.
- [x] Overlay action: update widget text.
- [x] Overlay action: clear overlay queue.
- [x] State variables.
- [x] Variable actions: set/increment/decrement/reset.
- [x] Branch/if action.
- [x] Random choice action.
- [x] Failed action visibility in logs.
- [x] Rule test runner with editable event payload.

## Phase 2: Overlay and Alert System Upgrade

Goal: compete with StreamElements and Streamlabs for daily streamer needs.

Status: complete as of 2026-05-25.

Visual alert editor polish is tracked in detail in `Visual Alert Editor Plan.md`.

- [x] Basic alert rules.
- [x] Basic alert queue.
- [x] Theme editing support.
- [x] Sound/media asset upload support.
- [x] Chat widget.
- [x] Goal widget.
- [x] Event ticker widget.
- [x] Now-playing widget.
- [x] Visual alert editor polish.
- [x] Alert variations per event type.
- [x] Alert sound manager polish.
- [x] Alert media manager polish.
- [x] Event list widget.
- [x] Stream ticker configuration polish.
- [x] Overlay pack system.
- [x] Theme system for packs.
- [x] OBS URL copy/install helper.
- [x] Alert replay from recent events.
- [x] Alert queue controls: skip current.
- [x] Alert queue controls: pause queue.
- [x] Alert queue controls: replay last.
- [x] Alert queue priority UI.

## Phase 3: Chat and Community Layer

Goal: adopt the best parts of Mix It Up and StreamElements chatbot.

- [x] Twitch chat connection as a first-class service.
- [x] Custom commands.
- [x] Command aliases.
- [x] Command permissions.
- [x] Command cooldowns.
- [x] Command variables.
- [x] Random command responses.
- [x] Command counters.
- [x] Timers.
- [x] Quotes.
- [x] Viewer queues.
- [x] Giveaways/raffles.
- [x] Loyalty points.
- [x] Simple mini-games.
- [x] Chat events update overlays.
- [x] Commands integrate with automations.

## Phase 4: Stream Deck / Mobile / Remote Control

Goal: make BTV usable as a live production control surface.

- [x] Stream Deck status endpoint.
- [x] Stream Deck OBS status endpoint.
- [x] Stream Deck macros endpoint.
- [x] Stream Deck source groups endpoint.
- [x] Dashboard button decks.
- [x] Mobile-friendly live control page.
- [x] Stream Deck plugin or polished HTTP API guide.
- [x] Hotkeys.
- [x] Action buttons.
- [x] Button states.
- [x] Button icons and colours.
- [x] Multi-page decks.
- [x] Soundboard controls.
- [x] Emergency panel always visible in Live Control.

## Phase 5: Advanced Interactive Modules

Goal: make BTV more than an alert tool.

- [L8R] Quiz module.
- [L8R] Quiz question builder.
- [L8R] Quiz question overlay.
- [L8R] Quiz timer overlay.
- [L8R] Quiz scoreboard.
- [L8R] Quiz answer reveal controls.
- [L8R] Quiz sounds/animation hooks.
- [x] Tournament scoreboard module.
- [x] Prediction/voting module.
- [x] Boss fight module.
- [x] Chat chaos meter.
- [x] Soundboard module.
- [x] Channel point effect library.
- [x] Stream recap generator.

## Phase 6: Plugin and Marketplace Foundation

Goal: make BTV extensible.

- [x] Plugin manifest system.
- [x] Internal plugin registry.
- [x] Plugin settings pages.
- [x] Action/trigger/widget registration.
- [x] Versioned plugin API.
- [x] Permissions model.
- [x] Import/export local plugin packs.
- [x] Export overlay packs.
- [ ] Export automation packs.
- [ ] Export command packs.
- [ ] Export full BTV profile.
- [ ] Import full BTV profile.

## Security And Reliability

- [ ] Optional local dashboard authentication.
- [ ] Simple local PIN.
- [ ] Session cookie.
- [ ] Optional LAN access toggle.
- [ ] API token for external tools.
- [x] Encrypted local setting support exists.
- [ ] OS keychain token storage where possible.
- [x] Never expose secrets to overlay pages.
- [x] Separate public overlay routes from admin APIs.
- [x] Separate overlay WebSocket channel from admin channel.
- [x] Webhook secret tokens.
- [x] Webhook signature validation where possible.
- [x] Webhook rate limiting.
- [x] Unknown webhook request logging.
- [ ] Crash recovery for Twitch reconnect.
- [ ] Crash recovery for OBS reconnect.
- [ ] Restore overlay state after restart.
- [ ] Preserve alert queue on restart where appropriate.

## Product Polish And Release Milestones

### Alpha

- [ ] Twitch connected.
- [ ] OBS connected.
- [ ] Overlays work.
- [x] Alerts work.
- [x] Event log exists.
- [x] Emergency stop exists.

### Private Beta

- [x] Setup wizard.
- [x] BTV Doctor.
- [x] Alert editor.
- [x] Basic automations.
- [ ] Import/export config.
- [ ] Crash-safe startup.

### Public Beta

- [ ] Documentation.
- [ ] Sample packs.
- [ ] Stable automation builder.
- [ ] Chat commands.
- [ ] Live control deck.
- [ ] Known issues page.
- [ ] Update guide.

### V1.0

- [ ] Reliable install/start process.
- [ ] Stable Twitch integration.
- [ ] Stable OBS integration.
- [ ] Alerts/widgets/automations/chat commands.
- [ ] Emergency controls.
- [ ] Backup/export.
- [x] Polished dashboard.
- [ ] Clear docs.
