# BTV Roadmap: Turning BTVHub Into a Top-Tier Twitch Streaming Tool

## Executive Summary

BTV is already pointed in a strong direction: it is not just another overlay pack, alert box, or chatbot. It is a local-first streaming control plane for OBS overlays, alerts, widgets, webhooks, Twitch EventSub, and interactive effects.

The opportunity is to evolve BTV into a full creator-owned streaming operating system: something that combines the best ideas from StreamElements, Streamlabs, Streamer.bot, SAMMI, Mix It Up, and Lumia Stream, while keeping the core advantage that those platforms often lack: local ownership, deep customization, low latency, and total control.

The goal is not to clone every platform. The goal is to identify the strongest feature categories from each competitor, implement them in a coherent BTV-style architecture, and gradually turn BTV into a reliable, polished, modular tool that streamers can actually trust live on air.

---

## 1. Product Positioning

### Current Position

BTV currently sits somewhere between:

- Streamer.bot: event-driven automation
- StreamElements: browser-source overlays and widgets
- SAMMI: interactive stream effects
- Mix It Up: chat/community tooling
- Custom OBS dashboard: local production control

The strongest positioning for BTV is:

> BTV is a local-first streaming hub for OBS that lets creators build alerts, overlays, automation, chat interactions, stream controls, and viewer-powered effects from one self-hosted dashboard.

### Why This Position Is Strong

Most Twitch tools force streamers into one of two boxes:

1. Easy but limited cloud tools.
2. Powerful but intimidating automation tools.

BTV can sit between them:

- easier than Streamer.bot for common tasks
- more powerful than Streamlabs for custom workflows
- more private and responsive than StreamElements
- more structured than SAMMI
- more visually integrated than Mix It Up

### Long-Term Product Identity

BTV should become:

> The creator-owned StreamElements + Streamer.bot alternative for OBS power users.

That is the lane.

---

## 2. Current Strengths to Preserve

Before adding shiny things, BTV should protect what already makes it interesting.

### 2.1 Local-First Architecture

This should remain the heart of the project. BTV should not depend on cloud hosting for core stream functionality.

Benefits:

- lower latency
- no third-party outages killing overlays
- full data ownership
- easier LAN/device integrations
- better privacy
- no subscription dependency

### 2.2 Browser Source Overlay Model

OBS browser sources are the correct foundation for modern overlays. BTV should double down on this.

Every overlay should behave like a small app:

- configurable from the dashboard
- controllable over WebSocket
- state-aware
- reload-safe
- themeable
- testable from the dashboard

### 2.3 Modular Monorepo Structure

The existing structure should be treated as a long-term strength:

- `apps/hub` for the dashboard/control UI
- `apps/overlay-server` for local APIs, overlay hosting, and runtime communication
- `packages/shared` for schemas and shared contracts
- `packages/twitch` for Twitch/EventSub integration
- `packages/overlay-sdk` for reusable overlay communication helpers

This is a good base for a platform.

### 2.4 EventSub-First Twitch Integration

BTV should treat Twitch EventSub as a core event source, not an add-on.

Core Twitch events should become first-class triggers:

- follow
- subscription
- resub
- gift sub
- raid
- cheer
- channel point redemption
- stream online/offline
- poll events
- prediction events
- charity events
- shoutout events
- moderator events where useful

---

## 3. Strategic Product Pillars

To become a top tool, BTV needs five core pillars.

### Pillar 1: Overlay Engine

A system for building and running alerts, widgets, chat overlays, goals, tickers, now-playing panels, quiz screens, and custom scenes.

### Pillar 2: Automation Engine

A trigger-condition-action system that lets streamers automate stream events without writing code every time.

### Pillar 3: Stream Control Dashboard

A modern local dashboard for controlling OBS, alerts, scenes, widgets, test events, emergency controls, and integrations.

### Pillar 4: Interaction Layer

Chat commands, channel point actions, viewer games, loyalty, polls, queues, and mini-interactions.

