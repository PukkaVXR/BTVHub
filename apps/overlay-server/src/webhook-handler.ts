import { createStreamEvent } from "@btv/shared";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getWebhook, logSystem, logWebhookRequest } from "./db.js";
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

function safeSignatureEqual(expected: string, received: string): boolean {
  const normalizedExpected = expected.startsWith("sha256=") ? expected : `sha256=${expected}`;
  const normalizedReceived = received.startsWith("sha256=") ? received : `sha256=${received}`;
  return safeEqual(normalizedExpected, normalizedReceived);
}

function canonicalWebhookPayload(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalWebhookPayload).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalWebhookPayload((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function safeBodyLog(body: unknown): string {
  try {
    const json = JSON.stringify(body);
    return json.length > 4000 ? `${json.slice(0, 4000)}...[truncated]` : json;
  } catch {
    return "[unserializable]";
  }
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const webhookRateLimits = new Map<string, { count: number; resetAt: number }>();

function rateLimitKey(hookId: string, clientKey: string | undefined): string {
  return `${hookId}:${clientKey || "unknown"}`;
}

function isRateLimited(hookId: string, clientKey: string | undefined): boolean {
  const now = Date.now();
  const key = rateLimitKey(hookId, clientKey);
  const current = webhookRateLimits.get(key);
  if (!current || current.resetAt <= now) {
    webhookRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX_REQUESTS;
}

function logRejectedWebhook(
  hookId: string,
  reason: string,
  body: unknown,
  details: Record<string, unknown> = {},
): void {
  const logBody = JSON.stringify({
    status: "rejected",
    reason,
    ...details,
    body: safeBodyLog(body),
  });
  logWebhookRequest(hookId, logBody);
  logSystem("webhook", "warn", `Webhook request rejected: ${reason}`, { hookId, ...details });
}

export async function handleWebhook(
  hookId: string,
  body: unknown,
  secretHeader: string | undefined,
  signatureHeader: string | undefined,
  clientKey: string | undefined,
  rules: RulesEngine,
  effects: EffectRunner,
  macros: MacroRunner,
  bus: OverlayBus,
  coreEvents?: CoreEventBus,
): Promise<{ ok: boolean; error?: string }> {
  const hook = getWebhook(hookId);
  if (!hook) {
    logRejectedWebhook(`unknown:${hookId}`, "Hook not found", body, { clientKey });
    return { ok: false, error: "Hook not found" };
  }

  if (isRateLimited(hookId, clientKey)) {
    logRejectedWebhook(hookId, "Rate limited", body, { clientKey });
    return { ok: false, error: "Rate limited" };
  }

  if (!hook.secret) {
    logRejectedWebhook(hookId, "Secret required", body, { clientKey });
    return { ok: false, error: "Secret required" };
  }

  const expectedSignature = `sha256=${createHmac("sha256", hook.secret)
    .update(canonicalWebhookPayload(body))
    .digest("hex")}`;
  const signatureValid = signatureHeader ? safeSignatureEqual(expectedSignature, signatureHeader) : false;
  const secretValid = secretHeader ? safeEqual(hook.secret, secretHeader) : false;

  if (!signatureValid && !secretValid) {
    logRejectedWebhook(hookId, signatureHeader ? "Invalid signature" : "Invalid secret", body, {
      clientKey,
      hasSignature: Boolean(signatureHeader),
      hasSecretHeader: Boolean(secretHeader),
    });
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
