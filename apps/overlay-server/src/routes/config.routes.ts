import type { AlertProject, AlertRule, Effect, Theme, WebhookHook, WidgetConfig } from "@btv/shared";
import { AutomationRuleSchema } from "@btv/shared";
import {
  getConfigProfileSnapshot,
  getGoals,
  logSystem,
  replaceConfigProfileSnapshot,
  type AutomationConfig,
  type ConfigProfileSnapshot,
  type GoalRow,
  type MacroConfig,
  type SourceGroup,
} from "../db.js";
import { ImportProfileBodySchema, parseBody } from "../schemas/request.schema.js";
import type { RouteModule } from "./types.js";

interface ConfigProfileExport {
  format: "btv.config-profile";
  version: 1;
  exportedAt: string;
  profile: ConfigProfileSnapshot;
}

export const registerConfigRoutes: RouteModule = (app, ctx) => {
  app.get("/api/config/export", async () => {
    const payload: ConfigProfileExport = {
      format: "btv.config-profile",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: getConfigProfileSnapshot(),
    };
    logSystem("config", "info", "Configuration profile exported");
    return payload;
  });

  app.post("/api/config/import", async (req, reply) => {
    const body = parseBody(reply, ImportProfileBodySchema, req.body);
    if (!body) return;
    const profile = normalizeImportedConfigProfile(body.profile);
    if (!profile) return reply.status(400).send({ error: "Valid BTV config profile export is required" });

    replaceConfigProfileSnapshot(profile);
    ctx.automationScheduler.stopAll();
    ctx.automationScheduler.startAll();
    for (const goal of getGoals()) {
      ctx.bus.broadcast({
        kind: "goal:update",
        goal: {
          id: goal.id,
          label: goal.label,
          current: goal.current_count,
          target: goal.target_count,
          type: goal.type as "follow" | "sub",
        },
      }, "goal");
    }
    logSystem("config", "info", "Configuration profile imported", {
      themes: profile.themes.length,
      alertProjects: profile.alertProjects.length,
      widgets: profile.widgets.length,
      macros: profile.macros.length,
      automations: profile.automations.length,
    });
    return { ok: true };
  });
};

function normalizeImportedConfigProfile(input: unknown): ConfigProfileSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const exported = input as Partial<ConfigProfileExport>;
  const raw = (exported.format === "btv.config-profile" ? exported.profile : input) as Partial<ConfigProfileSnapshot>;
  if (!Array.isArray(raw.settings)) return null;
  return {
    settings: raw.settings.flatMap((entry) =>
      entry && typeof entry.key === "string" && typeof entry.value === "string"
        ? [{ key: entry.key, value: entry.value }]
        : [],
    ),
    themes: normalizeIdArray<Theme>(raw.themes),
    alertRules: normalizeIdArray<AlertRule>(raw.alertRules),
    alertProjects: normalizeIdArray<AlertProject>(raw.alertProjects),
    widgets: normalizeIdArray<WidgetConfig>(raw.widgets),
    goals: Array.isArray(raw.goals) ? raw.goals.flatMap(normalizeGoal) : [],
    effects: normalizeIdArray<Effect>(raw.effects),
    macros: normalizeIdArray<MacroConfig>(raw.macros),
    automations: normalizeIdArray<AutomationConfig>(raw.automations),
    automationRules: Array.isArray(raw.automationRules)
      ? raw.automationRules.flatMap((rule) => {
          const parsed = AutomationRuleSchema.safeParse(rule);
          return parsed.success ? [parsed.data] : [];
        })
      : [],
    sourceGroups: normalizeIdArray<SourceGroup>(raw.sourceGroups),
    webhooks: normalizeIdArray<WebhookHook>(raw.webhooks),
  };
}

function normalizeIdArray<T extends { id: string }>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter(hasStringId) as T[] : [];
}

function hasStringId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string");
}

function normalizeGoal(goal: unknown): GoalRow[] {
  if (!goal || typeof goal !== "object") return [];
  const raw = goal as Partial<GoalRow>;
  if (typeof raw.id !== "string" || typeof raw.label !== "string" || typeof raw.type !== "string") return [];
  return [{
    id: raw.id,
    label: raw.label,
    type: raw.type,
    current_count: Number(raw.current_count ?? 0),
    target_count: Number(raw.target_count ?? 0),
  }];
}
