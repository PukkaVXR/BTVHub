import type { BtvEvent, BtvEventSource, StreamEvent } from "@btv/shared";
import { logSystem } from "./db.js";

export type CoreEventHandler = (event: BtvEvent) => void | Promise<void>;

const MAX_RECENT_EVENTS = 200;

const STREAM_TO_CORE_SOURCE: Record<StreamEvent["source"], BtvEventSource> = {
  twitch: "twitch",
  webhook: "webhook",
  manual: "dashboard",
  spotify: "spotify",
};

export class CoreEventBus {
  private readonly handlers = new Set<CoreEventHandler>();
  private readonly recent: BtvEvent[] = [];

  subscribe(handler: CoreEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  publish(event: BtvEvent): void {
    this.recent.unshift(event);
    if (this.recent.length > MAX_RECENT_EVENTS) this.recent.length = MAX_RECENT_EVENTS;

    for (const handler of this.handlers) {
      Promise.resolve(handler(event)).catch((err) => {
        logSystem("event-bus", "error", "Core event subscriber failed", {
          eventId: event.id,
          eventType: event.type,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  publishStreamEvent(event: StreamEvent, metadata: Record<string, unknown> = {}): BtvEvent {
    const btvEvent: BtvEvent = {
      id: event.id,
      type: `stream.${event.type}`,
      source: STREAM_TO_CORE_SOURCE[event.source] ?? "system",
      timestamp: event.at,
      actor: event.user
        ? {
            id: event.user.id,
            login: event.user.login,
            displayName: event.user.displayName,
            roles: readRoles(event),
          }
        : undefined,
      payload: event,
      metadata: {
        streamEventType: event.type,
        originalSource: event.source,
        ...metadata,
      },
    };
    this.publish(btvEvent);
    return btvEvent;
  }

  publishSystem(type: string, payload: unknown, metadata: Record<string, unknown> = {}): BtvEvent {
    const event: BtvEvent = {
      id: crypto.randomUUID(),
      type,
      source: "system",
      timestamp: new Date().toISOString(),
      payload,
      metadata,
    };
    this.publish(event);
    return event;
  }

  getRecent(limit = 50): BtvEvent[] {
    return this.recent.slice(0, Math.max(1, Math.min(MAX_RECENT_EVENTS, limit)));
  }
}

function readRoles(event: StreamEvent): string[] | undefined {
  const roles = event.payload.roles;
  if (Array.isArray(roles)) return roles.map(String);

  const badges = event.payload.badges;
  if (!Array.isArray(badges)) return undefined;
  return badges
    .map((badge) => {
      if (badge && typeof badge === "object" && "set_id" in badge) {
        return String((badge as { set_id: unknown }).set_id);
      }
      if (badge && typeof badge === "object" && "setId" in badge) {
        return String((badge as { setId: unknown }).setId);
      }
      return undefined;
    })
    .filter((role): role is string => Boolean(role));
}