### Pillar 5: Extension Ecosystem

A plugin/widget/action system that allows BTV to grow beyond what one developer can hard-code.

---

## 4. Competitor Feature Adoption Plan

## 4.1 Features to Adopt from StreamElements

StreamElements is strongest at cloud overlays, widgets, chatbot, loyalty, and creator convenience. BTV should adopt the feature concepts but make them local-first.

### Adopt: Overlay Library

BTV should include built-in overlay modules:

- alerts
- chat box
- follower goal
- sub goal
- donation/tip goal if supported later
- event list
- stream ticker
- countdown timer
- now playing
- sponsor panel
- lower thirds
- starting soon screen widgets
- be right back widgets
- ending screen summary

### BTV Implementation

Create a widget registry:

```ts
interface BtvWidgetDefinition {
  id: string;
  name: string;
  description: string;
  category: 'alerts' | 'chat' | 'goals' | 'music' | 'utility' | 'game' | 'custom';
  configSchema: ZodSchema;
  defaultConfig: unknown;
  overlayRoute: string;
  previewRoute?: string;
  events?: string[];
}
```

Each widget should expose:

- config schema
- preview UI
- OBS browser source URL
- supported events
- theme support
- test action support

### Adopt: Widget Customizer

BTV needs a visual editor where users can adjust:

- font
- size
- position
- animation
- colours
- background opacity
- sound
- duration
- layout
- image/video assets

### Adopt: Overlay Collections

StreamElements has overlay sets. BTV should have “overlay packs.”

Example:

- Default Clean Pack
- Neon Cyber Pack
- Subnautica/Ocean Sci-Fi Pack
- Minimal Dark Pack
- Quiz Night Pack
- Risk Tournament Pack

Each pack should contain multiple widgets with matching styles.

---

## 4.2 Features to Adopt from Streamlabs

Streamlabs wins by being easy. BTV should not copy its bloat, but it should copy its onboarding simplicity.

### Adopt: First-Run Setup Wizard

The first time BTV opens, show a guided setup:

1. Welcome to BTV
2. Check Node/runtime status
3. Connect Twitch
4. Connect OBS WebSocket
5. Add browser sources to OBS
6. Test alert
7. Choose starter overlay pack
8. Finish setup

### Adopt: One-Click Test Buttons

Every major feature should have a test button:

- test follow
- test sub
- test raid
- test cheer
- test channel point redemption
- test chat message
- test OBS scene switch
- test sound effect
- test overlay animation

### Adopt: Beginner-Friendly Presets

BTV should have sane default presets:

- beginner streamer
- quiz streamer
- gaming streamer
- tournament host
- podcast/interview mode
- chaos/community mode

Each preset should enable relevant modules automatically.

### Adopt: Setup Health Checks

Create a “BTV Doctor” page:

- Twitch connected: yes/no
- OBS connected: yes/no
- Overlay server running: yes/no
- OAuth certificate trusted: yes/no
- EventSub connected: yes/no
- Browser sources reachable: yes/no
- WebSocket clients connected: count
- Port conflicts detected: yes/no
- Missing environment settings: yes/no

This will massively reduce support pain.

---

## 4.3 Features to Adopt from Streamer.bot

Streamer.bot is the automation monster. This is the most important competitor to learn from.

### Adopt: Trigger → Condition → Action System

BTV needs a visual automation engine.

Example:

> When someone redeems “Jumpscare,” if stream is live and cooldown is ready, play jumpscare overlay, shake camera source, flash lights, play sound, then send chat message.

### Core Concepts

#### Trigger

Something happens.

Examples:

- Twitch follow
- Twitch sub
- chat command
- channel point redemption
- OBS scene changed
- timer elapsed
- webhook received
- keyboard shortcut pressed
- Stream Deck button pressed
- manual dashboard button clicked

#### Condition

Logic that decides whether actions run.

Examples:

- user is moderator
- stream is live
- current scene is Gameplay
- cooldown is not active
- random chance is below 20%
- command was used by subscriber
- variable value is greater than 10

