# BTV Architecture

## Overview

BTV is a local-first monorepo with two primary runtime apps:

- `apps/overlay-server` runs the Fastify API, serves overlay/browser-source pages, owns Twitch/OBS/Spotify integrations, and coordinates automations.
- `apps/hub` is the operator dashboard built with React and Vite.

Shared contracts such as route payloads, event types, and runtime constants live in `packages/shared`. Overlay rendering helpers live in `packages/overlay-sdk`.

## Server composition

`apps/overlay-server/src/index.ts` is the bootstrap entrypoint. It initializes the database, auth token state, TLS material, Fastify servers, and the core runtime services:

- `OverlayBus` broadcasts state and events to overlay/browser-source clients.
- `AlertQueue` serializes alert playback.
- `ActionExecutor`, `EffectRunner`, and `MacroRunner` execute reusable actions across automations, effects, and macros.
- `CoreEventBus` normalizes internal events.
- `EventAutomationEngine` evaluates event-driven automation rules.
- `AutomationScheduler` runs interval-based automations.
- `ChatTimerScheduler` restores and runs chat timers.

The server installs structured error handling, process-level crash logging, and graceful shutdown for OBS, EventSub, pollers, timers, sockets, and queue state.

## Route layout

HTTP route registration is centralized in `apps/overlay-server/src/routes/index.ts`. Routes are organized by feature area, including:

- Health, logs, security, config, sessions, and integrations.
- Alerts, alert projects, assets, overlays, widgets, and overlay packs.
- Automations, macros, effects, webhooks, source groups, and Stream Deck helpers.
- Chat/community modules such as commands, timers, quotes, loyalty, giveaways, viewer queue, and mini-games.
- Interactive modules such as tournament scoreboard, predictions, boss fight, and chat chaos.
- Plugin and legacy theme endpoints that still support older data flows.

Public overlay pages and overlay WebSocket access are separated from mutating admin APIs. Admin writes flow through trusted-local auth checks before route handlers run.

## Event flow

The dominant runtime flow is:

1. Twitch EventSub, OBS callbacks, timers, webhooks, or dashboard actions generate events.
2. Events are normalized into shared event shapes and published through `CoreEventBus`.
3. `EventAutomationEngine` and `RulesEngine` evaluate triggers, conditions, cooldowns, and actions.
4. Successful actions call into `ActionExecutor`, `MacroRunner`, `EffectRunner`, or `AlertQueue`.
5. Overlay-visible outcomes are pushed through `OverlayBus` to browser-source pages.

This keeps trigger ingestion, rule evaluation, and final side effects separate enough to reuse the same action primitives across features.

## Overlay model

Static overlay/browser-source entrypoints live under `apps/overlay-server/public/o`. These pages connect back to the overlay bus, render widgets or interactive modules, and stay isolated from admin-only APIs.

The hub app manages configuration and testing, while overlay pages remain thin clients that react to pushed state and effect messages.

## Persistence

SQLite initialization still starts in `apps/overlay-server/src/db.ts`, but per-domain read/write logic has been split into repository modules under `apps/overlay-server/src/repositories`.

Current repositories cover:

- automations
- source groups
- logs
- stream sessions
- webhooks
- goals
- widgets
- alert rules and projects
- effects and macros
- settings
- chat data, loyalty, giveaways, viewer queue, and mini-games

This structure keeps route handlers and runtime services focused on orchestration instead of raw SQL.
