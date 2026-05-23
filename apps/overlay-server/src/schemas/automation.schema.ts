import { AutomationRuleSchema } from "@btv/shared";
import type { AutomationConfig } from "../db.js";

export { AutomationRuleSchema };

export function automationFromBody(
  id: string,
  body: Partial<AutomationConfig>,
  existing?: AutomationConfig | null,
): AutomationConfig {
  return {
    id,
    name: body.name?.trim() || "Untitled automation",
    enabled: body.enabled ?? true,
    intervalMs: Math.max(5_000, Number(body.intervalMs ?? 60_000)),
    action: body.action ?? "macro",
    actionConfig: body.actionConfig && typeof body.actionConfig === "object" ? body.actionConfig : {},
    runOnStart: Boolean(body.runOnStart),
    lastRunAt: existing?.lastRunAt,
    nextRunAt: existing?.nextRunAt,
    runCount: existing?.runCount ?? 0,
    lastStatus: existing?.lastStatus,
    lastMessage: existing?.lastMessage,
  };
}