#### Action

Something BTV does.

Examples:

- show alert
- play sound
- send chat message
- switch OBS scene
- show/hide OBS source
- set overlay text
- trigger animation
- call webhook
- update counter
- start timer
- run script

### Automation Data Model

```ts
interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerDefinition;
  conditions: ConditionDefinition[];
  actions: ActionDefinition[];
  cooldown?: CooldownDefinition;
  tags?: string[];
}
```

### Must-Have Automation Actions

OBS actions:

- switch scene
- show source
- hide source
- toggle source
- set source transform
- set source filter enabled
- set source text
- mute/unmute source
- start/stop recording
- start/stop streaming
- take screenshot

Overlay actions:

- show widget
- hide widget
- update widget text
- trigger alert
- trigger animation
- play overlay video
- clear overlay queue

Audio actions:

- play sound
- stop sound
- set volume
- play random sound from folder

Chat actions:

- send message
- reply to user
- shoutout user
- timeout user
- delete message

System actions:

- call webhook
- write file
- read file
- run local script
- wait/delay
- branch/if statement
- random choice

State actions:

- set variable
- increment variable
- decrement variable
- reset variable
- append to list
- clear list

### Priority

This should become BTV’s biggest feature after overlay stability.

---

## 4.4 Features to Adopt from SAMMI

SAMMI is powerful because it lets streams become interactive systems. BTV should adopt the useful parts while keeping structure clean.

### Adopt: Visual Button Decks

Create dashboard decks:

- grid of buttons
- each button runs an automation
- buttons can have colours/icons
- buttons can show live state
- buttons can be grouped into pages

Example pages:

- Alerts
- OBS Scenes
- Quiz Controls
- Soundboard
- Emergency
- Channel Points
- Risk Tournament

### Adopt: Overlay Variables

Allow overlays to subscribe to shared variables.

Examples:

- current question
- timer value
- player score
- latest follower
- current song
- hype level
- chat vote count

### Adopt: Interactive Overlay State

Widgets should not just display events. They should hold state.

Examples:

- quiz scoreboard
- prediction meter
- boss health bar
- chat-controlled chaos meter
- stream currency bank
- tournament leaderboard

### Adopt: Advanced Animation Triggers

BTV should support:

- CSS class animation triggers
- timeline animations
- entrance/exit presets
- sound-synced animations
- chained animations
- random animation variants

---

## 4.5 Features to Adopt from Mix It Up

Mix It Up is excellent for commands, loyalty, and community games. BTV should adopt these ideas carefully.

### Adopt: Chat Command System

Core command features:

- custom commands
- aliases
- cooldowns
- permissions
- variables
- random responses
- command counters
- user-specific responses
- command groups

Example:

`!lurk` → “Tyler has vanished into the shadows. Probably eating crisps.”

### Adopt: Loyalty System

Optional local loyalty points:

- points per minute watched
- bonus for active chatters
- bonus for raids/subs
- redeemable rewards
- leaderboard
- manual adjustment

### Adopt: Viewer Queues

Useful for:

- viewer games
- Risk lobbies
- song requests
- quiz participants
- community games

Queue features:

- join command
- leave command
- random pick
- next user
- clear queue
- priority users
- subscriber priority toggle

### Adopt: Mini-Games

Start simple:

- heist
- duel
- gamble
- raffle
- boss fight
- prediction-style vote

These are not critical for V1, but they build stickiness.

---

## 4.6 Features to Adopt from Lumia Stream

Lumia’s strength is physical environment integration.

### Adopt: Smart Device Action Layer

Eventually support:

- Philips Hue
- Nanoleaf
- Govee
- LIFX
- Elgato Key Light
- generic HTTP devices
- MIDI devices
- serial/Arduino devices

### Best BTV Approach

Do not hard-code every device early. First create a generic “external action adapter” system:

- HTTP request action
- WebSocket action
- MIDI action
- local script action

Then later add friendly integrations.

