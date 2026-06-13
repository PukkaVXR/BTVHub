import {
  type ChatBadge,
  createStreamEvent,
  type StreamEvent,
  type StreamEventType,
  type StreamUser,
} from "@btv/shared";
import { awardLoyaltyPoints, getAlertProject, getAlertRules, getTheme, getWidgets, logActivity, logSessionEvent, updateGoal, type LoyaltyViewer } from "./db.js";
import type { AlertQueue } from "./alert-queue.js";
import { resolveAlertProjectVariation } from "./alert-variations.js";
import { withAutomationVariables } from "./alert-template-vars.js";
import type { OverlayBus } from "./bus.js";
import { runChatCommandFromEvent } from "./chat-command-runner.js";
import type { EffectRunner } from "./effect-runner.js";
import type { EventAutomationEngine } from "./event-automation-engine.js";
import type { CoreEventBus } from "./core-event-bus.js";
import { parseChatCommandText } from "./chat-command-utils.js";

const GOAL_EVENT_MAP: Partial<Record<StreamEventType, string>> = {
  follow: "follow",
  sub: "sub",
  resub: "sub",
  gift_sub: "sub",
};

interface RecentChatActivity {
  userId: string;
  at: number;
}

export class RulesEngine {
  private totalChatMessages = 0;
  private readonly recentChatActivity: RecentChatActivity[] = [];

  constructor(
    private readonly bus: OverlayBus,
    private readonly alertQueue: AlertQueue,
    private readonly effectRunner: EffectRunner,
    private readonly coreEvents: CoreEventBus,
    private readonly eventAutomations?: EventAutomationEngine,
  ) {}

  async handleEvent(event: StreamEvent): Promise<void> {
    event = withChatCommandPayload(event);
    logActivity(JSON.stringify(event));
    logSessionEvent(event);
    this.coreEvents.publishStreamEvent(event);
    if (event.type === "chat" && event.payload.isCommand === true) {
      this.coreEvents.publish({
        id: `${event.id}:command`,
        type: "chat.command",
        source: event.source === "twitch" ? "twitch" : "dashboard",
        timestamp: event.at,
        actor: event.user
          ? {
              id: event.user.id,
              login: event.user.login,
              displayName: event.user.displayName,
              roles: readRolesFromEvent(event),
            }
          : undefined,
        payload: {
          command: event.payload.command,
          args: event.payload.args,
          message: event.message ?? "",
          streamEventId: event.id,
        },
        metadata: { streamEventType: "chat", command: event.payload.command },
      });
    }

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

    if (event.type === "chat") {
      const viewer = this.awardChatLoyalty(event);
      this.broadcastChatStats(event, viewer);
      await runChatCommandFromEvent(event);
    }

    await this.updateGoals(event);
    await this.effectRunner.tryTriggerFromEvent(event);
    await this.eventAutomations?.handleEvent(event);
    await this.processAlerts(event);
  }

  private awardChatLoyalty(event: StreamEvent): LoyaltyViewer | null {
    if (!event.user?.id || !event.user.displayName) return null;
    return awardLoyaltyPoints({
      id: event.user.id,
      login: event.user.login,
      displayName: event.user.displayName,
      points: 5,
      messageCount: 1,
      earnCooldownMs: 60_000,
    });
  }

  private broadcastChatStats(event: StreamEvent, viewer: LoyaltyViewer | null): void {
    if (!event.user?.id) return;
    const now = Date.now();
    this.totalChatMessages += 1;
    this.recentChatActivity.push({ userId: event.user.id, at: now });
    while (this.recentChatActivity.length && now - this.recentChatActivity[0]!.at > 60_000) {
      this.recentChatActivity.shift();
    }

    const stats = {
      messagesPerMinute: this.recentChatActivity.length,
      activeChatters: new Set(this.recentChatActivity.map((item) => item.userId)).size,
      totalMessages: this.totalChatMessages,
      latestUser: event.user as StreamUser,
      latestMessage: event.message ?? "",
      loyalty: viewer
        ? {
            userId: viewer.id,
            displayName: viewer.displayName,
            points: viewer.points,
            lifetimePoints: viewer.lifetimePoints,
          }
        : undefined,
      at: event.at,
    };

    this.bus.broadcast({ kind: "chat:stats", stats }, "chat");
    this.bus.broadcast({ kind: "chat:stats", stats }, "ticker");
    this.bus.broadcast({ kind: "chat:stats", stats }, "eventList");
    this.bus.broadcast({ kind: "chat:stats", stats }, "chatActivity");
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

function withChatCommandPayload(event: StreamEvent): StreamEvent {
  if (event.type !== "chat") return event;
  const parsed = parseChatCommandText(event.message ?? "");
  if (!parsed) return event;
  return {
    ...event,
    payload: {
      ...event.payload,
      isCommand: true,
      command: parsed.command,
      args: parsed.args,
    },
  };
}

function readRolesFromEvent(event: StreamEvent): string[] | undefined {
  const roles = event.payload.roles;
  if (Array.isArray(roles)) return roles.map(String);
  const badges = readChatBadges(event);
  return badges?.map((badge) => badge.setId);
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
