import { createStreamEvent } from "@btv/shared";
import { createHash, timingSafeEqual } from "node:crypto";
import { getWebhook, logWebhookRequest } from "./db.js";
import type { RulesEngine } from "./rules-engine.js";
import type { EffectRunner } from "./effect-runner.js";
import type { MacroRunner } from "./macro-runner.js";
import { getGoal, updateGoal } from "./db.js";
import type { OverlayBus } from "./bus.js";
import type { CoreEventBus } from "./core-event-bus.js";

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

function safeBodyLog(body: unknown): string {
  try {
    const json = JSON.stringify(body);
    return json.length > 4000 ? `${json.slice(0, 4000)}...[truncated]` : json;
  } catch {
    return "[unserializable]";
  }
}

export async function handleWebhook(
  hookId: string,
  body: unknown,
  secretHeader: string | undefined,
  rules: RulesEngine,
  effects: EffectRunner,
  macros: MacroRunner,
  bus: OverlayBus,
  coreEvents?: CoreEventBus,
): Promise<{ ok: boolean; error?: string }> {
  const hook = getWebhook(hookId);
  if (!hook) return { ok: false, error: "Hook not found" };

  if (hook.secret && !safeEqual(hook.secret, secretHeader ?? "")) {
    return { ok: false, error: "Invalid secret" };
  }

  logWebhookRequest(hookId, safeBodyLog(body));

  const payload = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  coreEvents?.publish({
    id: crypto.randomUUID(),
    type: `webhook.${hook.action}`,
    source: "webhook",
    timestamp: new Date().toISOString(),
    payload,
    metadata: { hookId, action: hook.action },
  });

  switch (hook.action) {
    case "alert": {
      const eventType = String(
        hook.actionConfig.eventType ?? payload.type ?? "follow",
      ) as "follow";
      await rules.handleEvent(
        createStreamEvent({
          source: "webhook",
          type: eventType,
          user: {
            id: String(payload.userId ?? "webhook"),
            displayName: String(payload.displayName ?? payload.name ?? "Webhook"),
          },
          message: String(payload.message ?? ""),
          amount: payload.amount != null ? Number(payload.amount) : undefined,
          payload,
        }),
      );
      break;
    }
    case "goal_increment": {
      const goalId = String(hook.actionConfig.goalId ?? "");
      const g = getGoal(goalId);
      if (g) {
        const inc = Number(payload.increment ?? 1);
        const current = g.current_count + inc;
        updateGoal(g.id, current);
        bus.broadcast(
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
      }
      break;
    }
    case "effect": {
      const effectId = String(hook.actionConfig.effectId ?? "");
      await effects.fireManual(effectId);
      break;
    }
    case "macro": {
      const macroId = String(hook.actionConfig.macroId ?? "");
      if (!macroId) return { ok: false, error: "Macro id required" };
      const result = await macros.run(macroId);
      if (!result.ok) return { ok: false, error: result.message };
      break;
    }
    case "custom_event":
    default:
      await rules.handleEvent(
        createStreamEvent({
          source: "webhook",
          type: "unknown",
          message: String(payload.message ?? "Webhook event"),
          payload,
        }),
      );
  }

  return { ok: true };
}