### Example Use Cases

- Raid turns lights purple
- Sub flashes RGB
- Horror channel point dims lights
- Quiz correct answer turns lights green
- Rage moment triggers red alert mode

---

## 5. Core Architecture Improvements

## 5.1 Create a Central Event Bus

BTV needs one internal event pipeline that everything flows through.

Sources:

- Twitch EventSub
- Twitch chat
- OBS WebSocket
- dashboard buttons
- webhooks
- timers
- local scripts
- Stream Deck requests

All sources should normalize into a single event format.

```ts
interface BtvEvent<TPayload = unknown> {
  id: string;
  type: string;
  source: 'twitch' | 'obs' | 'dashboard' | 'webhook' | 'timer' | 'system';
  timestamp: string;
  actor?: {
    id?: string;
    login?: string;
    displayName?: string;
    roles?: string[];
  };
  payload: TPayload;
  metadata?: Record<string, unknown>;
}
```

Benefits:

- automations become easier
- overlays can listen consistently
- logging becomes cleaner
- replay/testing becomes possible
- integrations become modular

## 5.2 Add Event Replay and Test Events

Every major event should be replayable from the dashboard.

Features:

- recent events log
- click event → replay
- edit payload → replay custom
- save as test fixture
- export event JSON

This is massive for debugging stream alerts.

## 5.3 Add Persistent Local Database

BTV needs local persistence beyond config files as it grows.

Recommended options:

- SQLite for reliable local app storage
- Drizzle ORM or Prisma for schema management
- JSON files only for export/import and simple config

Store:

- integrations
- widget configs
- automation rules
- command definitions
- loyalty points
- event history
- OBS connection profiles
- overlay packs
- user preferences

## 5.4 Add Configuration Import/Export

Streamers need backups.

Add:

- export full BTV profile
- import profile
- export overlay pack
- export automation pack
- export commands
- reset to defaults

This also enables a future community marketplace.

## 5.5 Add Plugin Manifest System

Long-term, BTV needs plugins.

```json
{
  "id": "btv.quiz",
  "name": "Quiz Toolkit",
  "version": "1.0.0",
  "author": "BTV",
  "widgets": ["quiz-screen", "scoreboard"],
  "actions": ["quiz.nextQuestion", "quiz.revealAnswer"],
  "triggers": ["quiz.answerSubmitted"],
  "settingsPage": "/plugins/quiz"
}
```

Start with internal plugins first. Do not open third-party plugin execution until security is mature.

---

## 6. UX Improvements

## 6.1 Dashboard Navigation

Suggested dashboard sections:

1. Home
2. Live Control
3. Overlays
4. Alerts
5. Automations
6. Chat Commands
7. Channel Points
8. OBS Control
9. Media/Sounds
10. Integrations
11. Event Log
12. Settings
13. BTV Doctor

## 6.2 Home Dashboard

The home page should answer:

- Am I ready to stream?
- Is Twitch connected?
- Is OBS connected?
- Are overlays connected?
- What happened recently?
- What buttons do I need most?

Recommended cards:

- Stream status
- OBS status
- Twitch status
- Active scene
- Viewer count
- Recent events
- Overlay clients
- Quick test buttons
- Emergency stop all effects

## 6.3 Live Control Page

This should be the page open during streams.

Include:

- scene buttons
- alert test buttons
- soundboard buttons
- active overlay controls
- channel point toggles
- recent events
- emergency stop
- mute all BTV sounds
- clear overlay queue
- disable automations toggle

## 6.4 Automation Builder UX

Do not start with a complex node editor. Start with a structured form builder.

Recommended layout:

- Rule name
- Trigger dropdown
- Conditions section
- Actions section
- Cooldown section
- Test rule button
- Recent runs

Later, add an advanced node/canvas mode.

## 6.5 Overlay Editor UX

Each overlay should have:

- live preview
- config controls
- theme controls
- animation preview
- OBS URL copy button
- test event button
- reset button

---

