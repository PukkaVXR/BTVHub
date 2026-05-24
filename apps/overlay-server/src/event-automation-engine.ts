import type {
  AutomationActionConfig,
  AutomationCondition,
  AutomationRule,
  BtvEvent,
  StreamEvent,
} from "@btv/shared";
import { AutomationActionSchema, createStreamEvent } from "@btv/shared";
import {
  deleteAutomationStateValue,
  getAutomationRules,
  getAutomationStateValue,
  getAlertProject,
  getSetting,
  getTheme,
  recordAutomationRuleRun,
  setAutomationStateValue,
  updateWidgetText,
} from "./db.js";
import type { MacroRunner } from "./macro-runner.js";
import type { EffectRunner } from "./effect-runner.js";
import type { OverlayBus } from "./bus.js";
import { sendTwitchChatMessage } from "./twitch-service.js";
import {
  pauseObsRecording,
  resumeObsRecording,
  runObsSourceMotion,
  setObsInputMuted,
  setObsScene,
  setObsSourceFilterEnabled,
  setObsSourceVisible,
  setObsText,
  startObsRecording,
  startObsStream,
  stopObsRecording,
  stopObsStream,
} from "./obs-client.js";
import type { AlertQueue } from "./alert-queue.js";
import { resolveAlertProjectVariation } from "./alert-variations.js";

const MAX_WAIT_MS = 60 * 60_000;

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

function coreEventMatches(rule: AutomationRule, event: BtvEvent): boolean {
  return rule.trigger.type === "btv_event" && rule.trigger.eventType === event.type;
}

function streamEventFromCoreEvent(event: BtvEvent): StreamEvent {
  return {
    id: event.id,
    source: event.source === "webhook" ? "webhook" : "manual",
    type: "unknown",
    user: event.actor?.displayName
      ? {
          id: event.actor.id ?? event.id,
          login: event.actor.login,
          displayName: event.actor.displayName,
        }
      : undefined,
    message: event.type,
    payload: {
      btvEvent: event,
      roles: event.actor?.roles ?? [],
    },
    at: event.timestamp,
  };
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
    case "variable_compare": {
      const current = getAutomationStateValue(condition.name);
      if (condition.operator === "exists") return current !== undefined;
      if (condition.operator === "equals") return current === condition.value;
      if (condition.operator === "not_equals") return current !== condition.value;
      const left = Number(current);
      const right = Number(condition.value);
      if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
      return condition.operator === "greater_than" ? left > right : left < right;
    }
    default:
      return false;
  }
}

function renderTemplate(template: string, event: StreamEvent): string {
  return template
    .replaceAll("{user}", event.user?.displayName ?? "there")
    .replaceAll("{event}", event.type)
    .replace(/\{var:([^}]+)\}/g, (_match, key: string) => String(getAutomationStateValue(key.trim()) ?? ""));
}

export class EventAutomationEngine {
  private readonly cooldowns = new Map<string, number>();

  constructor(
    private readonly macros: MacroRunner,
    private readonly effects: EffectRunner,
    private readonly bus: OverlayBus,
    private readonly alertQueue: AlertQueue,
    private readonly applySourceGroup: (id: string) => Promise<{ ok: boolean; message: string }>,
  ) {}

  async handleEvent(event: StreamEvent): Promise<void> {
    if (getSetting("automations_disabled") === "1") return;
    const rules = getAutomationRules().filter((rule) => rule.enabled && eventMatches(rule, event));
    for (const rule of rules) {
      await this.runRule(rule, event);
    }
  }

