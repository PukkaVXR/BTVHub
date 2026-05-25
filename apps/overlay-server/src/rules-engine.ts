import {
  type ChatBadge,
  createStreamEvent,
  type StreamEvent,
  type StreamEventType,
} from "@btv/shared";
import { getAlertProject, getAlertRules, getTheme, getWidgets, logActivity, logSessionEvent, updateGoal } from "./db.js";
import type { AlertQueue } from "./alert-queue.js";
import { resolveAlertProjectVariation } from "./alert-variations.js";
import { withAutomationVariables } from "./alert-template-vars.js";
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
    this.bus.broadcast({ kind: "ticker:event", event }, "eventList");

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
              color: readChatColor(event),
              badges: readChatBadges(event),
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
    event = withAutomationVariables(event);
    const rules = getAlertRules().filter(
      (r) => r.enabled && r.eventType === event.type,
    );
    if (!rules.length) return;

    const rule = rules[0]!;
    if (rule.minAmount != null && (event.amount ?? 0) < rule.minAmount) return;

    const rawVisualProject = getAlertProject(rule.themeId) ?? getAlertProject(`alert-${rule.themeId}`) ?? undefined;
    const resolved = rawVisualProject ? resolveAlertProjectVariation(rawVisualProject, event) : undefined;
    const visualProject = resolved?.project;
    const theme = getTheme(rule.themeId) ?? getTheme("default");
    if (!theme && !visualProject) return;

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
            themeId: visualProject?.id ?? theme!.id,
            html: theme?.html ?? "",
            css: theme?.css ?? "",
            js: theme?.js ?? "",
            soundUrl,
            durationMs: visualProject?.durationMs ?? theme?.durationMs ?? 5000,
            visualProject,
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

function readChatColor(event: StreamEvent): string | undefined {
  const color = event.payload.color;
  return typeof color === "string" && color.trim() ? color : undefined;
}

function readChatBadges(event: StreamEvent): ChatBadge[] | undefined {
  const badges = event.payload.badges;
  if (!Array.isArray(badges)) return undefined;
  const normalized = badges
    .map((badge): ChatBadge | undefined => {
      if (!badge || typeof badge !== "object") return undefined;
      const raw = badge as Record<string, unknown>;
      const setId = raw.setId ?? raw.set_id;
      const id = raw.id;
      if (typeof setId !== "string" || typeof id !== "string") return undefined;
      const info = typeof raw.info === "string" && raw.info ? raw.info : undefined;
      return { setId, id, info };
    })
    .filter((badge): badge is ChatBadge => Boolean(badge));
  return normalized.length ? normalized : undefined;
}