## 7. Reliability and Stream-Safety Improvements

Streaming tools must be boringly reliable. Funny alerts can be chaotic; the infrastructure cannot.

## 7.1 Emergency Controls

Add global emergency controls:

- Stop all sounds
- Clear alert queue
- Hide all overlays
- Disable all automations
- Disable channel point actions
- Reset overlay state
- Reconnect OBS
- Reconnect Twitch

These should always be visible in Live Control.

## 7.2 Overlay Heartbeats

Each overlay browser source should connect back to BTV and report:

- overlay ID
- route
- connected time
- last heartbeat
- current state
- errors

Dashboard should show:

- connected overlays
- disconnected overlays
- stale overlays
- duplicate browser sources

## 7.3 Event Queue System

Alerts should run through a queue.

Features:

- priority
- duration
- max queue length
- skip current
- clear queue
- pause queue
- replay last
- prevent duplicate spam

## 7.4 Cooldowns and Rate Limits

Automation rules and commands need:

- global cooldown
- per-user cooldown
- per-command cooldown
- per-reward cooldown
- max uses per stream
- max uses per minute

This prevents chat from turning your stream into a haunted microwave.

## 7.5 Crash Recovery

If BTV restarts mid-stream:

- reload previous state
- reconnect Twitch
- reconnect OBS
- restore overlay state
- preserve alert queue if appropriate
- log what happened

## 7.6 Structured Logging

Add logs for:

- events received
- automations triggered
- actions executed
- OBS calls
- Twitch reconnects
- overlay errors
- auth/token issues

Dashboard should show human-readable logs, not just console spaghetti.

---

## 8. Security Improvements

Because BTV is local-first, security should be practical rather than overcomplicated.

## 8.1 Local Authentication

Even on localhost, add optional dashboard authentication.

Options:

- simple local PIN
- session cookie
- optional LAN access toggle
- API token for external tools

## 8.2 Token Storage

Twitch tokens, client secrets, and future integrations should be stored safely.

Recommended:

- OS keychain where possible
- encrypted local storage fallback
- never expose secrets to overlay pages
- never log tokens
- separate public overlay config from private integration config

## 8.3 Overlay Access Control

Browser source pages should not have access to admin APIs by default.

Separate:

- public overlay routes
- dashboard routes
- internal admin API
- WebSocket overlay channel
- WebSocket admin channel

## 8.4 Webhook Security

For local webhook endpoints:

- require secret tokens
- support signature validation where possible
- rate limit requests
- log unknown requests
- allow disabling public-ish endpoints

---

## 9. Feature Roadmap

## Phase 0: Stabilise the Foundation

Goal: make the current system reliable, understandable, and easier to debug.

### Features

- BTV Doctor page
- event log page
- overlay connection status
- OBS connection status
- Twitch connection status
- better setup wizard
- structured config management
- global emergency controls
- alert queue basics
- test events

### Success Criteria

- user can install and connect Twitch/OBS without guesswork
- user can see why something is not working
- user can test every overlay from dashboard
- user can safely stop all effects during a stream

### Priority

Very high. This phase turns BTV from cool project into usable tool.

---

## Phase 1: Build the Automation Core

Goal: compete with the most useful parts of Streamer.bot.

### Features

- central event bus
- trigger-condition-action data model
- automation builder UI
- core Twitch triggers
- core OBS actions
- core overlay actions
- chat message action
- delay/wait action
- variables
- cooldowns
- automation run history

### Example MVP Automations

- follow → show alert → send chat thanks
- raid → switch to raid scene → play sound → show overlay
- channel point → trigger effect with cooldown
- chat command → update overlay text
- OBS scene change → enable/disable automation group

### Success Criteria

- users can create automations without editing code
- automations can be tested from dashboard
- failed actions are visible in logs
- cooldowns prevent spam

### Priority

Critical. This is the feature that turns BTV into a real platform.

---

## Phase 2: Overlay and Alert System Upgrade

Goal: compete with StreamElements/Streamlabs for daily streamer needs.

