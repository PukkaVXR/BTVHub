# Runtime State And Restart Recovery

BTV is local-first and stores configuration, credentials, sessions, widgets, rules, automations, chat timers, viewer queues, and activity history in `data/btv.db`.

Some live stream state is intentionally memory-only because replaying it after a restart can create confusing or unsafe on-stream behavior. This document records that boundary.

## Alert Queue

The active alert queue is not persisted across server restarts.

Memory-only state:

- Queued alerts waiting to play.
- The currently playing alert timer.
- Paused/resumed queue state.
- The last alert replay shortcut.
- Per-event alert cooldown timestamps held by `AlertQueue`.

Why: after a restart, replaying stale follows, subs, effects, or emergency-paused alerts could surprise the streamer or duplicate viewer-facing moments. BTV treats restart as a clean alert queue boundary.

Operational expectation: if the server restarts, the queue starts empty and live. Activity history remains available, so a streamer can manually replay an alert from Activity if needed.

## Automations And Chat Timers

Scheduled automations and chat timers persist enough metadata to recover safely.

Durable state:

- Automation definitions.
- Automation `lastRunAt`, `nextRunAt`, `runCount`, `lastStatus`, and `lastMessage`.
- Chat timer definitions.
- Chat timer `lastRunAt` and `runCount`.
- Viewer queue entries.

Restart behavior:

- Interval automations are rescheduled from their configured interval when the server starts.
- Automations marked `runOnStart` run shortly after startup.
- Chat timers use their persisted `lastRunAt` and `createdAt` timestamps to avoid firing immediately if their interval has not elapsed.
- Event-driven automation cooldowns are memory-only and reset on restart.
- Effect cooldowns are memory-only and reset on restart.
- Chat command cooldowns are backed by persisted `lastUsedAt` values and survive restart.

## Future Options

If BTV later needs stronger recovery, prefer opt-in behavior:

- Persist alert queue snapshots only when explicitly enabled.
- Store a restart timestamp and discard queued alerts older than a short safety window.
- Persist event automation/effect cooldowns as `readyAt` timestamps.
- Show a startup recovery banner before replaying any viewer-facing action.
