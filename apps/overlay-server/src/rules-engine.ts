import {
  createStreamEvent,
  type StreamEvent,
  type StreamEventType,
} from "@btv/shared";
import { getAlertRules, getTheme, getWidgets, logActivity, logSessionEvent, updateGoal } from "./db.js";
import type { AlertQueue } from "./alert-queue.js";
import type { OverlayBus } from "./bus.js";
import type { EffectRunner } from "./effect-runner.js";
import type { EventAutomationEngine } from "./event-automation-engine.js";
import type { CoreEventBus } from "./core-event-bus.js";

const GOAL_EVENT_MAP: Partial<Record<StreamEventType, string>> = {
  follow: "follow",
  sub: "sub",
  resub: "sub",
  gift_sub: "sub",
};

export class RulesEngine {
  constructor(
    private readonly bus: OverlayBus,
    private readonly alertQueue: AlertQueue,
    private readonly effectRunner: EffectRunner,
    private readonly coreEvents: CoreEventBus,
    private readonly eventAutomations?: EventAutomationEngine,
  ) {}

  async handleEvent(event: StreamEvent): Promise<void> {
    logActivity(JSON.stringify(event));
    logSessionEvent(event);
    this.coreEvents.publishStreamEvent(event);

    this.bus.broadcast({ kind: "ticker:event", event }, "ticker");

    if (event.type === "chat" && event.user) {
      const chatWidget = getWidgets().find((w) => w.type === "chat");
      if (!chatWidget || chatWidget.enabled) {
      this.bus.broadcast(
        {
          kind: "chat:message",
          message: {
            id: event.id,
            user: event.user,
            text: event.message ?? "",
            at: event.at,
          },
        },
        "chat",
      );
      }
    }

    await this.updateGoals(event);
    await this.effectRunner.tryTriggerFromEvent(event);
    await this.eventAutomations?.handleEvent(event);
    await this.processAlerts(event);
  }

  private async updateGoals(event: StreamEvent): Promise<void> {
    const goalType = GOAL_EVENT_MAP[event.type];
    if (!goalType) return;

    const { getGoals } = await import("./db.js");
    const goals = getGoals().filter((g) => g.type === goalType);
    for (const g of goals) {
      const current = g.current_count + 1;
      updateGoal(g.id, current);
      this.bus.broadcast(
        {
          kind: "goal:update",
          goal: {
            id: g.id,
            label: g.label,
            current,
            target: g.target_count,
            type: g.type as "follow" | "sub",
          },
        },
        "goal",
      );
      if (current >= g.target_count) {
        await this.handleEvent(
          createStreamEvent({
            source: "manual",
            type: "goal_milestone",
            message: `${g.label} reached!`,
            payload: { goalId: g.id },
          }),
        );
      }
    }
  }

  private async processAlerts(event: StreamEvent): Promise<void> {
    const rules = getAlertRules().filter(
      (r) => r.enabled && r.eventType === event.type,
    );
    if (!rules.length) return;

    const rule = rules[0]!;
    if (rule.minAmount != null && (event.amount ?? 0) < rule.minAmount) return;

    const theme = getTheme(rule.themeId);
    if (!theme) return;

    const soundUrl = rule.soundAsset
      ? `/assets/${rule.soundAsset}`
      : undefined;

    this.alertQueue.enqueue(
      {
        id: crypto.randomUUID(),
        channel: "alerts",
        priority: rule.priority,
        message: {
          kind: "alert:play",
          alert: {
            id: crypto.randomUUID(),
            event,
            themeId: theme.id,
            html: theme.html,
            css: theme.css,
            js: theme.js,
            soundUrl,
            durationMs: theme.durationMs,
          },
        },
      },
      rule.cooldownMs,
    );
  }

  async fireTestAlert(eventType: StreamEventType): Promise<void> {
    await this.handleEvent(
      createStreamEvent({
        source: "manual",
        type: eventType,
        user: {
          id: "test",
          displayName: "TestUser",
          login: "testuser",
        },
        message: "Test alert from hub",
        amount: eventType === "cheer" ? 100 : undefined,
        payload: {},
      }),
    );
  }
}