### Features

- visual alert editor
- alert queue
- alert variations
- alert sound manager
- alert media manager
- goal widgets
- event list widget
- chat widget
- ticker widget
- now playing widget
- overlay pack system
- OBS URL copy/install helper

### Alert Variations

Allow different styles for:

- follow
- sub
- resub
- gift sub
- raid
- cheer
- channel point
- manual alert

Each variation should support:

- message template
- sound
- media
- duration
- animation
- priority
- conditions

### Success Criteria

- a new streamer can create a full alert setup inside BTV
- a power user can customize deeply
- all alerts can be tested
- alert queue is reliable

---

## Phase 3: Chat and Community Layer

Goal: adopt the best parts of Mix It Up and StreamElements chatbot.

### Features

- Twitch chat connection
- custom commands
- command variables
- permissions
- cooldowns
- aliases
- timers
- quotes
- counters
- viewer queues
- giveaways/raffles
- loyalty points
- simple mini-games

### High-Value Commands

- `!followage`
- `!uptime`
- `!lurk`
- `!discord`
- `!socials`
- `!quote`
- `!addquote`
- `!queue`
- `!join`
- `!next`

### Success Criteria

- user can replace a basic Twitch chatbot with BTV
- command system integrates with automations
- chat events can update overlays

---

## Phase 4: Stream Deck / Mobile / Remote Control

Goal: make BTV usable as a live production control surface.

### Features

- dashboard button decks
- mobile-friendly live control page
- Stream Deck plugin or HTTP API integration
- hotkeys
- action buttons
- button states
- button icons/colours
- multi-page decks

### Button Examples

- Start stream intro
- Trigger hype alert
- Toggle BRB overlay
- Start quiz timer
- Reveal quiz answer
- Clear alerts
- Mute all effects
- Switch to gameplay scene

### Success Criteria

- streamer can run a full show from BTV Live Control
- common actions are one click
- mobile/tablet control feels good

---

## Phase 5: Advanced Interactive Modules

Goal: make BTV more than an alert tool.

### Modules

- Quiz module
- Tournament scoreboard module
- Prediction/voting module
- Boss fight module
- Chat chaos meter
- Soundboard module
- Channel point effect library
- Stream recap generator

### Quiz Module Features

Given your stream style, this could become a flagship BTV feature.

Features:

- create quiz rounds
- manage questions
- display question overlay
- timer overlay
- scoreboard
- team/player list
- reveal answer
- play sounds
- trigger OBS transitions
- chat-based answer collection optional

This would make BTV stand out hard, because most Twitch tools are generic. BTV can become especially strong for game-show/community streams.

---

## Phase 6: Plugin and Marketplace Foundation

Goal: make BTV extensible.

### Features

- plugin manifest system
- internal plugin registry
- plugin settings pages
- install/export local plugin packs
- action/trigger/widget registration
- versioned plugin API
- permissions model

### Marketplace Later

Long-term community sharing:

- overlay packs
- automation packs
- command packs
- quiz packs
- sound packs
- theme packs

Start with import/export before building any public marketplace.

---

## 10. Suggested Technical Architecture

## 10.1 Runtime Services

Recommended service responsibilities:

### Hub UI

- dashboard
- configuration
- automation builder
- live control
- logs
- previews

### Overlay Server

- serves overlay pages
- handles WebSocket connections
- exposes safe overlay runtime APIs
- routes events to overlays

### Core Runtime

Could live inside overlay-server initially, but conceptually should own:

- event bus
- automation engine
- state store
- action runner
- plugin registry
- scheduler

### Twitch Package

Owns:

- OAuth helpers
- token refresh
- EventSub connection
- chat connection later
- normalized Twitch events

### Shared Package

Owns:

- event schemas
- config schemas
- automation schemas
- widget schemas
- API contracts

### Overlay SDK

Owns:

- overlay connection helper
- event subscription helper
- state sync helper
- command dispatch helper
- reconnect logic