  async handleCoreEvent(event: BtvEvent): Promise<void> {
    if (getSetting("automations_disabled") === "1") return;
    const streamEvent = streamEventFromCoreEvent(event);
    const rules = getAutomationRules().filter((rule) => rule.enabled && coreEventMatches(rule, event));
    for (const rule of rules) {
      await this.runRule(rule, streamEvent);
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

  async runTest(ruleId: string, event: StreamEvent): Promise<{ ok: boolean; message: string }> {
    const rule = getAutomationRules().find((candidate) => candidate.id === ruleId);
    if (!rule) return { ok: false, message: "Automation rule not found" };
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
      for (const [index, action] of rule.actions.entries()) {
        try {
          messages.push(await this.runAction(action, event));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Automation action failed";
          throw new Error(`Action ${index + 1} (${action.type}) failed: ${message}`);
        }
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
      case "obs_scene": {
        const ok = await setObsScene(action.sceneName);
        if (!ok) throw new Error(`Could not switch OBS scene to ${action.sceneName}`);
        return `OBS scene: ${action.sceneName}`;
      }
      case "obs_source_visibility": {
        const ok = await setObsSourceVisible(action.sceneName, action.sourceName, action.visible);
        if (!ok) throw new Error(`Could not update OBS source ${action.sourceName}`);
        return `${action.sourceName}: ${action.visible ? "visible" : "hidden"}`;
      }
      case "obs_source_motion": {
        const ok = await runObsSourceMotion(action);
        if (!ok) throw new Error(`Could not move OBS source ${action.sourceName}`);
        return `OBS source motion: ${action.sourceName}`;
      }
      case "obs_filter": {
        const ok = await setObsSourceFilterEnabled(action.sourceName, action.filterName, action.enabled);
        if (!ok) throw new Error(`Could not update OBS filter ${action.filterName}`);
        return `${action.sourceName}/${action.filterName}: ${action.enabled ? "enabled" : "disabled"}`;
      }
      case "obs_mute": {
        const ok = await setObsInputMuted(action.inputName, action.muted);
        if (!ok) throw new Error(`Could not update OBS input mute for ${action.inputName}`);
        return `${action.inputName}: ${action.muted ? "muted" : "unmuted"}`;
      }
      case "obs_recording": {
        const ok =
          action.action === "start"
            ? await startObsRecording()
            : action.action === "stop"
              ? await stopObsRecording()
              : action.action === "pause"
                ? await pauseObsRecording()
                : await resumeObsRecording();
        if (!ok) throw new Error(`Could not ${action.action} OBS recording`);
        return `OBS recording: ${action.action}`;
      }
      case "obs_streaming": {
        const ok = action.action === "start" ? await startObsStream() : await stopObsStream();
        if (!ok) throw new Error(`Could not ${action.action} OBS stream`);
        return `OBS stream: ${action.action}`;
      }
      case "obs_text": {
        const text = renderTemplate(action.text, event);
        const ok = await setObsText(action.inputName, text);
        if (!ok) throw new Error(`Could not update OBS text ${action.inputName}`);
        return `OBS text: ${action.inputName}`;
      }
      case "clear_alerts": {
        const cleared = this.alertQueue.clear();
        return `Cleared ${cleared} queued alert(s)`;
      }
      case "twitch_chat": {
        const message = renderTemplate(action.message, event);
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
      case "overlay_alert": {
        const rawVisualProject = getAlertProject(action.themeId) ?? getAlertProject(`alert-${action.themeId}`) ?? undefined;
        const theme = getTheme(action.themeId) ?? getTheme("default");
        if (!theme && !rawVisualProject) throw new Error(`Alert project not found: ${action.themeId}`);
        const alertEvent = createStreamEvent({
          source: "manual",
          type: action.eventType,
          user: {
            id: "automation",
            login: "automation",
            displayName: renderTemplate(action.userName, event),
          },
          message: renderTemplate(action.message, event),
          payload: { sourceEvent: event },
        });
        const visualProject = rawVisualProject ? resolveAlertProjectVariation(rawVisualProject, alertEvent).project : undefined;
        this.alertQueue.enqueue({
          id: crypto.randomUUID(),
          channel: "alerts",
          priority: 0,
          message: {
            kind: "alert:play",
            alert: {
              id: crypto.randomUUID(),
              event: alertEvent,
              themeId: visualProject?.id ?? theme!.id,
              html: theme?.html ?? "",
              css: theme?.css ?? "",
              js: theme?.js ?? "",
              durationMs: action.durationMs ?? visualProject?.durationMs ?? theme?.durationMs,
              visualProject,
            },
          },
        });
        return `Overlay alert: ${action.eventType}`;
      }
      case "overlay_animation":
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
        return `Overlay animation: ${action.name}`;
      case "widget_text": {
        const ok = updateWidgetText(action.widgetId, renderTemplate(action.text, event));
        if (!ok) throw new Error(`Widget not found: ${action.widgetId}`);
        this.bus.broadcast(
          {
            kind: "effect:play",
            effect: {
              id: crypto.randomUUID(),
              type: "visual",
              name: "widget_text_updated",
              config: { widgetId: action.widgetId, text: renderTemplate(action.text, event) },
            },
          },
          "widgets",
        );
        return `Widget text: ${action.widgetId}`;
      }
      case "variable_set":
        setAutomationStateValue(action.name, action.value);
        return `Variable ${action.name} set`;
      case "variable_increment": {
        const next = Number(getAutomationStateValue(action.name) ?? 0) + action.amount;
        setAutomationStateValue(action.name, next);
        return `Variable ${action.name} incremented to ${next}`;
      }
      case "variable_decrement": {
        const next = Number(getAutomationStateValue(action.name) ?? 0) - action.amount;
        setAutomationStateValue(action.name, next);
        return `Variable ${action.name} decremented to ${next}`;
      }
      case "variable_reset":
        deleteAutomationStateValue(action.name);
        return `Variable ${action.name} reset`;
      case "branch": {
        const branchActions = action.conditions.every((condition) => conditionMatches(condition, event))
          ? action.thenActions
          : action.elseActions;
        const messages: string[] = [];
        for (const rawAction of branchActions) {
          messages.push(await this.runAction(AutomationActionSchema.parse(rawAction), event));
        }
        return `Branch: ${messages.join(", ") || "no actions"}`;
      }
      case "random_choice": {
        const total = action.choices.reduce((sum, choice) => sum + choice.weight, 0);
        if (total <= 0) return "Random choice: no choices";
        let cursor = Math.random() * total;
        const choice = action.choices.find((candidate) => {
          cursor -= candidate.weight;
          return cursor <= 0;
        }) ?? action.choices.at(-1);
        const messages: string[] = [];
        for (const rawAction of choice?.actions ?? []) {
          messages.push(await this.runAction(AutomationActionSchema.parse(rawAction), event));
        }
        return `Random choice: ${messages.join(", ") || "no actions"}`;
      }
      case "wait":
        await wait(action.durationMs);
        return `Waited ${action.durationMs}ms`;
      default:
        throw new Error("Unsupported automation action");
    }
  }
}
