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

- [x] Basic alert rules.
- [x] Basic alert queue.
- [x] Theme editing support.
- [x] Sound/media asset upload support.
- [x] Chat widget.
- [x] Goal widget.
- [x] Event ticker widget.
- [x] Now-playing widget.
- [ ] Visual alert editor polish.
- [ ] Alert variations per event type.
- [ ] Alert sound manager polish.
- [ ] Alert media manager polish.
- [ ] Event list widget.
- [ ] Stream ticker configuration polish.
- [ ] Overlay pack system.
- [ ] Theme system for packs.
- [ ] OBS URL copy/install helper.
- [ ] Alert replay from recent events.
- [ ] Alert queue controls: skip current.
- [ ] Alert queue controls: pause queue.
- [ ] Alert queue controls: replay last.
- [ ] Alert queue priority UI.

## Phase 3: Chat and Community Layer

Goal: adopt the best parts of Mix It Up and StreamElements chatbot.

- [ ] Twitch chat connection as a first-class service.
- [ ] Custom commands.
- [ ] Command aliases.
- [ ] Command permissions.
- [ ] Command cooldowns.
- [ ] Command variables.
- [ ] Random command responses.
- [ ] Command counters.
- [ ] Timers.
- [ ] Quotes.
- [ ] Viewer queues.
- [ ] Giveaways/raffles.
- [ ] Loyalty points.
- [ ] Simple mini-games.
- [ ] Chat events update overlays.
- [ ] Commands integrate with automations.

## Phase 4: Stream Deck / Mobile / Remote Control

Goal: make BTV usable as a live production control surface.

- [x] Stream Deck status endpoint.
- [x] Stream Deck OBS status endpoint.
- [x] Stream Deck macros endpoint.
- [x] Stream Deck source groups endpoint.
- [ ] Dashboard button decks.
- [ ] Mobile-friendly live control page.
- [ ] Stream Deck plugin or polished HTTP API guide.
- [ ] Hotkeys.
- [ ] Action buttons.
- [ ] Button states.
- [ ] Button icons and colours.
- [ ] Multi-page decks.
- [ ] Soundboard controls.
- [ ] Emergency panel always visible in Live Control.

## Phase 5: Advanced Interactive Modules

Goal: make BTV more than an alert tool.

- [ ] Quiz module.
- [ ] Quiz question builder.
- [ ] Quiz question overlay.
- [ ] Quiz timer overlay.
- [ ] Quiz scoreboard.
- [ ] Quiz answer reveal controls.
- [ ] Quiz sounds/animation hooks.
- [ ] Tournament scoreboard module.
- [ ] Prediction/voting module.
- [ ] Boss fight module.
- [ ] Chat chaos meter.
- [ ] Soundboard module.
- [ ] Channel point effect library.
- [ ] Stream recap generator.

## Phase 6: Plugin and Marketplace Foundation

Goal: make BTV extensible.

- [ ] Plugin manifest system.
- [ ] Internal plugin registry.
- [ ] Plugin settings pages.
- [ ] Action/trigger/widget registration.
- [ ] Versioned plugin API.
- [ ] Permissions model.
- [ ] Import/export local plugin packs.
- [ ] Export overlay packs.
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
- [ ] Never expose secrets to overlay pages.
- [ ] Separate public overlay routes from admin APIs.
- [ ] Separate overlay WebSocket channel from admin channel.
- [ ] Webhook secret tokens.
- [ ] Webhook signature validation where possible.
- [ ] Webhook rate limiting.
- [ ] Unknown webhook request logging.
- [ ] Crash recovery for Twitch reconnect.
- [ ] Crash recovery for OBS reconnect.
- [ ] Restore overlay state after restart.
- [ ] Preserve alert queue on restart where appropriate.

## Product Polish And Release Milestones

### Alpha

- [ ] Twitch connected.
- [ ] OBS connected.
- [ ] Overlays work.
- [ ] Alerts work.
- [x] Event log exists.
- [x] Emergency stop exists.

### Private Beta

- [x] Setup wizard.
- [ ] BTV Doctor.
- [ ] Alert editor.
- [ ] Basic automations.
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
- [ ] Polished dashboard.
- [ ] Clear docs.