---

## 10.2 Recommended Directory Evolution

```txt
apps/
  hub/
  overlay-server/
packages/
  shared/
  twitch/
  overlay-sdk/
  automation-engine/
  obs/
  chat/
  storage/
  plugin-sdk/
  widgets/
```

Do not split everything immediately. Split when modules become painful.

---

## 10.3 API Design

Suggested API groups:

```txt
/api/health
/api/integrations/twitch
/api/integrations/obs
/api/events
/api/automations
/api/widgets
/api/overlays
/api/commands
/api/media
/api/settings
/api/logs
```

Suggested WebSocket channels:

```txt
/ws/overlay
/ws/dashboard
/ws/events
/ws/obs
```

---

## 11. Data Model Suggestions

## 11.1 Automation Rule

```ts
interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  groupId?: string;
  trigger: TriggerConfig;
  conditions: ConditionConfig[];
  actions: ActionConfig[];
  cooldown?: CooldownConfig;
  createdAt: string;
  updatedAt: string;
}
```

## 11.2 Widget Instance

```ts
interface WidgetInstance {
  id: string;
  widgetType: string;
  name: string;
  enabled: boolean;
  config: unknown;
  themeId?: string;
  overlayId?: string;
  createdAt: string;
  updatedAt: string;
}
```

## 11.3 Overlay Client

```ts
interface OverlayClient {
  id: string;
  route: string;
  connectedAt: string;
  lastHeartbeatAt: string;
  obsScene?: string;
  obsSource?: string;
  status: 'connected' | 'stale' | 'disconnected';
}
```

## 11.4 Event Log Entry

```ts
interface EventLogEntry {
  id: string;
  eventType: string;
  source: string;
  payload: unknown;
  automationRuns?: string[];
  timestamp: string;
}
```

---

## 12. MVP Priority List

If you want the highest impact in the shortest time, build in this order:

### Priority 1

- BTV Doctor
- event log
- overlay heartbeat/status
- Twitch/OBS connection status
- emergency controls

### Priority 2

- central event bus
- test/replay events
- alert queue
- visual alert config

### Priority 3

- automation builder MVP
- Twitch triggers
- OBS actions
- overlay actions
- cooldowns

### Priority 4

- chat commands
- channel point actions
- live control deck

### Priority 5

- overlay packs
- quiz/tournament module
- loyalty/queues
- plugin foundation

---

## 13. What Not to Build Yet

Avoid these early traps:

### Do Not Build a Public Marketplace Yet

You need stable import/export and plugin APIs first.

### Do Not Build a Complicated Node Editor First

Node editors look cool but take ages. A structured automation form will be faster and easier.

### Do Not Over-Focus on Multi-Platform Streaming

OBS already handles streaming. BTV should control the production layer.

### Do Not Try to Beat Streamlabs at Beginner Templates Immediately

Win first with power, reliability, and custom control.

### Do Not Add Cloud Accounts Too Early

Local-first is your differentiation. Cloud sync can come later.

---

## 14. Differentiators That Could Make BTV Special

## 14.1 Local-First, But Polished

Most local tools feel powerful but ugly. If BTV is powerful and pleasant, it stands out immediately.

## 14.2 Stream Show Control

BTV should not just be alerts. It should help run shows:

- quizzes
- tournaments
- community nights
- themed streams
- game shows
- events

This aligns perfectly with your Twitch style.

## 14.3 One Dashboard for Everything

The promise:

> Open one dashboard. Control your stream, overlays, alerts, automations, chat interactions, and show segments.

That is compelling.

## 14.4 Replayable Event Debugging

This is underrated. Streamers hate debugging alerts live. BTV can make event replay a killer feature.

## 14.5 Overlay SDK

If BTV makes it easy to create custom overlays that connect to its runtime, it becomes a platform rather than a tool.

---

## 15. Suggested 12-Month Roadmap

## Month 1: Foundation and Debugging

- BTV Doctor
- connection status pages
- event log
- overlay heartbeat
- emergency controls
- better setup wizard

