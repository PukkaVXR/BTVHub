import {
  getAlertRules,
  getAutomationRules,
  getAutomations,
  getEffects,
  getGoals,
  getMacros,
  getSettingsSnapshot,
  getSourceGroups,
  getThemes,
  getWebhooks,
  getWidgets,
  logSystem,
} from "../db.js";
import type { RouteModule } from "./types.js";

export const registerConfigRoutes: RouteModule = (app) => {
  app.get("/api/config/export", async () => {
    logSystem("config", "info", "Configuration profile exported");
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      settings: getSettingsSnapshot(),
      themes: getThemes(),
      alertRules: getAlertRules(),
      widgets: getWidgets(),
      goals: getGoals(),
      effects: getEffects(),
      macros: getMacros(),
      automations: getAutomations(),
      automationRules: getAutomationRules(),
      sourceGroups: getSourceGroups(),
      webhooks: getWebhooks().map((hook) => ({
        ...hook,
        secret: hook.secret ? "[redacted]" : undefined,
      })),
    };
  });
};
