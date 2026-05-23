import type {
  AutomationActionConfig,
  AutomationCondition,
  AutomationRule,
  StreamEvent,
} from "@btv/shared";
import {
  getAutomationRules,
  getSetting,
  recordAutomationRuleRun,
} from "./db.js";
import type { MacroRunner } from "./macro-runner.js";
import type { EffectRunner } from "./effect-runner.js";
import type { OverlayBus } from "./bus.js";
import { sendTwitchChatMessage } from "./twitch-service.js";

const MAX_WAIT_MS = 30_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(ms, MAX_WAIT_MS))));
}

function eventMatches(rule: AutomationRule, event: StreamEvent): boolean {
  const trigger = rule.trigger;
  if (trigger.type === "manual") return false;
  if (trigger.type === "stream_event") return event.type === trigger.eventType;
  if (trigger.type === "chat_command") {
    return event.type === "chat" && (event.message ?? "").trim().toLowerCase().startsWith(trigger.command.toLowerCase());
  }
  return false;
}

function conditionMatches(condition: AutomationCondition, event: StreamEvent): boolean {
  switch (condition.type) {
    case "min_amount":
      return (event.amount ?? 0) >= condition.amount;
    case "message_includes":
      return (event.message ?? "").toLowerCase().includes(condition.text.toLowerCase());
    case "user_role": {
      const roles = Array.isArray(event.payload.roles) ? event.payload.roles.map(String) : [];
      return roles.includes(condition.role);
    }
    default:
      return false;
  }
}

export class EventAutomationEngine {
  private readonly cooldowns = new Map<string, number>();

  constructor(
    private readonly macros: MacroRunner,
    private readonly effects: EffectRunner,
    private readonly bus: OverlayBus,
    private readonly applySourceGroup: (id: string) => Promise<{ ok: boolean; message: string }>,
  ) {}

  async handleEvent(event: StreamEvent): Promise<void> {
    if (getSetting("automations_disabled") === "1") return;
    const rules = getAutomationRules().filter((rule) => rule.enabled && eventMatches(rule, event));
    for (const rule of rules) {
      await this.runRule(rule, event);
    }
  }

  async runManual(ruleId: string): Promise<{ ok: boolean; message: string }> {
    const rule = getAutomationRules().find((candidate) => candidate.id === ruleId);
    if (!rule) return { ok: false, message: "Automation rule not found" };
    const event: StreamEvent = {
      id: crypto.randomUUID(),
      source: "manual",
      type: "unknown",
      payload: {},
      at: new Date().toISOString(),
    };
    return this.runRule(rule, event, true);
  }

  private async runRule(
    rule: AutomationRule,
    event: StreamEvent,
    manual = false,
  ): Promise<{ ok: boolean; message: string }> {
    const now = Date.now();
    const readyAt = this.cooldowns.get(rule.id) ?? 0;
    if (!manual && readyAt > now) {
      const message = `Cooldown ready in ${Math.ceil((readyAt - now) / 1000)}s`;
      recordAutomationRuleRun(rule.id, event.id, "skipped", message);
      return { ok: false, message };
    }

    const failedCondition = rule.conditions.find((condition) => !conditionMatches(condition, event));
    if (failedCondition) {
      const message = `Condition not met: ${failedCondition.type}`;
      recordAutomationRuleRun(rule.id, event.id, "skipped", message);
      return { ok: false, message };
    }

    try {
      const messages: string[] = [];
      for (const action of rule.actions) {
        messages.push(await this.runAction(action, event));
      }
      if (rule.cooldownMs > 0) {
        this.cooldowns.set(rule.id, now + rule.cooldownMs);
      }
      const message = messages.join("; ") || "No actions configured";
      recordAutomationRuleRun(rule.id, event.id, "ok", message);
      return { ok: true, message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Automation rule failed";
      recordAutomationRuleRun(rule.id, event.id, "failed", message);
      return { ok: false, message };
    }
  }

  private async runAction(action: AutomationActionConfig, event: StreamEvent): Promise<string> {
    switch (action.type) {
      case "macro": {
        const result = await this.macros.run(action.macroId);
        if (!result.ok) throw new Error(result.message);
        return `Macro: ${result.message}`;
      }
      case "effect": {
        const ok = await this.effects.fireManual(action.effectId);
        if (!ok) throw new Error("Effect missing, blocked, or failed");
        return `Effect: ${action.effectId}`;
      }
      case "source_group": {
        const result = await this.applySourceGroup(action.sourceGroupId);
        if (!result.ok) throw new Error(result.message);
        return result.message;
      }
      case "twitch_chat": {
        const message = action.message
          .replaceAll("{user}", event.user?.displayName ?? "there")
          .replaceAll("{event}", event.type);
        const ok = await sendTwitchChatMessage(message);
        if (!ok) throw new Error("Twitch chat was not sent");
        return "Twitch chat sent";
      }
      case "overlay_event":
        this.bus.broadcast(
          {
            kind: "effect:play",
            effect: {
              id: crypto.randomUUID(),
              type: "visual",
              name: action.name,
              config: {
                ...action.payload,
                event,
              },
            },
          },
          action.channel,
        );
        return `Overlay event: ${action.name}`;
      case "wait":
        await wait(action.durationMs);
        return `Waited ${action.durationMs}ms`;
      default:
        throw new Error("Unsupported automation action");
    }
  }
}
