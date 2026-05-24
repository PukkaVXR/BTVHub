import type { BusMessage } from "@btv/shared";
import type { OverlayBus } from "./bus.js";

export interface QueuedAlert {
  id: string;
  channel: string;
  message: Extract<BusMessage, { kind: "alert:play" }>;
  priority: number;
}

export class AlertQueue {
  private queue: QueuedAlert[] = [];
  private playing = false;
  private paused = false;
  private current: QueuedAlert | null = null;
  private currentStartedAt: string | null = null;
  private currentTimer: ReturnType<typeof setTimeout> | null = null;
  private finishCurrent: (() => void) | null = null;
  private lastPlayed: QueuedAlert | null = null;
  private lastByType = new Map<string, number>();

  constructor(private readonly bus: OverlayBus) {}

  enqueue(item: QueuedAlert, cooldownMs = 0): void {
    const key = item.message.alert.event.type;
    const now = Date.now();
    const last = this.lastByType.get(key) ?? 0;
    if (cooldownMs > 0 && now - last < cooldownMs) return;

    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority);
    void this.process();
  }

  private async process(): Promise<void> {
    if (this.paused || this.playing || this.queue.length === 0) return;
    this.playing = true;
    const item = this.queue.shift()!;
    this.current = item;
    this.lastPlayed = item;
    this.currentStartedAt = new Date().toISOString();
    this.lastByType.set(item.message.alert.event.type, Date.now());

    this.bus.broadcast(item.message, item.channel);

    const duration = item.message.alert.durationMs ?? 5000;
    await new Promise<void>((resolve) => {
      this.finishCurrent = resolve;
      this.currentTimer = setTimeout(resolve, duration + 300);
    });

    this.currentTimer = null;
    this.finishCurrent = null;
    this.current = null;
    this.currentStartedAt = null;
    this.playing = false;
    void this.process();
  }

  clear(): number {
    const count = this.queue.length;
    this.queue = [];
    return count;
  }

  skipCurrent(): boolean {
    if (!this.current) return false;
    this.bus.broadcast({ kind: "alert:control", action: "clear_current" }, this.current.channel);
    if (this.currentTimer) clearTimeout(this.currentTimer);
    this.currentTimer = null;
    this.finishCurrent?.();
    return true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    void this.process();
  }

  replayLast(): boolean {
    if (!this.lastPlayed) return false;
    this.enqueue({
      ...this.lastPlayed,
      id: `${this.lastPlayed.id}-replay-${Date.now()}`,
      message: {
        ...this.lastPlayed.message,
        alert: {
          ...this.lastPlayed.message.alert,
          id: `${this.lastPlayed.message.alert.id}-replay-${Date.now()}`,
        },
      },
    });
    return true;
  }

  getStatus() {
    return {
      playing: this.playing,
      paused: this.paused,
      queued: this.queue.length,
      current: this.current
        ? {
            id: this.current.id,
            priority: this.current.priority,
            channel: this.current.channel,
            eventType: this.current.message.alert.event.type,
            user: this.current.message.alert.event.user?.displayName,
            startedAt: this.currentStartedAt,
            durationMs: this.current.message.alert.durationMs ?? 5000,
          }
        : null,
      next: this.queue.slice(0, 5).map((item) => ({
        id: item.id,
        priority: item.priority,
        channel: item.channel,
        eventType: item.message.alert.event.type,
        user: item.message.alert.event.user?.displayName,
      })),
    };
  }
}