## Month 2: Alert Reliability

- alert queue
- alert editor MVP
- test alerts
- media/sound manager
- replay recent events

## Month 3: Event Bus and Automations MVP

- normalized event bus
- automation schema
- automation builder
- basic triggers/actions
- cooldowns
- automation logs

## Month 4: OBS Control Layer

- scene controls
- source controls
- filters
- recording/streaming actions
- OBS status dashboard
- scene-aware automations

## Month 5: Chat Commands

- chat connection
- custom commands
- aliases
- permissions
- cooldowns
- timers
- counters

## Month 6: Channel Point Control

- channel point triggers
- reward management if API support allows
- cooldowns
- effect library
- dashboard toggles

## Month 7: Live Control Deck

- button grid
- mobile-friendly view
- action buttons
- button states
- soundboard
- emergency panel

## Month 8: Overlay Pack System

- theme system
- import/export packs
- built-in packs
- configurable widgets
- preview system

## Month 9: Quiz / Show Module

- quiz builder
- question overlay
- timer
- scoreboard
- reveal controls
- sound/animation hooks

## Month 10: Loyalty and Queues

- loyalty points
- viewer queues
- raffles
- simple mini-games
- leaderboards

## Month 11: Plugin Foundation

- plugin manifest
- internal plugin registry
- plugin settings
- versioned API
- import/export plugin packs

## Month 12: Polish and Public Release

- documentation
- installer/startup polish
- templates
- demo overlays
- sample automations
- onboarding videos/scripts
- bug bash
- public beta

---

## 16. Release Milestones

## Alpha

Target user: you only.

Requirements:

- Twitch connected
- OBS connected
- overlays work
- alerts work
- event log exists
- emergency stop exists

## Private Beta

Target users: trusted streamer friends.

Requirements:

- setup wizard
- BTV Doctor
- alert editor
- basic automations
- import/export config
- crash-safe startup

## Public Beta

Target users: technical OBS streamers.

Requirements:

- docs
- sample packs
- stable automation builder
- chat commands
- live control deck
- known issues page
- update guide

## V1.0

Target users: real streamers using BTV live.

Requirements:

- reliable install/start process
- stable Twitch/OBS integrations
- alerts/widgets/automations/chat commands
- emergency controls
- backup/export
- polished dashboard
- clear docs

---

## 17. Recommended First Implementation Sprint

If starting tomorrow, I would build this sprint:

### Sprint Goal

Make BTV easier to trust while live.

### Tasks

1. Create `/api/health` endpoint
2. Create BTV Doctor page
3. Track Twitch connection status
4. Track OBS connection status
5. Track overlay WebSocket clients
6. Add overlay heartbeat messages
7. Add event log storage
8. Add test event dispatcher
9. Add emergency stop endpoint
10. Add Live Control emergency buttons

### Why This Sprint First

Because it improves everything else. Before adding more features, you need visibility and control. A streamer should never wonder, “Is this thing even connected?”

---

## 18. Final Product Vision

The dream version of BTV is not just a Twitch alert tool.

It is:

- a local production dashboard
- a browser-source overlay engine
- a Twitch automation engine
- a Stream Deck replacement/companion
- a quiz and community show controller
- a custom widget runtime
- a creator-owned alternative to cloud streaming suites

The strongest version of BTV would let a streamer do this:

1. Start BTV.
2. See all systems are healthy.
3. Open OBS.
4. Control scenes and overlays from BTV.
5. Let Twitch events trigger automations.
6. Run quizzes, games, channel point chaos, and alerts.
7. Debug everything from event logs.
8. Export the whole setup as a reusable profile.

That is how BTV becomes not just useful, but genuinely competitive.

---

## 19. One-Sentence North Star

> BTV should become the best local-first control hub for OBS streamers who want StreamElements-style overlays, Streamer.bot-style automation, Mix It Up-style chat interaction, and SAMMI-style creativity without giving up ownership or control.

